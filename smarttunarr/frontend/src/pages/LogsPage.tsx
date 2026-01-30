import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Download, RefreshCw, AlertCircle, X, Copy, Check } from 'lucide-react'
import clsx from 'clsx'
import { logsApi, type LogEntry } from '@/services/api'

const levelBadgeColors = {
  info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  debug: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
}

interface LogDetailModalProps {
  log: LogEntry | null
  onClose: () => void
}

function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  const [copied, setCopied] = useState(false)

  if (!log) return null

  const handleCopy = () => {
    const text = `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.source ? `[${log.source}] ` : ''}${log.message}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className={clsx(
              'px-2 py-1 rounded text-xs font-medium uppercase',
              levelBadgeColors[log.level]
            )}>
              {log.level}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {new Date(log.timestamp).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Copier"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Source */}
          {log.source && (
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Source
              </div>
              <div className="text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-900/50 px-3 py-2 rounded">
                {log.source}
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Message
            </div>
            <pre className="text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-900/50 px-3 py-2 rounded whitespace-pre-wrap break-all overflow-x-auto">
              {log.message}
            </pre>
          </div>

          {/* Raw */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              Voir le JSON brut
            </summary>
            <pre className="mt-2 p-3 bg-gray-900 text-green-400 text-[10px] font-mono rounded-lg overflow-x-auto">
              {JSON.stringify(log, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  )
}

export function LogsPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {t('nav.logs')}
        </h1>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 w-4 h-4"
            />
            <span className="hidden sm:inline">Auto-refresh</span>
            <span className="sm:hidden">Auto</span>
          </label>

          {/* Filter */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Tous</option>
            <option value="error">Erreurs</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            title={t('common.refresh')}
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline text-sm">{t('common.refresh')}</span>
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            title={t('common.export')}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">{t('common.export')}</span>
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
            title={t('common.delete')}
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">{t('common.delete')}</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Logs table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="text-left px-3 sm:px-4 py-2 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-32 sm:w-44">
                  Date
                </th>
                <th className="text-left px-3 sm:px-4 py-2 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-20 sm:w-24">
                  Level
                </th>
                <th className="text-left px-3 sm:px-4 py-2 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell w-28">
                  Source
                </th>
                <th className="text-left px-3 sm:px-4 py-2 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  Message
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Chargement...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    Aucun log
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  >
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-nowrap">
                      <span className="hidden sm:inline">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span className="sm:hidden">
                        {new Date(log.timestamp).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3">
                      <span className={clsx(
                        'px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium uppercase',
                        levelBadgeColors[log.level]
                      )}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs text-gray-600 dark:text-gray-400 hidden sm:table-cell truncate max-w-[120px]">
                      {log.source || '-'}
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs text-gray-900 dark:text-white font-mono truncate max-w-[150px] sm:max-w-[300px] lg:max-w-none">
                      {log.message}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats footer */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center sm:text-left">
        {logs.length} logs{autoRefresh && ' • Auto-refresh 5s'}
      </div>

      {/* Log detail modal */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  )
}
