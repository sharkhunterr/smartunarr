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
  XCircle
} from 'lucide-react'
import clsx from 'clsx'
import { profilesApi, tunarrApi, ollamaApi, programmingApi } from '@/services/api'
import { DayTimeline } from '@/components/timeline'
import {
  ScoresTable,
  getScoreColor,
  type TimeBlockWithCriteria,
  type OffsetResult
} from '@/components/scoring/ScoringDisplay'
import { useJobsStore, Job } from '@/stores/useJobsStore'
import type { Profile, TunarrChannel, OllamaModel, ProgramResult, ProgrammingRequest, AIProgrammingRequest, ProgramItem } from '@/types'

type CacheMode = 'none' | 'plex_only' | 'tmdb_only' | 'cache_only' | 'full' | 'enrich_cache'
type ProgrammingMode = 'profile' | 'ai'
type ResultView = 'timeline' | 'table'

const cacheModeOptions: { value: CacheMode; labelKey: string; icon: React.ElementType; description: string }[] = [
  { value: 'cache_only', labelKey: 'Cache', icon: Database, description: 'Utilise uniquement le cache existant' },
  { value: 'full', labelKey: 'Cache + Plex', icon: Database, description: 'Cache + nouveaux contenus Plex enrichis' },
  { value: 'enrich_cache', labelKey: 'Enrichir', icon: RefreshCw, description: 'Re-enrichit le cache avec TMDB (budget, revenue...)' },
  { value: 'plex_only', labelKey: 'Plex', icon: Zap, description: 'Récupère depuis Plex sans cache' },
]

// Helper to check if a program is the last one in its block
function isLastInBlock(programs: ProgramItem[], index: number): boolean {
  if (index >= programs.length - 1) return true
  return programs[index].block_name !== programs[index + 1].block_name
}

// Helper to check if a program is the first one in its block
function isFirstInBlock(programs: ProgramItem[], index: number): boolean {
  if (index === 0) return true
  return programs[index].block_name !== programs[index - 1].block_name
}

// Helper to calculate time offset from block boundaries
function calculateTimeOffset(
  programs: ProgramItem[],
  index: number,
  timeBlocks: Array<{ name: string; start_time: string; end_time: string }>
): { offset: number; status: 'early' | 'late' | 'on_time'; type: 'block_start' | 'block_end' | 'gap' } {
  const currProg = programs[index]
  const block = timeBlocks.find(b => b.name === currProg.block_name)

  // First program in a block: check offset from block start
  // Rule: can be early (negative offset OK) but NOT late (positive offset = bad)
  if (isFirstInBlock(programs, index) && block) {
    const progDate = new Date(currProg.start_time)
    const [blockH, blockM] = block.start_time.split(':').map(Number)
    const blockStart = new Date(progDate)
    blockStart.setHours(blockH, blockM, 0, 0)

    // Handle blocks that span midnight
    const progHour = progDate.getHours()
    if (blockH > 12 && progHour < 12) {
      // Block starts evening, program is morning = program is next day
      blockStart.setDate(blockStart.getDate() - 1)
    } else if (blockH < 12 && progHour > 12) {
      // Block starts morning, program is evening = block start was same day before
      blockStart.setDate(blockStart.getDate() + 1)
    }

    const offset = Math.round((progDate.getTime() - blockStart.getTime()) / 60000)

    // For first program: early is OK (shown as info), late is bad (shown as warning)
    if (Math.abs(offset) <= 2) return { offset: 0, status: 'on_time', type: 'block_start' }
    // Late start (after block start) - this is a problem
    if (offset > 0) return { offset, status: 'late', type: 'block_start' }
    // Early start (before block start) - this is fine
    return { offset, status: 'early', type: 'block_start' }
  }

  // Last program in a block: check if it overflows block end
  // Rule: can be early (ends before block end = OK) but NOT late (overflow = bad)
  if (isLastInBlock(programs, index) && block) {
    const progEndDate = new Date(currProg.end_time)
    const [blockEndH, blockEndM] = block.end_time.split(':').map(Number)
    const blockEnd = new Date(progEndDate)
    blockEnd.setHours(blockEndH, blockEndM, 0, 0)

    // Handle blocks that span midnight (end time < start time)
    const [blockStartH] = block.start_time.split(':').map(Number)
    if (blockEndH < blockStartH) {
      // Block spans midnight, so block end is next day
      if (progEndDate.getHours() >= blockStartH) {
        blockEnd.setDate(blockEnd.getDate() + 1)
      }
    }

    const offset = Math.round((progEndDate.getTime() - blockEnd.getTime()) / 60000)

    // For last program: ending before block end is OK, overflow is bad
    if (Math.abs(offset) <= 2) return { offset: 0, status: 'on_time', type: 'block_end' }
    // Overflow (program ends after block end) - this is a problem
    if (offset > 0) return { offset, status: 'late', type: 'block_end' }
    // Early end (before block end) - shown as info
    return { offset, status: 'early', type: 'block_end' }
  }

  // Middle programs: check gap from previous program
  if (index > 0) {
    const prevProg = programs[index - 1]
    const expectedStart = new Date(prevProg.end_time).getTime()
    const actualStart = new Date(currProg.start_time).getTime()
    const offset = Math.round((actualStart - expectedStart) / 60000)

    if (Math.abs(offset) <= 2) return { offset: 0, status: 'on_time', type: 'gap' }
    return { offset, status: offset > 0 ? 'late' : 'early', type: 'gap' }
  }

  return { offset: 0, status: 'on_time', type: 'gap' }
}

