import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Server, CheckCircle, XCircle, Loader2, Settings, Trash2, Database, Info, Eye, EyeOff } from 'lucide-react'
import { servicesApi } from '@/services/api'
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

  const handleSave = () => {
    setSaving(true)
    localStorage.setItem('smarttunarr_defaults', JSON.stringify(defaults))
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 300)
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
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)

  const handleClearCache = async () => {
    setClearing(true)
    try {
      // Clear local storage cache
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('smarttunarr_cache_')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))

      setCleared(true)
      setTimeout(() => setCleared(false), 2000)
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-4">
        <Database className="w-4 sm:w-5 h-4 sm:h-5 text-primary-500" />
        <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
          {t('settings.cache.title')}
        </h3>
      </div>

      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t('settings.cache.description')}
      </p>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          onClick={handleClearCache}
          disabled={clearing}
          className="px-3 sm:px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm sm:text-base"
        >
          <Trash2 className="w-4 h-4" />
          {clearing ? t('common.loading') : t('settings.cache.clear')}
        </button>
        {cleared && (
          <span className="text-xs sm:text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            {t('settings.cache.cleared')}
          </span>
        )}
      </div>
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
