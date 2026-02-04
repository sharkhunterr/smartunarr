import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, Settings, X } from 'lucide-react'
import { servicesApi } from '@/services/api'
import type { ServiceConfig } from '@/types'

interface ServiceStatusBannerProps {
  /** Services that are required for the page to work */
  requiredServices?: ('tunarr' | 'plex')[]
  /** Services that are optional but enhance functionality */
  optionalServices?: ('tmdb' | 'ollama')[]
}

export function ServiceStatusBanner({
  requiredServices = ['tunarr', 'plex'],
  optionalServices = ['tmdb', 'ollama']
}: ServiceStatusBannerProps) {
  const { t } = useTranslation()
  const [services, setServices] = useState<ServiceConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    loadServiceStatus()
  }, [])

  const loadServiceStatus = async () => {
    try {
      const serviceList = await servicesApi.list()
      setServices(serviceList)
    } catch (error) {
      console.error('Failed to load service status:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || dismissed) return null

  const getServiceStatus = (type: string) => {
    const service = services.find(s => s.service_type === type)
    return service?.is_configured ?? false
  }

  const missingRequired = requiredServices.filter(s => !getServiceStatus(s))
  const missingOptional = optionalServices.filter(s => !getServiceStatus(s))

  // Don't show banner if all services are configured
  if (missingRequired.length === 0 && missingOptional.length === 0) return null

  const serviceNames: Record<string, string> = {
    tunarr: 'Tunarr',
    plex: 'Plex',
    tmdb: 'TMDB',
    ollama: 'Ollama'
  }

  return (
    <div className="relative flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        {missingRequired.length > 0 && (
          <p>
            <span className="font-medium">{t('serviceStatus.requiredNotConfigured')}:</span>{' '}
            {missingRequired.map(s => serviceNames[s]).join(', ')}
          </p>
        )}
        {missingOptional.length > 0 && (
          <p className="text-amber-700 dark:text-amber-300">
            <span className="font-medium">{t('serviceStatus.optionalNotConfigured')}:</span>{' '}
            {missingOptional.map(s => `${serviceNames[s]} (${t('settings.optional')})`).join(', ')}
          </p>
        )}
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 mt-1 text-amber-900 dark:text-amber-100 font-medium hover:underline"
        >
          <Settings className="w-4 h-4" />
          {t('serviceStatus.goToSettings')}
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-amber-200 dark:hover:bg-amber-800 rounded transition-colors"
        title={t('common.close')}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
