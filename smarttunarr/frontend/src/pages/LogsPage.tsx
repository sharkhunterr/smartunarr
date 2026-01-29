import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Download, RefreshCw, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { logsApi, type LogEntry } from '@/services/api'

const levelBadgeColors = {
  info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  debug: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
}

export function LogsPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchLogs = useCallback(async () => {
    try {
      setError(null)
      const params: { limit: number; level?: string } = { limit: 200 }
      if (filter !== 'all') {
        params.level = filter
      }
      const response = await logsApi.list(params)
      setLogs(response.logs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs])

  const handleClear = async () => {
    try {
      await logsApi.clear()
      setLogs([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear logs')
    }
  }

  const handleRefresh = () => {
    setLoading(true)
    fetchLogs()
  }

  const handleExport = () => {
    const content = logs.map(log =>
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.source ? `[${log.source}] ` : ''}${log.message}`
    ).join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `smarttunarr-logs-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('nav.logs')}
        </h1>

        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Auto-refresh
          </label>

          {/* Filter */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All levels</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            {t('common.refresh')}
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {t('common.export')}
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {t('common.delete')}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Logs table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 w-44">
                Date
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 w-28">
                Level
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 w-32">
                Source
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                Message
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No logs to display
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <span className={clsx(
                      'px-2 py-1 rounded text-xs font-medium uppercase',
                      levelBadgeColors[log.level]
                    )}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {log.source || '-'}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-mono whitespace-pre-wrap break-all">
                    {log.message}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Stats footer */}
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        Showing {logs.length} log entries
        {autoRefresh && ' (auto-refreshing every 5s)'}
      </div>
    </div>
  )
}
