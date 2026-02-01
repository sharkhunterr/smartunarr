import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Server, CheckCircle, XCircle, Loader2, Settings, Trash2, Database, Info, Eye, EyeOff, RefreshCw, Film, Tv } from 'lucide-react'
import { servicesApi, cacheApi, plexApi, logsApi, type CacheStats } from '@/services/api'
import type { PlexLibrary } from '@/types'
import { useThemeStore } from '@/stores/useThemeStore'
import type { ServiceConfig } from '@/types'
import clsx from 'clsx'

interface ServiceCardProps {
  type: string
  title: string
  fields: Array<{
    key: string
    label: string
    type: 'text' | 'password'
    placeholder?: string
  }>
}

const serviceConfigs: ServiceCardProps[] = [
  {
    type: 'plex',
    title: 'settings.plex.title',
    fields: [
      { key: 'url', label: 'settings.plex.url', type: 'text', placeholder: 'http://localhost:32400' },
      { key: 'token', label: 'settings.plex.token', type: 'password' },
    ],
  },
  {
    type: 'tunarr',
    title: 'settings.tunarr.title',
    fields: [
      { key: 'url', label: 'settings.tunarr.url', type: 'text', placeholder: 'http://localhost:8000' },
    ],
  },
  {
    type: 'tmdb',
    title: 'settings.tmdb.title',
    fields: [
      { key: 'api_key', label: 'settings.tmdb.apiKey', type: 'password' },
    ],
  },
  {
    type: 'ollama',
    title: 'settings.ollama.title',
    fields: [
      { key: 'url', label: 'settings.ollama.url', type: 'text', placeholder: 'http://localhost:11434' },
    ],
  },
]

const CACHE_MODES = [
  { value: 'cache_only', label: 'settings.defaults.cacheModes.cacheOnly' },
  { value: 'cache_tmdb', label: 'settings.defaults.cacheModes.cacheTmdb' },
  { value: 'tmdb_only', label: 'settings.defaults.cacheModes.tmdbOnly' },
  { value: 'plex_only', label: 'settings.defaults.cacheModes.plexOnly' },
]

