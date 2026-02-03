import { useJobsStore, Job } from '@/stores/useJobsStore'

// Use relative URL to go through Vite proxy in dev, or same origin in production
const SSE_URL = '/api/v1/jobs/stream'

class SSEService {
  private eventSource: EventSource | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000

  connect() {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      return
    }

    try {
      console.log(`Connecting to SSE: ${SSE_URL}`)
      this.eventSource = new EventSource(SSE_URL)

      this.eventSource.onopen = this.onOpen.bind(this)
      this.eventSource.onmessage = this.onMessage.bind(this)
      this.eventSource.onerror = this.onError.bind(this)
    } catch (error) {
      console.error('SSE connection failed:', error)
      this.scheduleReconnect()
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    useJobsStore.getState().setConnected(false)
  }

  private onOpen() {
    console.log('SSE connected')
    this.reconnectAttempts = 0
    useJobsStore.getState().setConnected(true)
  }

  private onMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data)
      this.handleMessage(data)
    } catch (error) {
      console.error('Failed to parse SSE message:', error)
    }
  }

  private onError(event: Event) {
    console.error('SSE error:', event)
    useJobsStore.getState().setConnected(false)

    // EventSource will auto-reconnect, but we track attempts for backoff
    if (this.eventSource?.readyState === EventSource.CLOSED) {
      this.scheduleReconnect()
    }
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
            totalIterations: data.job.totalIterations,
            // Granular progress fields
            libraryName: data.job.libraryName,
            librariesFetched: data.job.librariesFetched,
            totalLibraries: data.job.totalLibraries,
            totalContent: data.job.totalContent,
            programsCount: data.job.programsCount,
            bestIteration: data.job.bestIteration,
            phase: data.job.phase,
            // Progress steps
            steps: data.job.steps,
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

      default:
        console.log('Unknown SSE message type:', data.type)
    }
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN
  }
}

// Singleton instance
export const sseService = new SSEService()

// Auto-connect when imported
if (typeof window !== 'undefined') {
  sseService.connect()
}
