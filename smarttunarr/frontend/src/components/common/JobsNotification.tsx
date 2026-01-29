import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useJobsStore, Job } from '@/stores/useJobsStore'
import clsx from 'clsx'

function JobCard({ job, onDismiss }: { job: Job; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(job.status === 'running')

  const statusIcon = {
    pending: <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />,
    running: <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />,
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
    cancelled: <X className="w-4 h-4 text-gray-400" />,
  }

  const statusColors = {
    pending: 'bg-gray-100 dark:bg-gray-700',
    running: 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-700',
    completed: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700',
    failed: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700',
    cancelled: 'bg-gray-100 dark:bg-gray-700',
  }

  const canDismiss = job.status !== 'running' && job.status !== 'pending'

  return (
    <div
      className={clsx(
        'rounded-lg border p-3 transition-all',
        statusColors[job.status]
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusIcon[job.status]}
          <div>
            <div className="font-medium text-sm text-gray-900 dark:text-white">
              {job.title}
            </div>
            {job.currentStep && job.status === 'running' && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {job.currentStep}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {job.status === 'running' && (
            <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
              {job.progress.toFixed(0)}%
            </span>
          )}
          {job.bestScore !== undefined && job.bestScore !== null && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Score: {job.bestScore.toFixed(1)}
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {canDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {job.status === 'running' && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
            <div
              className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs space-y-1">
          {job.currentIteration && job.totalIterations && (
            <div className="text-gray-500 dark:text-gray-400">
              Iteration: {job.currentIteration} / {job.totalIterations}
            </div>
          )}
          {job.errorMessage && (
            <div className="text-red-600 dark:text-red-400">
              {job.errorMessage}
            </div>
          )}
          {job.startedAt && (
            <div className="text-gray-500 dark:text-gray-400">
              Started: {new Date(job.startedAt).toLocaleTimeString()}
            </div>
          )}
          {job.completedAt && (
            <div className="text-gray-500 dark:text-gray-400">
              Completed: {new Date(job.completedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function JobsNotification() {
  const { t } = useTranslation()
  const location = useLocation()
  const jobs = useJobsStore(state => state.jobs)
  const connected = useJobsStore(state => state.connected)
  const removeJob = useJobsStore(state => state.removeJob)
  const clearCompletedJobs = useJobsStore(state => state.clearCompletedJobs)

  const [minimized, setMinimized] = useState(false)

  // Only show recent jobs
  const recentJobs = jobs.slice(0, 5)
  const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending')
  const hasActiveJobs = activeJobs.length > 0

  // Auto-expand when there are active jobs
  useEffect(() => {
    if (hasActiveJobs) {
      setMinimized(false)
    }
  }, [hasActiveJobs])

  // Don't render on Programming page (it has its own progress panel)
  if (location.pathname === '/programming') {
    return null
  }

  // Don't render if no jobs
  if (recentJobs.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      {/* Header */}
      <div
        className={clsx(
          'flex items-center justify-between px-3 py-2 rounded-t-lg cursor-pointer',
          'bg-gray-800 dark:bg-gray-900 text-white'
        )}
        onClick={() => setMinimized(!minimized)}
      >
        <div className="flex items-center gap-2">
          <div
            className={clsx(
              'w-2 h-2 rounded-full',
              connected ? 'bg-green-500' : 'bg-red-500'
            )}
          />
          <span className="font-medium text-sm">
            {t('jobs.title', 'Jobs')} ({activeJobs.length} {t('jobs.active', 'active')})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!hasActiveJobs && recentJobs.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearCompletedJobs()
              }}
              className="text-xs text-gray-400 hover:text-white"
            >
              {t('jobs.clearAll', 'Clear')}
            </button>
          )}
          {minimized ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Jobs list */}
      {!minimized && (
        <div className="bg-white dark:bg-gray-800 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg p-2 space-y-2 max-h-96 overflow-y-auto">
          {recentJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onDismiss={() => removeJob(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
