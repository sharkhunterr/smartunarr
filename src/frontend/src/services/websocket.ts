import { useJobsStore, Job } from '@/stores/useJobsStore'

const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:4273/api/v1/ws/jobs`

class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private heartbeatInterval: number | null = null

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      console.log(`Connecting to WebSocket: ${WS_URL}`)
      this.ws = new WebSocket(WS_URL)

      this.ws.onopen = this.onOpen.bind(this)
      this.ws.onmessage = this.onMessage.bind(this)
      this.ws.onclose = this.onClose.bind(this)
      this.ws.onerror = this.onError.bind(this)
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      this.scheduleReconnect()
    }
  }

  disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    useJobsStore.getState().setConnected(false)
  }

  private onOpen() {
    console.log('WebSocket connected')
    this.reconnectAttempts = 0
    useJobsStore.getState().setConnected(true)

    // Start heartbeat
    this.heartbeatInterval = window.setInterval(() => {
      this.send({ type: 'ping' })
    }, 30000)
  }

  private onMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data)
      this.handleMessage(data)
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  private onClose(event: CloseEvent) {
    console.log(`WebSocket closed: ${event.code} ${event.reason}`)
    useJobsStore.getState().setConnected(false)

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // Reconnect if not intentional close
    if (event.code !== 1000) {
      this.scheduleReconnect()
    }
  }

  private onError(event: Event) {
    console.error('WebSocket error:', event)
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      this.connect()
    }, delay)
  }

  private handleMessage(data: { type: string; job?: Job; jobs?: Job[] }) {
    const store = useJobsStore.getState()

    switch (data.type) {
      case 'jobs_state':
        if (data.jobs) {
          store.setJobs(data.jobs)
        }
        break

      case 'job_created':
        if (data.job) {
          store.addJob(data.job)
        }
        break

      case 'job_started':
        if (data.job) {
          store.updateJob(data.job.id, data.job)
        }
        break

      case 'job_progress':
        if (data.job) {
          store.updateJob(data.job.id, {
            progress: data.job.progress,
            currentStep: data.job.currentStep,
            bestScore: data.job.bestScore,
            currentIteration: data.job.currentIteration,
          })
        }
        break

      case 'job_completed':
        if (data.job) {
          store.updateJob(data.job.id, {
            status: 'completed',
            progress: 100,
            completedAt: data.job.completedAt,
            result: data.job.result,
            bestScore: data.job.bestScore,
          })
        }
        break

      case 'job_failed':
        if (data.job) {
          store.updateJob(data.job.id, {
            status: 'failed',
            completedAt: data.job.completedAt,
            errorMessage: data.job.errorMessage,
          })
        }
        break

      case 'job_cancelled':
        if (data.job) {
          store.updateJob(data.job.id, {
            status: 'cancelled',
            completedAt: data.job.completedAt,
          })
        }
        break

      case 'pong':
        // Heartbeat response
        break

      default:
        console.log('Unknown WebSocket message type:', data.type)
    }
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Singleton instance
export const wsService = new WebSocketService()

// Auto-connect when imported
if (typeof window !== 'undefined') {
  wsService.connect()
}
