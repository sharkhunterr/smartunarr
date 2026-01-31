import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Play,
  Loader2,
  Sparkles,
  Eye,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Database,
  Zap,
  Calendar,
  Clock,
  Table,
  LayoutGrid,
  CheckCircle,
  XCircle,
  Settings2
} from 'lucide-react'
import clsx from 'clsx'
import { profilesApi, tunarrApi, ollamaApi, programmingApi } from '@/services/api'
import { DayTimeline } from '@/components/timeline'
import {
  ScoresTable,
  getScoreColor,
} from '@/components/scoring/ScoringDisplay'
import { useJobsStore, Job } from '@/stores/useJobsStore'
import type { Profile, TunarrChannel, OllamaModel, ProgramResult, ProgrammingRequest, AIProgrammingRequest } from '@/types'

type CacheMode = 'none' | 'plex_only' | 'tmdb_only' | 'cache_only' | 'full' | 'enrich_cache'
type ProgrammingMode = 'profile' | 'ai'
type ResultView = 'timeline' | 'table'

const cacheModeOptions: { value: CacheMode; labelKey: string; icon: React.ElementType; descKey: string }[] = [
  { value: 'cache_only', labelKey: 'programming.cacheModes.cacheOnly', icon: Database, descKey: 'programming.cacheModeDescriptions.cacheOnly' },
  { value: 'full', labelKey: 'programming.cacheModes.cachePlex', icon: Database, descKey: 'programming.cacheModeDescriptions.cachePlex' },
  { value: 'enrich_cache', labelKey: 'programming.cacheModes.enrich', icon: RefreshCw, descKey: 'programming.cacheModeDescriptions.enrich' },
  { value: 'plex_only', labelKey: 'programming.cacheModes.plexOnly', icon: Zap, descKey: 'programming.cacheModeDescriptions.plexOnly' },
]

// Progress Step Icon
function StepIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />
    case 'running':
      return <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />
    default:
      return <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
  }
}

// Compact Progress Bar Component
interface ProgressBarProps {
  job: Job | null
  lastCompletedJob: Job | null
  expanded: boolean
  onToggle: () => void
}

