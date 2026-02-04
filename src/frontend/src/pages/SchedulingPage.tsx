import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  RefreshCw,
  Zap,
  Sparkles,
  Database
} from 'lucide-react'
import clsx from 'clsx'
import { schedulesApi, tunarrApi, profilesApi, ollamaApi } from '@/services/api'
import { ServiceStatusBanner } from '@/components/ServiceStatusBanner'
import type {
  Schedule,
  ScheduleConfig,
  ScheduleCreate,
  TunarrChannel,
  Profile,
  ProgrammingRequest,
  OllamaModel
} from '@/types'

type ScheduleType = 'programming' | 'scoring'
type ScheduleMode = 'simple' | 'cron'
type Frequency = 'daily' | 'weekly' | 'specific_days'
type CacheMode = 'none' | 'plex_only' | 'tmdb_only' | 'cache_only' | 'full' | 'enrich_cache'

const cacheModeOptions: { value: CacheMode; labelKey: string; icon: React.ElementType; descKey: string }[] = [
  { value: 'cache_only', labelKey: 'programming.cacheModes.cacheOnly', icon: Database, descKey: 'programming.cacheModeDescriptions.cacheOnly' },
  { value: 'full', labelKey: 'programming.cacheModes.cachePlex', icon: Database, descKey: 'programming.cacheModeDescriptions.cachePlex' },
  { value: 'enrich_cache', labelKey: 'programming.cacheModes.enrich', icon: RefreshCw, descKey: 'programming.cacheModeDescriptions.enrich' },
  { value: 'plex_only', labelKey: 'programming.cacheModes.plexOnly', icon: Zap, descKey: 'programming.cacheModeDescriptions.plexOnly' },
]

const DAYS_OF_WEEK = [
  { key: 'mon', value: 0 },
  { key: 'tue', value: 1 },
  { key: 'wed', value: 2 },
  { key: 'thu', value: 3 },
  { key: 'fri', value: 4 },
  { key: 'sat', value: 5 },
  { key: 'sun', value: 6 },
]

interface ScheduleFormData {
  name: string
  description: string
  schedule_type: ScheduleType
  channel_id: string
  profile_id: string
  mode: ScheduleMode
  frequency: Frequency
  days: number[]
  time: string
  cronExpression: string
  // Execution params (programming)
  iterations: number
  randomness: number
  duration_days: number
  cache_mode: CacheMode
  replace_forbidden: boolean
  improve_best: boolean
  ai_improve: boolean
  ai_prompt: string
  ai_model: string
}

const defaultFormData: ScheduleFormData = {
  name: '',
  description: '',
  schedule_type: 'programming',
  channel_id: '',
  profile_id: '',
  mode: 'simple',
  frequency: 'daily',
  days: [],
  time: '06:00',
  cronExpression: '0 6 * * *',
  iterations: 10,
  randomness: 30,
  duration_days: 1,
  cache_mode: 'full',
  replace_forbidden: false,
  improve_best: false,
  ai_improve: false,
  ai_prompt: '',
  ai_model: '',
}

