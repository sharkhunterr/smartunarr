import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Download, RefreshCw, AlertCircle, X, Copy, Check, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { logsApi, type LogEntry } from '@/services/api'

const levelBadgeColors = {
  info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  debug: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

interface LogDetailModalProps {
  log: LogEntry | null
  onClose: () => void
}

function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  const { t } = useTranslation()
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
              title={t('logs.copy')}
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
                {t('logs.source')}
              </div>
              <div className="text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-900/50 px-3 py-2 rounded">
                {log.source}
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              {t('logs.message')}
            </div>
            <pre className="text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-900/50 px-3 py-2 rounded whitespace-pre-wrap break-all overflow-x-auto">
              {log.message}
            </pre>
          </div>

          {/* Raw */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              {t('logs.viewRawJson')}
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

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  const { t } = useTranslation()
  const startItem = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
      {/* Info */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {t('logs.showing', { start: startItem, end: endItem, total: totalItems })}
      </div>

      <div className="flex items-center gap-4">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">{t('logs.perPage')}</span>
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
            {currentPage} / {totalPages || 1}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function LogsPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)

  const totalPages = Math.ceil(total / pageSize)

  const fetchLogs = useCallback(async () => {
    try {
      setError(null)
      const params: { limit: number; offset: number; level?: string; search?: string } = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      }
      if (filter !== 'all') {
        params.level = filter
      }
      if (search) {
        params.search = search
      }
      const response = await logsApi.list(params)
      setLogs(response.logs)
      setTotal(response.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('logs.fetchError'))
    } finally {
      setLoading(false)
    }
  }, [filter, search, currentPage, pageSize, t])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, search, pageSize])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const handleClear = async () => {
    if (!confirm(t('logs.confirmClear'))) return
    try {
      await logsApi.clear()
      setLogs([])
      setTotal(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('logs.clearError'))
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
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
            <span className="hidden sm:inline">{t('logs.autoRefresh')}</span>
            <span className="sm:hidden">Auto</span>
          </label>

          {/* Filter */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">{t('logs.levels.all')}</option>
            <option value="error">{t('logs.levels.error')}</option>
            <option value="warning">{t('logs.levels.warning')}</option>
            <option value="info">{t('logs.levels.info')}</option>
            <option value="debug">{t('logs.levels.debug')}</option>
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
            disabled={total === 0}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
            title={t('common.delete')}
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">{t('common.delete')}</span>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder={t('logs.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          {t('logs.search')}
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setSearchInput('')
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

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
                  {t('logs.date')}
                </th>
                <th className="text-left px-3 sm:px-4 py-2 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-20 sm:w-24">
                  {t('logs.level')}
                </th>
                <th className="text-left px-3 sm:px-4 py-2 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell w-28">
                  {t('logs.source')}
                </th>
                <th className="text-left px-3 sm:px-4 py-2 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('logs.message')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    {t('common.loading')}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    {t('logs.noLogs')}
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

        {/* Pagination */}
        {total > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      {/* Stats footer */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center sm:text-left">
        {t('logs.totalLogs', { count: total })}{autoRefresh && ` • ${t('logs.autoRefresh5s')}`}
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