function ProgressBar({ job, lastCompletedJob, expanded, onToggle }: ProgressBarProps) {
  const { t } = useTranslation()
  const displayJob = job || lastCompletedJob
  const isRunning = job?.status === 'pending' || job?.status === 'running'
  const isCompleted = displayJob?.status === 'completed'
  const isFailed = displayJob?.status === 'failed'

  if (!displayJob) return null

  const steps = displayJob.steps || []

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Compact header - always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isRunning ? 'bg-primary-100 dark:bg-primary-900/30' :
          isCompleted ? 'bg-green-100 dark:bg-green-900/30' :
          'bg-red-100 dark:bg-red-900/30'
        )}>
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
          ) : isCompleted ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-gray-900 dark:text-white">
              {isRunning ? t('programming.generationInProgress') : isCompleted ? t('programming.completed') : t('programming.failed')}
            </span>
            <span className="text-sm text-gray-500">{Math.round(displayJob.progress || 0)}%</span>
          </div>
          <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
            <div
              className={clsx(
                'absolute inset-y-0 left-0 transition-all duration-300 rounded-full',
                isCompleted ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-primary-500'
              )}
              style={{ width: `${displayJob.progress || 0}%` }}
            />
          </div>
        </div>

        {displayJob.bestScore != null && (
          <div className={clsx('text-lg font-bold', getScoreColor(displayJob.bestScore))}>
            {displayJob.bestScore.toFixed(1)}
          </div>
        )}

        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {/* Expanded details */}
      {expanded && steps.length > 0 && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="space-y-1.5">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2">
                <StepIcon status={step.status} />
                <span className={clsx(
                  'text-sm',
                  step.status === 'running' ? 'text-gray-900 dark:text-white font-medium' :
                  step.status === 'completed' ? 'text-gray-500 dark:text-gray-400' :
                  'text-gray-400 dark:text-gray-500'
                )}>
                  {step.label}
                </span>
                {step.detail && (
                  <span className="text-sm text-gray-400 truncate">- {step.detail}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Results Panel Component
interface ResultsPanelProps {
  result: ProgramResult
  profile: Profile | null
  previewOnly: boolean
  applying: boolean
  onApply: () => void
}

function ResultsPanel({ result, profile, previewOnly, applying, onApply }: ResultsPanelProps) {
  const { t } = useTranslation()
  const [view, setView] = useState<ResultView>('timeline')
  const [selectedIterationIdx, setSelectedIterationIdx] = useState(0)

  const allIterations = result.all_iterations || []
  const hasMultipleIterations = allIterations.length > 1

  const currentIteration = hasMultipleIterations ? allIterations[selectedIterationIdx] : null
  const displayPrograms = currentIteration?.programs || result.programs
  const displayScore = currentIteration?.average_score ?? currentIteration?.total_score ?? result.average_score ?? result.total_score ?? 0
  const displayIteration = currentIteration?.iteration ?? result.iteration ?? 1
  const isOptimized = currentIteration?.is_optimized ?? false
  const isImproved = currentIteration?.is_improved ?? false

  const totalMinutes = currentIteration?.total_duration_min || result.total_duration_min || 0
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  const durationText = hours > 0 ? `${hours}h${minutes > 0 ? minutes.toString().padStart(2, '0') : ''}` : `${minutes}min`

  const programDates = new Set(displayPrograms.map(p => new Date(p.start_time).toISOString().split('T')[0]))
  const daysCount = programDates.size

  const timeBlocks = result.time_blocks || profile?.time_blocks || []

  return (
    <div className="space-y-3">
      {/* Compact header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 sm:p-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Title */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-500" />
            <span className="font-medium text-sm text-gray-900 dark:text-white">
              {(isOptimized || isImproved) ? t('programming.optimized') : `#${displayIteration}`}
            </span>
            {isImproved && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                {t('programming.improved')}
              </span>
            )}
            {isOptimized && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                {t('programming.optimized')}
              </span>
            )}
          </div>

          {/* Stats */}
          <span className="text-xs text-gray-500">
            {displayPrograms.length} prog • {durationText} • {daysCount}j
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Iteration nav */}
          {hasMultipleIterations && (
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded p-0.5">
              <button
                onClick={() => setSelectedIterationIdx(i => Math.max(0, i - 1))}
                disabled={selectedIterationIdx === 0}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                {selectedIterationIdx + 1}/{allIterations.length}
              </span>
              <button
                onClick={() => setSelectedIterationIdx(i => Math.min(allIterations.length - 1, i + 1))}
                disabled={selectedIterationIdx === allIterations.length - 1}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* View toggle */}
          <div className="flex gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-700 rounded">
            <button
              onClick={() => setView('timeline')}
              className={clsx('p-1.5 rounded', view === 'timeline' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView('table')}
              className={clsx('p-1.5 rounded', view === 'table' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500')}
            >
              <Table className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Score */}
          <div className={clsx('text-lg font-bold', getScoreColor(displayScore))}>
            {displayScore.toFixed(1)}
          </div>

          {/* Apply */}
          {!previewOnly && (
            <button
              onClick={onApply}
              disabled={applying}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg disabled:opacity-50"
            >
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span className="hidden sm:inline">{t('programming.apply')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {view === 'timeline' && (
        <DayTimeline programs={displayPrograms} timeBlocks={timeBlocks} showScores={true} />
      )}
      {view === 'table' && (
        <ScoresTable programs={displayPrograms} timeBlocks={timeBlocks} profile={profile} maxHeight="450px" />
      )}
    </div>
  )
}

export function ProgrammingPage() {
  const { t } = useTranslation()

  // Data states
  const [channels, setChannels] = useState<TunarrChannel[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([])

  // Selection states
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)

  // Programming mode
  const [mode, setMode] = useState<ProgrammingMode>('profile')

  // Parameters
  const [iterations, setIterations] = useState(10)
  const [randomness, setRandomness] = useState(0.3)
  const [cacheMode, setCacheMode] = useState<CacheMode>('full')
  const [previewOnly, setPreviewOnly] = useState(false)
  const [replaceForbidden, setReplaceForbidden] = useState(false)
  const [improveBest, setImproveBest] = useState(false)
  const [durationDays, setDurationDays] = useState(1)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 16))

  // AI parameters
  const [aiPrompt, setAiPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [temperature, setTemperature] = useState(0.7)
  const [saveGeneratedProfile, _setSaveGeneratedProfile] = useState(false)
  const [generatedProfileName, _setGeneratedProfileName] = useState('')

  // UI states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formCollapsed, setFormCollapsed] = useState(false)
  const [progressExpanded, setProgressExpanded] = useState(true)

  // Job tracking
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [lastCompletedJob, setLastCompletedJob] = useState<Job | null>(null)
  const { getJob } = useJobsStore()
  const currentJob = currentJobId ? getJob(currentJobId) : null

  // Result
  const [result, setResult] = useState<ProgramResult | null>(null)
  const [applying, setApplying] = useState(false)

  const running = currentJob?.status === 'pending' || currentJob?.status === 'running'

  // Load initial data
  useEffect(() => {
    loadData()
  }, [])

  // Load profile details when selection changes
  useEffect(() => {
    if (selectedProfileId) {
      loadProfileDetails(selectedProfileId)
    } else {
      setSelectedProfile(null)
    }
  }, [selectedProfileId])

  // Set default parameters from profile
  useEffect(() => {
    if (selectedProfile) {
      setIterations(selectedProfile.default_iterations)
      setRandomness(selectedProfile.default_randomness)
    }
  }, [selectedProfile])

  // Watch for job completion - auto-collapse form and progress when results ready
  useEffect(() => {
    if (currentJob) {
      if (currentJob.status === 'completed') {
        setLastCompletedJob(currentJob)
        if (currentJob.result) {
          setResult(currentJob.result as unknown as ProgramResult)
          setFormCollapsed(true) // Auto-collapse form
          setProgressExpanded(false) // Auto-collapse progress
        }
        setCurrentJobId(null)
      } else if (currentJob.status === 'failed') {
        setLastCompletedJob(currentJob)
        setError(currentJob.errorMessage || t('common.errors.generic'))
        setCurrentJobId(null)
      }
    }
  }, [currentJob])

  // Auto-collapse form when generation starts
  useEffect(() => {
    if (running) {
      setFormCollapsed(true)
    }
  }, [running])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [channelsData, profilesData] = await Promise.all([
        tunarrApi.getChannels().catch(() => []),
        profilesApi.list()
      ])

      setChannels(channelsData)
      setProfiles(profilesData)

      if (channelsData.length > 0) setSelectedChannelId(channelsData[0].id)
      if (profilesData.length > 0) setSelectedProfileId(profilesData[0].id)

      try {
        const models = await ollamaApi.getModels()
        setOllamaModels(models)
        if (models.length > 0) setSelectedModel(models[0].name)
      } catch {
        // Ollama not configured
      }
    } catch (err) {
      setError(t('common.errors.loadingData'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadProfileDetails = async (profileId: string) => {
    try {
      const profile = await profilesApi.get(profileId)
      setSelectedProfile(profile)
    } catch {
      setSelectedProfile(null)
    }
  }

  const handleGenerate = async () => {
    if (!selectedChannelId) return
    if (mode === 'profile' && !selectedProfileId) return
    if (mode === 'ai' && !aiPrompt.trim()) return

    setError(null)
    setResult(null)
    setLastCompletedJob(null)
    setProgressExpanded(true)

    try {
      let response: { job_id: string; status: string; message: string }

      if (mode === 'profile') {
        const request: ProgrammingRequest = {
          channel_id: selectedChannelId,
          profile_id: selectedProfileId,
          iterations,
          randomness,
          cache_mode: cacheMode,
          preview_only: previewOnly,
          replace_forbidden: replaceForbidden,
          improve_best: improveBest,
          duration_days: durationDays,
          start_datetime: new Date(startDate).toISOString()
        }
        response = await programmingApi.generate(request)
      } else {
        const request: AIProgrammingRequest = {
          channel_id: selectedChannelId,
          prompt: aiPrompt,
          model: selectedModel || undefined,
          temperature,
          iterations,
          randomness,
          cache_mode: cacheMode,
          preview_only: previewOnly,
          duration_days: durationDays,
          start_datetime: new Date(startDate).toISOString(),
          save_profile: saveGeneratedProfile,
          profile_name: saveGeneratedProfile ? generatedProfileName : undefined
        }
        response = await programmingApi.generateWithAI(request)
      }

      setCurrentJobId(response.job_id)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('common.errors.generation')
      setError(errorMessage)
    }
  }

  const handleApply = async () => {
    if (!result) return

    setApplying(true)
    try {
      await programmingApi.apply(result.id)
      setResult(null)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('common.errors.apply')
      setError(errorMessage)
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with title and form toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {t('programming.title')}
        </h1>
        <button
          onClick={() => setFormCollapsed(!formCollapsed)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">Configuration</span>
          {formCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Progress bar - always visible when there's a job */}
      {(currentJob || lastCompletedJob) && (
        <ProgressBar
          job={currentJob || null}
          lastCompletedJob={lastCompletedJob}
          expanded={progressExpanded}
          onToggle={() => setProgressExpanded(!progressExpanded)}
        />
      )}

      {/* Collapsible form */}
      {!formCollapsed && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 space-y-4">
          {/* Quick row: Channel + Mode + Profile */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Channel */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('programming.selectChannel')}
              </label>
              <select
                value={selectedChannelId}
                onChange={e => setSelectedChannelId(e.target.value)}
                className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.number ? `${channel.number}. ` : ''}{channel.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Profile/AI mode */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('programming.mode')}
              </label>
              <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg h-[42px]">
                <button
                  onClick={() => setMode('profile')}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 rounded text-sm font-medium transition-colors',
                    mode === 'profile' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
                  )}
                >
                  <Play className="w-4 h-4" />
                  {t('programming.modeProfile')}
                </button>
                <button
                  onClick={() => setMode('ai')}
                  disabled={ollamaModels.length === 0}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 rounded text-sm font-medium transition-colors disabled:opacity-40',
                    mode === 'ai' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  {t('programming.modeAI')}
                </button>
              </div>
            </div>

            {/* Profile selector (profile mode) */}
            {mode === 'profile' && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('programming.selectProfile')}
                </label>
                <select
                  value={selectedProfileId}
                  onChange={e => setSelectedProfileId(e.target.value)}
                  className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* AI prompt (AI mode) */}
          {mode === 'ai' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('ai.prompt')}
              </label>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={t('ai.promptPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
          )}

          {/* Parameters row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                {t('programming.durationDays')}: <span className="font-medium">{t('historyPage.days', { count: durationDays })}</span>
              </label>
              <input
                type="range" min="1" max="30" value={durationDays}
                onChange={e => setDurationDays(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                {t('programming.iterations')}: <span className="font-medium">{iterations}</span>
              </label>
              <input
                type="range" min="1" max="100" value={iterations}
                onChange={e => setIterations(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                {t('programming.randomness')}: <span className="font-medium">{(randomness * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range" min="0" max="100" value={randomness * 100}
                onChange={e => setRandomness(Number(e.target.value) / 100)}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t('programming.start')}</label>
              <input
                type="datetime-local" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                    onClick={() => setCacheMode(option.value)}
                    title={t(option.descKey)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                      cacheMode === option.value
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
                onClick={() => setPreviewOnly(!previewOnly)}
                title={t('programming.previewOnlyDesc')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                  previewOnly
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                )}
              >
                <Eye className="w-4 h-4" />
                {t('programming.previewOnly')}
              </button>
              <button
                onClick={() => setReplaceForbidden(!replaceForbidden)}
                title={t('programming.replaceForbiddenDesc')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                  replaceForbidden
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                )}
              >
                <RefreshCw className="w-4 h-4" />
                {t('programming.replaceForbidden')}
              </button>
              <button
                onClick={() => setImproveBest(!improveBest)}
                title={t('programming.improveBestDesc')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                  improveBest
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                )}
              >
                <Zap className="w-4 h-4" />
                {t('programming.improveBest')}
              </button>
            </div>
          </div>

          {/* AI specific options */}
          {mode === 'ai' && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ai.model')}</label>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">{t('common.auto')}</option>
                  {ollamaModels.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  {t('ai.temperature')}: <span className="font-medium">{temperature.toFixed(1)}</span>
                </label>
                <input
                  type="range" min="0" max="1" step="0.1" value={temperature}
                  onChange={e => setTemperature(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
              </div>
            </div>
          )}

          {/* Generate button at bottom */}
          <div className="pt-2">
            <button
              onClick={handleGenerate}
              disabled={!selectedChannelId || (mode === 'profile' && !selectedProfileId) || (mode === 'ai' && !aiPrompt.trim()) || running}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 text-base font-medium"
            >
              {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              {running ? t('programming.generationInProgress') : t('programming.generate')}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && result.programs && (
        <ResultsPanel
          result={result}
          profile={selectedProfile}
          previewOnly={previewOnly}
          applying={applying}
          onApply={handleApply}
        />
      )}

      {/* Empty state when no results and form is collapsed */}
      {formCollapsed && !result && !running && !lastCompletedJob && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t('programming.emptyState')}</p>
        </div>
      )}
    </div>
  )
}
