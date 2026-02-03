import { create } from 'zustand'
import { jobsApi } from '@/services/api'

export interface ProgressStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  detail?: string | null
}

export interface Job {
  id: string
  type: 'programming' | 'scoring' | 'sync' | 'ai_generation' | 'preview'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  title: string
  progress: number
  currentStep?: string
  bestScore?: number
  currentIteration?: number
  totalIterations?: number
  // Progress details
  libraryName?: string
  librariesFetched?: number
  totalLibraries?: number
  totalContent?: number
  programsCount?: number
  bestIteration?: number
  phase?: string
  // Progress steps
  steps?: ProgressStep[]
  // Job metadata
  channelId?: string
  profileId?: string
  createdAt?: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  result?: Record<string, unknown>
}

interface JobsState {
  jobs: Job[]
  connected: boolean

  // Actions
  setConnected: (connected: boolean) => void
  setJobs: (jobs: Job[]) => void
  addJob: (job: Job) => void
  updateJob: (jobId: string, updates: Partial<Job>) => void
  removeJob: (jobId: string) => void
  clearCompletedJobs: () => void

  // Selectors
  getActiveJobs: () => Job[]
  getRecentJobs: (limit?: number) => Job[]
  getJobById: (jobId: string) => Job | undefined
  getJob: (jobId: string) => Job | undefined
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  connected: false,

  setConnected: (connected) => set({ connected }),

  setJobs: (jobs) => set({ jobs }),

  addJob: (job) => set((state) => ({
    jobs: [job, ...state.jobs.filter(j => j.id !== job.id)],
  })),

  updateJob: (jobId, updates) => set((state) => ({
    jobs: state.jobs.map(job =>
      job.id === jobId ? { ...job, ...updates } : job
    ),
  })),

  removeJob: (jobId) => set((state) => ({
    jobs: state.jobs.filter(job => job.id !== jobId),
  })),

  clearCompletedJobs: () => {
    // Call API to clear on server - the SSE will broadcast updated state
    jobsApi.clearCompleted().catch((error) => {
      console.error('Failed to clear completed jobs:', error)
    })
    // Also update local state immediately for responsiveness
    set((state) => ({
      jobs: state.jobs.filter(job =>
        job.status === 'pending' || job.status === 'running'
      ),
    }))
  },

  getActiveJobs: () => {
    const { jobs } = get()
    return jobs.filter(job =>
      job.status === 'pending' || job.status === 'running'
    )
  },

  getRecentJobs: (limit = 10) => {
    const { jobs } = get()
    return jobs.slice(0, limit)
  },

  getJobById: (jobId) => {
    const { jobs } = get()
    return jobs.find(job => job.id === jobId)
  },

  getJob: (jobId) => {
    const { jobs } = get()
    return jobs.find(job => job.id === jobId)
  },
}))
