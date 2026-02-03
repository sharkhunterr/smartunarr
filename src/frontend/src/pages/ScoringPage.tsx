import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileJson,
  FileSpreadsheet,
  Database,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  Settings2,
  Calendar
} from 'lucide-react'
import clsx from 'clsx'
import { profilesApi, tunarrApi, scoringApi } from '@/services/api'
import { useJobsStore, Job } from '@/stores/useJobsStore'
import {
  ScoresTable,
  getScoreColor,
  CRITERION_LABELS,
  BLOCK_COLORS,
  type TimeBlockWithCriteria
} from '@/components/scoring/ScoringDisplay'
import type { Profile, TunarrChannel, ScoringResult, ScoringCacheMode, MFPPolicy, CriterionMultipliers } from '@/types'

const cacheModeOptions: { value: ScoringCacheMode; labelKey: string; icon: React.ElementType; descKey: string }[] = [
  { value: 'cache_only', labelKey: 'scoring.cacheModes.cacheOnly', icon: Database, descKey: 'scoring.cacheModeDescriptions.cacheOnly' },
  { value: 'full', labelKey: 'scoring.cacheModes.full', icon: Zap, descKey: 'scoring.cacheModeDescriptions.full' },
  { value: 'none', labelKey: 'scoring.cacheModes.none', icon: XCircle, descKey: 'scoring.cacheModeDescriptions.none' },
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

// Compact Progress Bar Component (same pattern as ProgrammingPage)
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
              {isRunning ? t('scoring.analysisInProgress') : isCompleted ? t('scoring.analysisCompleted') : t('programming.failed')}
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

// Block Settings Legend Component
interface BlockSettingsLegendProps {
  timeBlocks: TimeBlockWithCriteria[]
  profile?: Profile | null
}

function BlockSettingsLegend({ timeBlocks, profile }: BlockSettingsLegendProps) {
  const { t } = useTranslation()
  if (!timeBlocks || timeBlocks.length === 0) return null

  // Check if any block has custom MFP or multipliers
  const hasCustomSettings = timeBlocks.some(block => {
    const criteria = block.criteria
    return criteria?.mfp_policy || criteria?.criterion_multipliers
  })

  if (!hasCustomSettings && !profile?.mfp_policy && !profile?.criterion_multipliers) return null

  const defaultMFP = {
    mandatory_matched_bonus: profile?.mfp_policy?.mandatory_matched_bonus ?? 10,
    mandatory_missed_penalty: profile?.mfp_policy?.mandatory_missed_penalty ?? -40,
    forbidden_detected_penalty: profile?.mfp_policy?.forbidden_detected_penalty ?? -400,
    preferred_matched_bonus: profile?.mfp_policy?.preferred_matched_bonus ?? 20
  }

  const formatMFP = (mfp: MFPPolicy | undefined, isDefault: boolean = false) => {
    const policy = mfp || defaultMFP
    const label = isDefault ? t('scoring.default') : ''
    return (
      <span className="text-[9px]">
        <span className="text-orange-500">M:{(policy.mandatory_matched_bonus ?? 0) > 0 ? '+' : ''}{policy.mandatory_matched_bonus ?? 0}/{policy.mandatory_missed_penalty ?? 0}</span>
        {' '}
        <span className="text-red-500">F:{policy.forbidden_detected_penalty}</span>
        {' '}
        <span className="text-green-500">P:+{policy.preferred_matched_bonus}</span>
        {label && <span className="text-gray-400 ml-1">{label}</span>}
      </span>
    )
  }

  const formatMultipliers = (multipliers: CriterionMultipliers | undefined): string => {
    if (!multipliers) return ''
    const nonDefault = Object.entries(multipliers)
      .filter(([, val]) => val !== 1.0 && val !== undefined)
      .map(([key, val]) => `${CRITERION_LABELS[key] || key}:×${(val as number)?.toFixed(1)}`)
    return nonDefault.join(', ')
  }

  return (
    <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('scoring.mfpSettings')}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {timeBlocks.map((block, idx) => {
          const blockMFP = block.criteria?.mfp_policy
          const blockMultipliers = formatMultipliers(block.criteria?.criterion_multipliers)
          const hasCustom = blockMFP || blockMultipliers
          const blockColor = BLOCK_COLORS[idx % BLOCK_COLORS.length]

          return (
            <div
              key={block.name}
              className={clsx(
                'p-1.5 rounded text-xs',
                hasCustom ? blockColor.bg : 'bg-white dark:bg-gray-800',
                'border border-gray-200 dark:border-gray-600'
              )}
            >
              <div className={clsx('font-medium truncate mb-0.5', hasCustom ? blockColor.text : 'text-gray-600 dark:text-gray-400')}>
                {block.name}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                {block.start_time} - {block.end_time}
              </div>
              {blockMFP ? (
                <div className="mt-0.5">{formatMFP(blockMFP)}</div>
              ) : (
                <div className="mt-0.5 text-gray-400 text-[9px]">{t('scoring.mfpDefault')}</div>
              )}
              {blockMultipliers ? (
                <div className="text-[9px] text-purple-600 dark:text-purple-400 mt-0.5 truncate" title={blockMultipliers}>
                  {blockMultipliers}
                </div>
              ) : (
                <div className="text-[9px] text-gray-400 mt-0.5">{t('scoring.allMultipliers')}</div>
              )}
            </div>
          )
        })}
      </div>
      {/* Profile defaults */}
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-400">
        <span className="font-medium">{t('scoring.profileDefaults')}</span> {formatMFP(profile?.mfp_policy, true)}
        {profile?.criterion_multipliers && formatMultipliers(profile.criterion_multipliers) && (
          <span className="ml-2 text-purple-500">| {formatMultipliers(profile.criterion_multipliers)}</span>
        )}
      </div>
    </div>
  )
}