// Types imported from ScoringDisplay: TimeBlockWithCriteria, ScoresTable

// Wrapper to adapt calculateTimeOffset to ScoresTable's OffsetResult interface
function calculateTimeOffsetWrapper(
  programs: ProgramItem[],
  index: number,
  timeBlocks: TimeBlockWithCriteria[]
): OffsetResult {
  return calculateTimeOffset(programs, index, timeBlocks)
}

// Progress Panel Component
interface ProgressPanelProps {
  job: Job | null
  lastCompletedJob: Job | null
}

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

function ProgressPanel({ job, lastCompletedJob }: ProgressPanelProps) {
  const displayJob = job || lastCompletedJob
  const isRunning = job?.status === 'pending' || job?.status === 'running'
  const isCompleted = displayJob?.status === 'completed'
  const isFailed = displayJob?.status === 'failed'

  if (!displayJob) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-fit">
        <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
          <Clock className="w-5 h-5" />
          <span className="text-sm">Aucune progression en cours</span>
        </div>
      </div>
    )
  }

  const steps = displayJob.steps || []

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4 h-fit sticky top-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={clsx(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
          isRunning ? 'bg-primary-100 dark:bg-primary-900/30' :
          isCompleted ? 'bg-green-100 dark:bg-green-900/30' :
          'bg-red-100 dark:bg-red-900/30'
        )}>
          {isRunning ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          ) : isCompleted ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white">
            {isRunning ? 'Génération en cours' : isCompleted ? 'Génération terminée' : 'Échec'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {displayJob.currentStep || (isCompleted ? 'Terminé avec succès' : displayJob.errorMessage)}
          </p>
        </div>
      </div>

      {/* Main progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>Progression</span>
          <span>{Math.round(displayJob.progress || 0)}%</span>
        </div>
        <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              'absolute inset-y-0 left-0 transition-all duration-300 rounded-full',
              isCompleted ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-gradient-to-r from-primary-500 to-primary-600'
            )}
            style={{ width: `${displayJob.progress || 0}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Étapes</div>
          {steps.map((step) => (
            <div key={step.id} className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <StepIcon status={step.status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={clsx(
                  'text-sm',
                  step.status === 'completed' ? 'text-gray-600 dark:text-gray-400' :
                  step.status === 'running' ? 'text-gray-900 dark:text-white font-medium' :
                  'text-gray-400 dark:text-gray-500'
                )}>
                  {step.label}
                </div>
                {step.detail && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                    {step.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Score */}
      {displayJob.bestScore != null && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Score final</span>
            <span className={clsx('text-xl font-bold', getScoreColor(displayJob.bestScore))}>
              {displayJob.bestScore.toFixed(1)}
            </span>
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
  const [view, setView] = useState<ResultView>('timeline')
  const [selectedIterationIdx, setSelectedIterationIdx] = useState(0)

  // Get all iterations (sorted best to worst from backend)
  const allIterations = result.all_iterations || []
  const hasMultipleIterations = allIterations.length > 1

  // Get current iteration data
  const currentIteration = hasMultipleIterations
    ? allIterations[selectedIterationIdx]
    : null
  const displayPrograms = currentIteration?.programs || result.programs
  const displayScore = currentIteration?.average_score ?? currentIteration?.total_score ?? result.average_score ?? result.total_score ?? 0
  const displayIteration = currentIteration?.iteration ?? result.iteration ?? 1
  const isOptimized = currentIteration?.is_optimized ?? false
  const isImproved = currentIteration?.is_improved ?? false

  const totalMinutes = currentIteration?.total_duration_min || result.total_duration_min || 0
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  const durationText = hours > 0
    ? `${hours}h${minutes > 0 ? minutes.toString().padStart(2, '0') : ''}`
    : `${minutes}min`

  const programDates = new Set(
    displayPrograms.map(p => new Date(p.start_time).toISOString().split('T')[0])
  )
  const daysCount = programDates.size

  // Get time blocks from result or profile
  const timeBlocks = result.time_blocks || profile?.time_blocks || []

  // Navigation handlers
  const goToPrevIteration = () => {
    setSelectedIterationIdx(idx => Math.max(0, idx - 1))
  }
  const goToNextIteration = () => {
    setSelectedIterationIdx(idx => Math.min(allIterations.length - 1, idx + 1))
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        {/* Mobile: stacked layout, Desktop: flex row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Title and info */}
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-primary-500 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                  {(isOptimized || isImproved) ? 'Optimisé' : `Résultat #${displayIteration}`}
                </h2>
                {isImproved && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                    <Zap className="w-3 h-3" />
                    Amélioré
                  </span>
                )}
                {isOptimized && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                    <Sparkles className="w-3 h-3" />
                    Sans interdits
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {displayPrograms.length} prog. • {durationText} • {daysCount}j
              </p>
            </div>
          </div>

          {/* Controls - wrap on mobile */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Iteration navigation */}
            {hasMultipleIterations && (
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={goToPrevIteration}
                  disabled={selectedIterationIdx === 0}
                  className="p-1 sm:p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Itération précédente"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
                <span className="px-1.5 sm:px-2 text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[50px] sm:min-w-[60px] text-center">
                  {selectedIterationIdx + 1} / {allIterations.length}
                </span>
                <button
                  onClick={goToNextIteration}
                  disabled={selectedIterationIdx === allIterations.length - 1}
                  className="p-1 sm:p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Itération suivante"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            )}

            {/* View toggle */}
            <div className="flex gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-700 rounded-md">
              <button
                onClick={() => setView('timeline')}
                className={clsx(
                  'p-1.5 rounded transition-colors',
                  view === 'timeline' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
                title="Timeline visuelle"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('table')}
                className={clsx(
                  'p-1.5 rounded transition-colors',
                  view === 'table' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
                title="Tableau des scores"
              >
                <Table className="w-4 h-4" />
              </button>
            </div>

            {/* Score */}
            <div className="text-right">
              <div className="text-xs text-gray-500 hidden sm:block">Score</div>
              <div className={clsx('text-base sm:text-lg font-bold', getScoreColor(displayScore))}>
                {displayScore.toFixed(1)}
              </div>
            </div>

            {/* Apply button */}
            {!previewOnly && (
              <button
                onClick={onApply}
                disabled={applying}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span className="hidden sm:inline">Appliquer</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View content */}
      {view === 'timeline' && (
        <DayTimeline
          programs={displayPrograms}
          timeBlocks={timeBlocks}
          showScores={true}
        />
      )}
      {view === 'table' && (
        <ScoresTable
          programs={displayPrograms}
          timeBlocks={timeBlocks}
          profile={profile}
          showOffset={true}
          calculateOffset={calculateTimeOffsetWrapper}
          maxHeight="450px"
        />
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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [durationDays, setDurationDays] = useState(1)
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 16)
  })

  // AI parameters
  const [aiPrompt, setAiPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [temperature, setTemperature] = useState(0.7)
  const [saveGeneratedProfile, _setSaveGeneratedProfile] = useState(false)
  const [generatedProfileName, _setGeneratedProfileName] = useState('')

  // Loading states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Job tracking - keep last completed job for display
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [lastCompletedJob, setLastCompletedJob] = useState<Job | null>(null)
  const { getJob } = useJobsStore()
  const currentJob = currentJobId ? getJob(currentJobId) : null

  // Result
  const [result, setResult] = useState<ProgramResult | null>(null)
  const [applying, setApplying] = useState(false)

  // Derived state
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

  // Watch for job completion
  useEffect(() => {
    if (currentJob) {
      if (currentJob.status === 'completed') {
        setLastCompletedJob(currentJob)
        if (currentJob.result) {
          setResult(currentJob.result as unknown as ProgramResult)
        }
        setCurrentJobId(null)
      } else if (currentJob.status === 'failed') {
        setLastCompletedJob(currentJob)
        setError(currentJob.errorMessage || 'Une erreur est survenue')
        setCurrentJobId(null)
      }
    }
  }, [currentJob])

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

      if (channelsData.length > 0) {
        setSelectedChannelId(channelsData[0].id)
      }
      if (profilesData.length > 0) {
        setSelectedProfileId(profilesData[0].id)
      }

      try {
        const models = await ollamaApi.getModels()
        setOllamaModels(models)
        if (models.length > 0) {
          setSelectedModel(models[0].name)
        }
      } catch {
        // Ollama not configured
      }
    } catch (err) {
      setError('Erreur lors du chargement des données')
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
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la génération'
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
      const errorMessage = err instanceof Error ? err.message : "Erreur lors de l'application"
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
    <div className="space-y-3 sm:space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
        {t('programming.title')}
      </h1>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1fr,320px]">
        {/* Left column - Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Channel selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('programming.selectChannel')}
            </label>
            {channels.length === 0 ? (
              <div className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {t('programming.noChannels')}
              </div>
            ) : (
              <select
                value={selectedChannelId}
                onChange={e => setSelectedChannelId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.number ? `${channel.number}. ` : ''}{channel.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <button
              onClick={() => setMode('profile')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                mode === 'profile'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Play className="w-4 h-4" />
              Via Profil
            </button>
            <button
              onClick={() => setMode('ai')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                mode === 'ai'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
              disabled={ollamaModels.length === 0}
            >
              <Sparkles className="w-4 h-4" />
              {t('ai.title')}
            </button>
          </div>

          {/* Profile mode */}
          {mode === 'profile' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('programming.selectProfile')}
              </label>
              {profiles.length === 0 ? (
                <div className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {t('programming.noProfiles')}
                </div>
              ) : (
                <select
                  value={selectedProfileId}
                  onChange={e => setSelectedProfileId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} (v{profile.version})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* AI mode */}
          {mode === 'ai' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('ai.prompt')}
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder={t('ai.promptPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('ai.model')}
                  </label>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">{t('ai.autoModel')}</option>
                    {ollamaModels.map(model => (
                      <option key={model.name} value={model.name}>{model.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('ai.temperature')}: {temperature.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={e => setTemperature(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Schedule parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Durée: {durationDays}j
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={durationDays}
                onChange={e => setDurationDays(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Début
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Common parameters */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Itérations: {iterations}
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={iterations}
                onChange={e => setIterations(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Aléatoire: {(randomness * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={randomness * 100}
                onChange={e => setRandomness(Number(e.target.value) / 100)}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
            </div>
          </div>

          {/* Advanced options toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
          >
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Options avancées
          </button>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Mode de cache
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {cacheModeOptions.map(option => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.value}
                        onClick={() => setCacheMode(option.value)}
                        title={option.description}
                        className={clsx(
                          'flex items-center gap-1 px-2 py-1.5 rounded border text-xs transition-colors',
                          cacheMode === option.value
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        <span className="truncate">{option.labelKey}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={previewOnly}
                  onChange={e => setPreviewOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <Eye className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  Aperçu uniquement
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceForbidden}
                  onChange={e => setReplaceForbidden(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  Remplacer contenus interdits
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={improveBest}
                  onChange={e => setImproveBest(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <Zap className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  Améliorer avec meilleurs programmes
                </span>
              </label>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleGenerate}
              disabled={
                !selectedChannelId ||
                (mode === 'profile' && !selectedProfileId) ||
                (mode === 'ai' && !aiPrompt.trim()) ||
                running
              }
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Génération...
                </>
              ) : mode === 'ai' ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Générer (IA)
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Générer
                </>
              )}
            </button>

            <button
              onClick={loadData}
              disabled={running}
              className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right column - Progress */}
        <ProgressPanel job={currentJob || null} lastCompletedJob={lastCompletedJob} />
      </div>

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
    </div>
  )
}