function ServiceCard({ type, title, fields }: ServiceCardProps) {
  const { t } = useTranslation()
  const [config, setConfig] = useState<ServiceConfig | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadConfig()
  }, [type])

  const loadConfig = async () => {
    try {
      const data = await servicesApi.get(type)
      setConfig(data)
      const initialData: Record<string, string> = {}
      fields.forEach(f => {
        if (f.key === 'url') initialData[f.key] = data.url || ''
        if (f.key === 'username') initialData[f.key] = data.username || ''
      })
      setFormData(initialData)
    } catch {
      // Service not configured yet
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setTestResult(null)
    try {
      await servicesApi.update(type, formData)
      // Reload config status but preserve sensitive field values
      const data = await servicesApi.get(type)
      setConfig(data)
      // Keep current formData - don't overwrite sensitive fields that backend doesn't return
    } catch {
      // Error saving
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await servicesApi.test(type)
      setTestResult(result)
    } catch {
      setTestResult({ success: false, message: t('settings.connectionFailed') })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="text-gray-500">{t('common.loading')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Server className="w-4 sm:w-5 h-4 sm:h-5 text-primary-500 flex-shrink-0" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">{t(title)}</h3>
        </div>
        <span
          className={clsx(
            'text-xs sm:text-sm px-2 py-1 rounded w-fit',
            config?.is_configured
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          )}
        >
          {config?.is_configured ? t('settings.connected') : t('settings.notConfigured')}
        </span>
      </div>

      <div className="space-y-4">
        {fields.map(field => {
          // Determine if this sensitive field is already configured on the server
          const isSensitiveConfigured = field.type === 'password' && (
            (field.key === 'token' && config?.has_token) ||
            (field.key === 'api_key' && config?.has_api_key)
          )
          // Show masked placeholder if configured but no new value entered
          const showMaskedPlaceholder = isSensitiveConfigured && !formData[field.key]
          const placeholder = showMaskedPlaceholder
            ? '••••••••••••••••'
            : field.placeholder

          return (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t(field.label)}
                {isSensitiveConfigured && !formData[field.key] && (
                  <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                    ({t('settings.connected')})
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={field.type === 'password' && visibleFields[field.key] ? 'text' : field.type}
                  value={formData[field.key] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={placeholder}
                  className={clsx(
                    "w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
                    field.type === 'password' && "pr-10",
                    showMaskedPlaceholder
                      ? "border-green-300 dark:border-green-700"
                      : "border-gray-300 dark:border-gray-600"
                  )}
                />
                {field.type === 'password' && (
                  <button
                    type="button"
                    onClick={() => setVisibleFields(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {visibleFields[field.key] ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {testResult && (
          <div
            className={clsx(
              'flex items-center gap-2 p-3 rounded-lg',
              testResult.success
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            )}
          >
            {testResult.success ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 sm:gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 sm:px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !config?.is_configured}
            className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
          >
            {testing ? t('settings.testing') : t('settings.testConnection')}
          </button>
        </div>
      </div>
    </div>
  )
}

function DefaultsSection() {
  const { t } = useTranslation()
  const [defaults, setDefaults] = useState({
    iterations: 10,
    randomness: 0.3,
    cacheMode: 'cache_tmdb',
    logRetentionDays: 30,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load defaults from localStorage
    const stored = localStorage.getItem('smarttunarr_defaults')
    if (stored) {
      try {
        setDefaults(JSON.parse(stored))
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    localStorage.setItem('smarttunarr_defaults', JSON.stringify(defaults))

    // Apply log retention cleanup if not set to forever
    if (defaults.logRetentionDays > 0) {
      try {
        await logsApi.cleanup(defaults.logRetentionDays)
      } catch {
        // Ignore cleanup errors - setting is still saved
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-4">
        <Settings className="w-4 sm:w-5 h-4 sm:h-5 text-primary-500" />
        <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
          {t('settings.defaults.title')}
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.defaults.iterations')}
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={defaults.iterations}
            onChange={e => setDefaults(prev => ({ ...prev, iterations: parseInt(e.target.value) || 1 }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm sm:text-base"
          />
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {t('settings.defaults.iterationsHelp')}
          </p>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.defaults.randomness')}
          </label>
          <div className="flex items-center gap-3 sm:gap-4">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={defaults.randomness}
              onChange={e => setDefaults(prev => ({ ...prev, randomness: parseFloat(e.target.value) }))}
              className="flex-1"
            />
            <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 w-10 sm:w-12 text-right">
              {(defaults.randomness * 100).toFixed(0)}%
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {t('settings.defaults.randomnessHelp')}
          </p>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.defaults.cacheMode')}
          </label>
          <select
            value={defaults.cacheMode}
            onChange={e => setDefaults(prev => ({ ...prev, cacheMode: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm sm:text-base"
          >
            {CACHE_MODES.map(mode => (
              <option key={mode.value} value={mode.value}>
                {t(mode.label)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {t('settings.defaults.cacheModeHelp')}
          </p>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.defaults.logRetention')}
          </label>
          <select
            value={defaults.logRetentionDays}
            onChange={e => setDefaults(prev => ({ ...prev, logRetentionDays: parseInt(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm sm:text-base"
          >
            <option value={7}>{t('settings.defaults.logRetentionOptions.7days')}</option>
            <option value={14}>{t('settings.defaults.logRetentionOptions.14days')}</option>
            <option value={30}>{t('settings.defaults.logRetentionOptions.30days')}</option>
            <option value={60}>{t('settings.defaults.logRetentionOptions.60days')}</option>
            <option value={90}>{t('settings.defaults.logRetentionOptions.90days')}</option>
            <option value={0}>{t('settings.defaults.logRetentionOptions.forever')}</option>
          </select>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {t('settings.defaults.logRetentionHelp')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 sm:px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
          {saved && (
            <span className="text-xs sm:text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              {t('common.success')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function CacheSection() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [libraries, setLibraries] = useState<PlexLibrary[]>([])
  const [clearingAll, setClearingAll] = useState(false)
  const [clearingLibrary, setClearingLibrary] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; startEnriched: number } | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [selectedLibraries, setSelectedLibraries] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadData()
  }, [])

  // Poll cache stats during sync to show progress
  useEffect(() => {
    if (!syncing || !syncProgress) return

    const pollInterval = setInterval(async () => {
      try {
        const newStats = await cacheApi.getStats()
        setStats(newStats)
        // Update progress based on new enriched count
        setSyncProgress(prev => prev ? { ...prev, current: newStats.total_enriched - prev.startEnriched } : null)
      } catch {
        // Ignore polling errors
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [syncing, syncProgress])

  const loadData = async () => {
    setLoading(true)
    try {
      const [cacheStats, plexLibs] = await Promise.all([
        cacheApi.getStats(),
        plexApi.getLibraries().catch(() => [] as PlexLibrary[])
      ])
      setStats(cacheStats)
      setLibraries(plexLibs)
    } catch (err) {
      setError(t('settings.cache.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const handleClearAll = async () => {
    if (!confirm(t('settings.cache.confirmClearAll'))) return
    setClearingAll(true)
    setError(null)
    try {
      await cacheApi.clearAll()
      setSuccess(t('settings.cache.clearedAll'))
      setTimeout(() => setSuccess(null), 3000)
      await loadData()
    } catch {
      setError(t('settings.cache.clearError'))
    } finally {
      setClearingAll(false)
    }
  }

  const handleClearLibrary = async (libraryId: string) => {
    if (!confirm(t('settings.cache.confirmClearLibrary'))) return
    setClearingLibrary(libraryId)
    setError(null)
    try {
      await cacheApi.clearLibrary(libraryId)
      setSuccess(t('settings.cache.clearedLibrary'))
      setTimeout(() => setSuccess(null), 3000)
      await loadData()
    } catch {
      setError(t('settings.cache.clearError'))
    } finally {
      setClearingLibrary(null)
    }
  }

  const openSyncModal = () => {
    // Pre-select all libraries from cache stats
    const libraryIds = stats?.libraries.map(lib => lib.library_id) || []
    setSelectedLibraries(new Set(libraryIds))
    setShowSyncModal(true)
  }

  const toggleLibrarySelection = (libraryId: string) => {
    setSelectedLibraries(prev => {
      const next = new Set(prev)
      if (next.has(libraryId)) {
        next.delete(libraryId)
      } else {
        next.add(libraryId)
      }
      return next
    })
  }

  const handleForceEnrich = async () => {
    setShowSyncModal(false)
    setSyncing(true)
    setError(null)

    // Calculate items to enrich based on selected libraries
    const selectedStats = stats?.libraries.filter(lib => selectedLibraries.has(lib.library_id)) || []
    const itemsToEnrich = selectedStats.reduce((sum, lib) => sum + (lib.total_items - lib.enriched_items), 0)
    const startEnriched = selectedStats.reduce((sum, lib) => sum + lib.enriched_items, 0)
    setSyncProgress({ current: 0, total: itemsToEnrich, startEnriched })

    try {
      // Sync selected libraries one by one
      let totalEnriched = 0
      let totalFailed = 0

      for (const libraryId of selectedLibraries) {
        const result = await cacheApi.forceEnrich(libraryId)
        totalEnriched += result.enriched
        totalFailed += result.failed
        // Update progress after each library
        const newStats = await cacheApi.getStats()
        setStats(newStats)
        const currentEnriched = newStats.libraries
          .filter(lib => selectedLibraries.has(lib.library_id))
          .reduce((sum, lib) => sum + lib.enriched_items, 0)
        setSyncProgress(prev => prev ? { ...prev, current: currentEnriched - prev.startEnriched } : null)
      }

      setSuccess(t('settings.cache.enrichedResult', { count: totalEnriched, failed: totalFailed }))
      setTimeout(() => setSuccess(null), 5000)
      await loadData()
    } catch {
      setError(t('settings.cache.enrichError'))
    } finally {
      setSyncing(false)
      setSyncProgress(null)
    }
  }

  const handleRefreshFromPlex = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const result = await cacheApi.refreshFromPlex()
      setSuccess(t('settings.cache.refreshedResult', { added: result.added, updated: result.updated }))
      setTimeout(() => setSuccess(null), 5000)
      await loadData()
    } catch {
      setError(t('settings.cache.refreshError'))
    } finally {
      setRefreshing(false)
    }
  }

  const getLibraryName = (libraryId: string): string => {
    const lib = libraries.find(l => l.id === libraryId)
    return lib?.title || libraryId
  }

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="text-gray-500">{t('common.loading')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Database className="w-4 sm:w-5 h-4 sm:h-5 text-primary-500" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
            {t('settings.cache.title')}
          </h3>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title={t('common.refresh')}
        >
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t('settings.cache.description')}
      </p>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Global Stats */}
      {stats && (
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_content}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('settings.cache.totalContent')}</div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.total_enriched}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('settings.cache.enrichedTmdb')}</div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.libraries.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('settings.cache.libraries')}</div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total_content > 0 ? Math.round((stats.total_enriched / stats.total_content) * 100) : 0}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('settings.cache.enrichmentRate')}</div>
          </div>
        </div>
      )}

      {/* Libraries Table */}
      {stats && stats.libraries.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">{t('settings.cache.library')}</th>
                <th className="text-center px-3 py-2 font-medium text-gray-500 dark:text-gray-400">{t('settings.cache.items')}</th>
                <th className="text-center px-3 py-2 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">{t('settings.cache.enriched')}</th>
                <th className="text-center px-3 py-2 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">{t('settings.cache.lastUpdate')}</th>
                <th className="text-right px-3 py-2 font-medium text-gray-500 dark:text-gray-400">{t('settings.cache.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {stats.libraries.map(lib => (
                <tr key={lib.library_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {lib.movies > 0 ? (
                        <Film className="w-4 h-4 text-purple-500" />
                      ) : (
                        <Tv className="w-4 h-4 text-blue-500" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {getLibraryName(lib.library_id)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {lib.movies > 0 && `${lib.movies} ${t('settings.cache.movies')}`}
                      {lib.movies > 0 && lib.episodes > 0 && ' • '}
                      {lib.episodes > 0 && `${lib.episodes} ${t('settings.cache.episodes')}`}
                    </div>
                  </td>
                  <td className="text-center px-3 py-2 text-gray-900 dark:text-white">{lib.total_items}</td>
                  <td className="text-center px-3 py-2 hidden sm:table-cell">
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      lib.enriched_items === lib.total_items
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : lib.enriched_items > 0
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    )}>
                      {lib.enriched_items}/{lib.total_items}
                    </span>
                  </td>
                  <td className="text-center px-3 py-2 text-gray-500 dark:text-gray-400 hidden md:table-cell text-xs">
                    {formatDate(lib.newest_cache)}
                  </td>
                  <td className="text-right px-3 py-2">
                    <button
                      onClick={() => handleClearLibrary(lib.library_id)}
                      disabled={clearingLibrary === lib.library_id}
                      className="p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                      title={t('settings.cache.clearLibrary')}
                    >
                      {clearingLibrary === lib.library_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {stats && stats.libraries.length === 0 && (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <Database className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t('settings.cache.empty')}</p>
        </div>
      )}

      {/* Sync Progress */}
      {syncing && syncProgress && (
        <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                {t('settings.cache.syncInProgress')}
              </span>
            </div>
            <span className="text-sm text-primary-600 dark:text-primary-400">
              {syncProgress.current} / {syncProgress.total}
            </span>
          </div>
          <div className="w-full bg-primary-200 dark:bg-primary-800 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-primary-600 dark:text-primary-400">
            {t('settings.cache.syncHint')}
          </p>
        </div>
      )}

      {/* Refresh Progress */}
      {refreshing && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {t('settings.cache.refreshInProgress')}
            </span>
          </div>
          <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
            {t('settings.cache.refreshHint')}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleRefreshFromPlex}
          disabled={refreshing || syncing}
          className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm sm:text-base"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Server className="w-4 h-4" />
          )}
          {refreshing ? t('settings.cache.refreshing') : t('settings.cache.refreshPlex')}
        </button>
        <button
          onClick={openSyncModal}
          disabled={syncing || refreshing || (stats?.total_content ?? 0) === 0}
          className="px-3 sm:px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm sm:text-base"
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {syncing ? t('settings.cache.syncing') : t('settings.cache.syncTmdb')}
        </button>
        <button
          onClick={handleClearAll}
          disabled={clearingAll || refreshing || syncing || (stats?.total_content ?? 0) === 0}
          className="px-3 sm:px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm sm:text-base"
        >
          {clearingAll ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          {t('settings.cache.clearAll')}
        </button>
      </div>

      {/* Sync Library Selection Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md m-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {t('settings.cache.syncModalTitle')}
              </h3>
              <button
                onClick={() => setShowSyncModal(false)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('settings.cache.syncModalDescription')}
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {stats?.libraries.map(lib => {
                  const libName = getLibraryName(lib.library_id)
                  const unenriched = lib.total_items - lib.enriched_items
                  const isSelected = selectedLibraries.has(lib.library_id)

                  return (
                    <label
                      key={lib.library_id}
                      className={clsx(
                        'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleLibrarySelection(lib.library_id)}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {libName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {lib.enriched_items}/{lib.total_items} {t('settings.cache.enriched')}
                          </div>
                        </div>
                      </div>
                      {unenriched > 0 && (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                          {unenriched} {t('settings.cache.toEnrich')}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    if (selectedLibraries.size === stats?.libraries.length) {
                      setSelectedLibraries(new Set())
                    } else {
                      setSelectedLibraries(new Set(stats?.libraries.map(lib => lib.library_id) || []))
                    }
                  }}
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  {selectedLibraries.size === stats?.libraries.length
                    ? t('settings.cache.deselectAll')
                    : t('settings.cache.selectAll')}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSyncModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleForceEnrich}
                    disabled={selectedLibraries.size === 0}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('settings.cache.startSync')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AboutSection() {
  const { t } = useTranslation()
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-4">
        <Info className="w-4 sm:w-5 h-4 sm:h-5 text-primary-500" />
        <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
          {t('settings.about.title')}
        </h3>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">{t('settings.about.version')}</span>
            <p className="font-medium text-gray-900 dark:text-white">1.0.0</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">{t('settings.about.build')}</span>
            <p className="font-medium text-gray-900 dark:text-white">2025.01</p>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('settings.theme')}
          </label>
          <div className="flex flex-wrap gap-2">
            {(['light', 'dark', 'system'] as const).map(t_opt => (
              <button
                key={t_opt}
                onClick={() => setTheme(t_opt)}
                className={clsx(
                  'px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors',
                  theme === t_opt
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-300 dark:border-primary-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {t(`settings.themes.${t_opt}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {t('settings.about.description')}
          </p>
          <a
            href="https://github.com/smarttunarr/smarttunarr"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center text-xs sm:text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            GitHub Repository
          </a>
        </div>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6 sm:space-y-8">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
        {t('settings.title')}
      </h1>

      {/* Services */}
      <div>
        <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">
          {t('settings.services')}
        </h2>
        <div className="grid gap-4 sm:gap-6">
          {serviceConfigs.map(config => (
            <ServiceCard key={config.type} {...config} />
          ))}
        </div>
      </div>

      {/* Default Parameters */}
      <div>
        <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">
          {t('settings.defaults.section')}
        </h2>
        <DefaultsSection />
      </div>

      {/* Cache Management */}
      <div>
        <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">
          {t('settings.cache.section')}
        </h2>
        <CacheSection />
      </div>

      {/* About */}
      <div>
        <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">
          {t('settings.about.section')}
        </h2>
        <AboutSection />
      </div>
    </div>
  )
}