// Results Panel Component
interface ResultsPanelProps {
  result: ScoringResult
  profile: Profile | null
  exporting: boolean
  onExportCSV: () => void
  onExportJSON: () => void
}

function ResultsPanel({ result, profile, exporting, onExportCSV, onExportJSON }: ResultsPanelProps) {
  const { t } = useTranslation()
  const timeBlocks = (result.time_blocks || profile?.time_blocks || []) as TimeBlockWithCriteria[]

  return (
    <div className="space-y-3">
      {/* Compact header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 sm:p-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Title */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-500" />
            <span className="font-medium text-sm text-gray-900 dark:text-white">
              {result.channel_name}
            </span>
          </div>

          {/* Stats */}
          <span className="text-xs text-gray-500">
            {result.total_items} {t('scoring.programs')} • {result.violations_count} violations
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Export buttons */}
          <div className="flex gap-1">
            <button
              onClick={onExportCSV}
              disabled={exporting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={onExportJSON}
              disabled={exporting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <FileJson className="w-4 h-4" />
              <span className="hidden sm:inline">JSON</span>
            </button>
          </div>

          {/* Score */}
          <div className={clsx('text-lg font-bold', getScoreColor(result.average_score))}>
            {result.average_score.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Block settings legend */}
      <BlockSettingsLegend timeBlocks={timeBlocks} profile={profile} />

      {/* Scores table */}
      <ScoresTable
        programs={result.programs || []}
        timeBlocks={timeBlocks}
        profile={profile}
      />
    </div>
  )
}

export function ScoringPage() {
  const { t } = useTranslation()

  // Data states
  const [channels, setChannels] = useState<TunarrChannel[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])

  // Selection states
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [cacheMode, setCacheMode] = useState<ScoringCacheMode>('full')

  // UI states
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formCollapsed, setFormCollapsed] = useState(false)
  const [progressExpanded, setProgressExpanded] = useState(true)

  // Job tracking
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [lastCompletedJob, setLastCompletedJob] = useState<Job | null>(null)
  const { getJob } = useJobsStore()
  const currentJob = currentJobId ? getJob(currentJobId) : null

  // Derived state
  const analyzing = currentJob?.status === 'pending' || currentJob?.status === 'running'

  // Result states
  const [result, setResult] = useState<ScoringResult | null>(null)

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

  // Watch for job completion - auto-collapse form and progress when results ready
  useEffect(() => {
    if (currentJob) {
      if (currentJob.status === 'completed') {
        setLastCompletedJob(currentJob)
        if (currentJob.result) {
          setResult(currentJob.result as unknown as ScoringResult)
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

  // Auto-collapse form when analysis starts
  useEffect(() => {
    if (analyzing) {
      setFormCollapsed(true)
    }
  }, [analyzing])

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

  const handleAnalyze = async () => {
    if (!selectedChannelId || !selectedProfileId) return

    setError(null)
    setResult(null)
    setLastCompletedJob(null)
    setProgressExpanded(true)

    try {
      const response = await scoringApi.analyze({
        channel_id: selectedChannelId,
        profile_id: selectedProfileId,
        cache_mode: cacheMode
      })
      setCurrentJobId(response.job_id)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('common.errors.analysis')
      setError(errorMessage)
    }
  }

  const handleExportCSV = async () => {
    if (!result) return

    setExporting(true)
    try {
      const blob = await scoringApi.exportCSV(result.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scoring-${result.channel_name}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('common.errors.export')
      setError(errorMessage)
    } finally {
      setExporting(false)
    }
  }

  const handleExportJSON = async () => {
    if (!result) return

    setExporting(true)
    try {
      const data = await scoringApi.exportJSON(result.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scoring-${result.channel_name}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('common.errors.export')
      setError(errorMessage)
    } finally {
      setExporting(false)
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
          {t('scoring.title')}
        </h1>
        <button
          onClick={() => setFormCollapsed(!formCollapsed)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">{t('programming.configuration')}</span>
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
          {/* Quick row: Channel + Profile */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Channel */}
            <div className="flex-1">
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
                  className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  {channels.map(channel => (
                    <option key={channel.id} value={channel.id}>
                      {channel.number ? `${channel.number}. ` : ''}{channel.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Profile */}
            <div className="flex-1">
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
                  className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} (v{profile.version})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Cache mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('scoring.enrichmentMode')}
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

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleAnalyze}
              disabled={!selectedChannelId || !selectedProfileId || analyzing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 text-base font-medium"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              {t('scoring.analyze')}
            </button>

            <button
              onClick={loadData}
              disabled={analyzing}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <ResultsPanel
          result={result}
          profile={selectedProfile}
          exporting={exporting}
          onExportCSV={handleExportCSV}
          onExportJSON={handleExportJSON}
        />
      )}

      {/* Empty state when no results and form is collapsed */}
      {formCollapsed && !result && !analyzing && !lastCompletedJob && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t('programming.emptyState')}</p>
        </div>
      )}
    </div>
  )
}