export function SchedulingPage() {
  const { t } = useTranslation()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channels, setChannels] = useState<TunarrChannel[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([])

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [formData, setFormData] = useState<ScheduleFormData>(defaultFormData)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [schedulesData, channelsData, profilesData] = await Promise.all([
        schedulesApi.list(),
        tunarrApi.getChannels(),
        profilesApi.list(),
      ])
      setSchedules(schedulesData)
      setChannels(channelsData)
      setProfiles(profilesData)

      // Load Ollama models (optional)
      try {
        const models = await ollamaApi.getModels()
        setOllamaModels(models)
      } catch {
        // Ollama not configured
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errors.loadingData'))
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingSchedule(null)
    setFormData({
      ...defaultFormData,
      channel_id: channels[0]?.id || '',
      profile_id: profiles[0]?.id || '',
    })
    setModalOpen(true)
  }

  const openEditModal = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    const config = schedule.schedule_config
    const params = schedule.execution_params as Partial<ProgrammingRequest>

    setFormData({
      name: schedule.name,
      description: schedule.description || '',
      schedule_type: schedule.schedule_type,
      channel_id: schedule.channel_id,
      profile_id: schedule.profile_id || '',
      mode: config.mode,
      frequency: config.frequency || 'daily',
      days: config.days || [],
      time: config.time || '06:00',
      cronExpression: config.expression || '0 6 * * *',
      iterations: params.iterations || 10,
      randomness: (params.randomness || 0.3) * 100,
      duration_days: params.duration_days || 1,
      cache_mode: (params.cache_mode as CacheMode) || 'full',
      replace_forbidden: params.replace_forbidden || false,
      improve_best: params.improve_best || false,
      ai_improve: params.ai_improve || false,
      ai_prompt: params.ai_prompt || '',
      ai_model: params.ai_model || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      const scheduleConfig: ScheduleConfig = formData.mode === 'cron'
        ? { mode: 'cron', expression: formData.cronExpression }
        : {
            mode: 'simple',
            frequency: formData.frequency,
            days: formData.frequency !== 'daily' ? formData.days : undefined,
            time: formData.time,
          }

      const executionParams: Partial<ProgrammingRequest> = formData.schedule_type === 'programming'
        ? {
            iterations: formData.iterations,
            randomness: formData.randomness / 100,
            duration_days: formData.duration_days,
            cache_mode: formData.cache_mode as ProgrammingRequest['cache_mode'],
            preview_only: false, // Always apply for scheduled tasks
            replace_forbidden: formData.replace_forbidden,
            improve_best: formData.improve_best,
            ai_improve: formData.ai_improve,
            ai_prompt: formData.ai_improve ? formData.ai_prompt : undefined,
            ai_model: formData.ai_improve && formData.ai_model ? formData.ai_model : undefined,
          }
        : {
            cache_mode: formData.cache_mode as ProgrammingRequest['cache_mode'],
          }

      if (editingSchedule) {
        await schedulesApi.update(editingSchedule.id, {
          name: formData.name,
          description: formData.description || undefined,
          channel_id: formData.channel_id,
          profile_id: formData.profile_id,
          schedule_config: scheduleConfig,
          execution_params: executionParams,
        })
      } else {
        const createData: ScheduleCreate = {
          name: formData.name,
          description: formData.description || undefined,
          schedule_type: formData.schedule_type,
          channel_id: formData.channel_id,
          profile_id: formData.profile_id,
          schedule_config: scheduleConfig,
          execution_params: executionParams,
        }
        await schedulesApi.create(createData)
      }

      setModalOpen(false)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (schedule: Schedule) => {
    try {
      await schedulesApi.toggle(schedule.id, !schedule.enabled)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errors.generic'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await schedulesApi.delete(id)
      setDeleteConfirm(null)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errors.generic'))
    }
  }

  const handleRunNow = async (id: string) => {
    try {
      await schedulesApi.runNow(id)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errors.generic'))
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return t('schedules.never')
    return new Date(dateStr).toLocaleString()
  }

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day].sort()
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <CalendarClock className="w-6 h-6 sm:w-8 sm:h-8 text-primary-500" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {t('schedules.title')}
          </h1>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">{t('schedules.create')}</span>
          <span className="sm:hidden">{t('common.add')}</span>
        </button>
      </div>

      {/* Service status banner */}
      <ServiceStatusBanner
        requiredServices={['tunarr', 'plex']}
        optionalServices={['tmdb', 'ollama']}
      />

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <CalendarClock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{t('schedules.noSchedules')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('schedules.name')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('schedules.type')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('schedules.channel')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('schedules.profile')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('schedules.lastRun')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('schedules.nextRun')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('schedules.status')}</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('schedules.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{schedule.name}</div>
                      {schedule.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{schedule.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'px-2 py-1 text-xs font-medium rounded',
                        schedule.schedule_type === 'programming'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      )}>
                        {t(`schedules.types.${schedule.schedule_type}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {schedule.channel_name || schedule.channel_id}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {schedule.profile_name || schedule.profile_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        {schedule.last_execution_status && (
                          schedule.last_execution_status === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : schedule.last_execution_status === 'failed' ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                          )
                        )}
                        {formatDate(schedule.last_execution_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {schedule.enabled ? formatDate(schedule.next_execution_at) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(schedule)}
                        className={clsx(
                          'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors',
                          schedule.enabled
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        )}
                      >
                        {schedule.enabled ? (
                          <>
                            <ToggleRight className="w-4 h-4" />
                            {t('schedules.enabled')}
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4" />
                            {t('schedules.disabled')}
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRunNow(schedule.id)}
                          className="p-1.5 text-gray-500 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title={t('schedules.runNow')}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(schedule)}
                          className="p-1.5 text-gray-500 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title={t('schedules.edit')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(schedule.id)}
                          className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title={t('schedules.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('schedules.delete')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('schedules.confirmDelete')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingSchedule ? t('schedules.edit') : t('schedules.create')}
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('schedules.name')} *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('schedules.namePlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('schedules.description')}
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {!editingSchedule && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('schedules.type')}
                    </label>
                    <select
                      value={formData.schedule_type}
                      onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value as ScheduleType })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="programming">{t('schedules.types.programming')}</option>
                      <option value="scoring">{t('schedules.types.scoring')}</option>
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('schedules.channel')} *
                    </label>
                    <select
                      value={formData.channel_id}
                      onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.number}. {ch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('schedules.profile')} *
                    </label>
                    <select
                      value={formData.profile_id}
                      onChange={(e) => setFormData({ ...formData, profile_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Schedule Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {t('schedules.configuration')}
                </h3>

                {/* Mode Toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, mode: 'simple' })}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      formData.mode === 'simple'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    {t('schedules.simpleMode')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, mode: 'cron' })}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      formData.mode === 'cron'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    {t('schedules.expertMode')}
                  </button>
                </div>

                {formData.mode === 'simple' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('schedules.frequency')}
                      </label>
                      <select
                        value={formData.frequency}
                        onChange={(e) => setFormData({ ...formData, frequency: e.target.value as Frequency })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="daily">{t('schedules.frequencies.daily')}</option>
                        <option value="weekly">{t('schedules.frequencies.weekly')}</option>
                        <option value="specific_days">{t('schedules.frequencies.specific_days')}</option>
                      </select>
                    </div>

                    {formData.frequency !== 'daily' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('schedules.days')}
                        </label>
                        <div className="flex gap-2 flex-wrap">
                          {DAYS_OF_WEEK.map(({ key, value }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleDay(value)}
                              className={clsx(
                                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                                formData.days.includes(value)
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              )}
                            >
                              {t(`schedules.daysShort.${key}`)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('schedules.time')}
                      </label>
                      <input
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('schedules.cronExpression')}
                    </label>
                    <input
                      type="text"
                      value={formData.cronExpression}
                      onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                      placeholder="0 6 * * *"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('schedules.cronHelp')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('schedules.cronExamples')}
                    </p>
                  </div>
                )}
              </div>

              {/* Execution Parameters (for programming) */}
              {formData.schedule_type === 'programming' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {t('schedules.executionParams')}
                  </h3>

                  {/* Parameters row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        {t('programming.durationDays')}: <span className="font-medium">{t('historyPage.days', { count: formData.duration_days })}</span>
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={formData.duration_days}
                        onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        {t('programming.iterations')}: <span className="font-medium">{formData.iterations}</span>
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={formData.iterations}
                        onChange={(e) => setFormData({ ...formData, iterations: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        {t('programming.randomness')}: <span className="font-medium">{formData.randomness}%</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={formData.randomness}
                        onChange={(e) => setFormData({ ...formData, randomness: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                      />
                    </div>
                  </div>

                  {/* Cache mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('programming.cacheMode')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {cacheModeOptions.map(option => {
                        const Icon = option.icon
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, cache_mode: option.value })}
                            title={t(option.descKey)}
                            className={clsx(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                              formData.cache_mode === option.value
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            {t(option.labelKey)}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Options (toggle buttons) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('programming.options')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, replace_forbidden: !formData.replace_forbidden })}
                        title={t('programming.replaceForbiddenDesc')}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                          formData.replace_forbidden
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        )}
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t('programming.replaceForbidden')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, improve_best: !formData.improve_best })}
                        title={t('programming.improveBestDesc')}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                          formData.improve_best
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        )}
                      >
                        <Zap className="w-4 h-4" />
                        {t('programming.improveBest')}
                      </button>
                      {ollamaModels.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, ai_improve: !formData.ai_improve })}
                          title={t('programming.aiImproveDesc')}
                          className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                            formData.ai_improve
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                          )}
                        >
                          <Sparkles className="w-4 h-4" />
                          {t('programming.aiImprove')}
                          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded">
                            {t('programming.aiExperimental')}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* AI Improvement section - shown when AI Improve is enabled */}
                  {formData.ai_improve && ollamaModels.length > 0 && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                      <div className="flex items-start gap-2 mb-3 px-2 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-xs">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{t('programming.aiExperimentalWarning')}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={formData.ai_model}
                          onChange={(e) => setFormData({ ...formData, ai_model: e.target.value })}
                          className="px-2 py-1.5 text-sm border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white sm:w-40"
                        >
                          <option value="">{t('common.auto')}</option>
                          {ollamaModels.map(m => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                        <textarea
                          value={formData.ai_prompt}
                          onChange={(e) => setFormData({ ...formData, ai_prompt: e.target.value })}
                          placeholder={t('programming.aiImprovePlaceholder')}
                          rows={2}
                          className="flex-1 px-3 py-2 text-sm border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.channel_id || !formData.profile_id}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
