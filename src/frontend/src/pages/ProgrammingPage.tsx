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
  Settings2,
  Tv
} from 'lucide-react'
import clsx from 'clsx'
import { profilesApi, tunarrApi, ollamaApi, programmingApi } from '@/services/api'
import { DayTimeline } from '@/components/timeline'
import { ServiceStatusBanner } from '@/components/ServiceStatusBanner'
import {
  ScoresTable,
  getScoreColor,
} from '@/components/scoring/ScoringDisplay'
import { useJobsStore, Job } from '@/stores/useJobsStore'
import type { Profile, TunarrChannel, OllamaModel, ProgramResult, ProgrammingRequest } from '@/types'

type CacheMode = 'none' | 'plex_only' | 'tmdb_only' | 'cache_only' | 'full' | 'enrich_cache'
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
  ollamaModels?: OllamaModel[]
  onAiRequest?: (prompt: string, model?: string) => Promise<void>
  onApplyModification?: (originalTitle: string, replacementTitle: string) => Promise<void>
  aiLoading?: boolean
  aiResponse?: { analysis?: string; modifications?: Array<{ action: string; original_title: string; replacement_title?: string; reason: string }>; summary?: string } | null
}

function ResultsPanel({ result, profile, previewOnly, applying, onApply, ollamaModels = [], onAiRequest, onApplyModification, aiLoading = false, aiResponse: externalAiResponse }: ResultsPanelProps) {
  const { t } = useTranslation()
  const [view, setView] = useState<ResultView>('timeline')
  const [selectedIterationIdx, setSelectedIterationIdx] = useState(0)
  const [aiDropdownOpen, setAiDropdownOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [selectedAiModel, setSelectedAiModel] = useState('')
  const [applyingMod, setApplyingMod] = useState<string | null>(null)

  // AI response can come from result or external state
  const aiResponse = externalAiResponse || result.ai_response

  const allIterations = result.all_iterations || []
  const hasMultipleIterations = allIterations.length > 1

  const currentIteration = hasMultipleIterations ? allIterations[selectedIterationIdx] : null
  const displayPrograms = currentIteration?.programs || result.programs
  const displayScore = currentIteration?.average_score ?? currentIteration?.total_score ?? result.average_score ?? result.total_score ?? 0
  const displayIteration = currentIteration?.iteration ?? result.iteration ?? 1
  const isOptimized = currentIteration?.is_optimized ?? false
  const isImproved = currentIteration?.is_improved ?? false
  const isAiImproved = currentIteration?.is_ai_improved ?? false

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
              {(isOptimized || isImproved || isAiImproved) ? t('programming.optimized') : `#${displayIteration}`}
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
            {isAiImproved && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {t('programming.aiImproved')}
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

          {/* AI Button with dropdown */}
          {ollamaModels.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setAiDropdownOpen(!aiDropdownOpen)}
                className={clsx(
                  'flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                  (aiResponse?.modifications?.length || displayPrograms.some(p => p.is_ai_improved))
                    ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-purple-300'
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiResponse?.modifications?.length || displayPrograms.filter(p => p.is_ai_improved).length}</span>
                <ChevronDown className={clsx('w-3 h-3 transition-transform', aiDropdownOpen && 'rotate-180')} />
              </button>

              {/* Dropdown */}
              {aiDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-[70vh] overflow-y-auto">
                  <div className="p-3 space-y-3">
                    {/* AI Response section */}
                    {aiResponse && (
                      <div>
                        <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          {t('programming.aiResponse')}
                        </div>

                        {/* Analysis */}
                        {aiResponse.analysis && (
                          <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs text-gray-700 dark:text-gray-300">
                            <div className="font-medium text-gray-500 dark:text-gray-400 mb-1">{t('programming.aiAnalysis')}</div>
                            {aiResponse.analysis}
                          </div>
                        )}

                        {/* Summary */}
                        {aiResponse.summary && (
                          <div className="mb-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-xs text-purple-700 dark:text-purple-300">
                            {aiResponse.summary}
                          </div>
                        )}

                        {/* Proposed modifications */}
                        {aiResponse.modifications && aiResponse.modifications.length > 0 ? (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                {t('programming.aiProposedChanges')} ({aiResponse.modifications.length})
                              </span>
                              {onApplyModification && aiResponse.modifications.filter(m => m.action === 'replace' && m.replacement_title).length > 1 && (
                                <button
                                  onClick={async () => {
                                    for (const mod of aiResponse.modifications || []) {
                                      if (mod.action === 'replace' && mod.replacement_title) {
                                        await onApplyModification(mod.original_title, mod.replacement_title)
                                      }
                                    }
                                  }}
                                  disabled={applyingMod !== null}
                                  className="text-[10px] px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
                                >
                                  {t('programming.aiApplyAll')}
                                </button>
                              )}
                            </div>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {aiResponse.modifications.map((mod, idx) => (
                                <div key={idx} className="text-xs p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-gray-500 dark:text-gray-400 line-through truncate">{mod.original_title}</div>
                                      {mod.replacement_title && (
                                        <div className="font-medium text-purple-700 dark:text-purple-300 truncate">→ {mod.replacement_title}</div>
                                      )}
                                      {mod.reason && (
                                        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{mod.reason}</div>
                                      )}
                                    </div>
                                    {onApplyModification && mod.action === 'replace' && mod.replacement_title && (
                                      <button
                                        onClick={async () => {
                                          setApplyingMod(mod.original_title)
                                          try {
                                            await onApplyModification(mod.original_title, mod.replacement_title!)
                                          } finally {
                                            setApplyingMod(null)
                                          }
                                        }}
                                        disabled={applyingMod !== null}
                                        className="flex-shrink-0 px-2 py-1 text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50"
                                      >
                                        {applyingMod === mod.original_title ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          t('programming.aiApplyOne')
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 dark:text-gray-500 italic">
                            {t('programming.aiNoChanges')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Already applied modifications */}
                    {displayPrograms.filter(p => p.is_ai_improved).length > 0 && (
                      <div className={aiResponse ? 'border-t border-gray-200 dark:border-gray-700 pt-3' : ''}>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                          {t('programming.aiModifiedPrograms')} ({displayPrograms.filter(p => p.is_ai_improved).length})
                        </div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {displayPrograms.filter(p => p.is_ai_improved).map((prog, idx) => (
                            <div key={idx} className="text-xs p-2 bg-green-50 dark:bg-green-900/20 rounded">
                              <div className="font-medium text-green-900 dark:text-green-100">{prog.title}</div>
                              {prog.replaced_title && (
                                <div className="text-green-600 dark:text-green-400 mt-0.5 text-[10px]">
                                  {t('programming.aiOriginal')}: {prog.replaced_title}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New AI request section */}
                    <div className={(aiResponse || displayPrograms.filter(p => p.is_ai_improved).length > 0) ? 'border-t border-gray-200 dark:border-gray-700 pt-3' : ''}>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        {t('programming.aiNewRequest')}
                      </div>
                      <div className="flex items-start gap-2 mb-2 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-amber-700 dark:text-amber-400 text-[10px]">
                        <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>{t('programming.aiExperimental')}</span>
                      </div>
                      {ollamaModels.length > 1 && (
                        <select
                          value={selectedAiModel}
                          onChange={e => setSelectedAiModel(e.target.value)}
                          className="w-full mb-2 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">{t('common.auto')}</option>
                          {ollamaModels.map(m => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      )}
                      <textarea
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                        placeholder={t('programming.aiRequestPlaceholder')}
                        rows={2}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 resize-none"
                      />
                      <button
                        onClick={() => {
                          if (aiPrompt.trim() && onAiRequest) {
                            onAiRequest(aiPrompt.trim(), selectedAiModel || undefined)
                            setAiPrompt('')
                          }
                        }}
                        disabled={!aiPrompt.trim() || aiLoading}
                        className={clsx(
                          'w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors',
                          aiPrompt.trim()
                            ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed',
                          aiLoading && 'opacity-70'
                        )}
                      >
                        {aiLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {t('programming.aiProcessing')}
                          </>
                        ) : aiPrompt.trim() ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            {t('programming.aiSend')}
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            {t('programming.aiEnterPrompt')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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

      {/* AI Summary - shown when viewing AI-improved iteration */}
      {isAiImproved && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="font-medium text-purple-900 dark:text-purple-100">
              {t('programming.aiSummaryTitle')}
            </span>
            <span className="text-sm text-purple-600 dark:text-purple-400">
              {displayPrograms.filter(p => p.is_ai_improved).length} {t('programming.aiModificationsCount')}
            </span>
          </div>
          {result.ai_response?.summary && (
            <p className="mt-2 text-sm text-purple-800 dark:text-purple-200">
              {result.ai_response.summary}
            </p>
          )}
        </div>
      )}

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

  // Parameters
  const [iterations, setIterations] = useState(10)
  const [randomness, setRandomness] = useState(0.3)
  const [cacheMode, setCacheMode] = useState<CacheMode>('full')
  const [previewOnly, setPreviewOnly] = useState(false)
  const [replaceForbidden, setReplaceForbidden] = useState(false)
  const [improveBest, setImproveBest] = useState(false)
  const [aiImprove, setAiImprove] = useState(false)
  const [aiPromptForm, setAiPromptForm] = useState('')
  const [selectedAiModelForm, setSelectedAiModelForm] = useState('')
  const [durationDays, setDurationDays] = useState(1)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 16))

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
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResponse, setAiResponse] = useState<{ analysis?: string; modifications?: Array<{ action: string; original_title: string; replacement_title?: string; reason: string }>; summary?: string } | null>(null)

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
    if (!selectedChannelId || !selectedProfileId) return

    setError(null)
    setResult(null)
    setLastCompletedJob(null)
    setProgressExpanded(true)

    try {
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
        start_datetime: new Date(startDate).toISOString(),
        ai_improve: aiImprove,
        ai_prompt: aiImprove ? aiPromptForm : undefined,
        ai_model: aiImprove && selectedAiModelForm ? selectedAiModelForm : undefined
      }
      const response = await programmingApi.generate(request)
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

  const handleAiRequest = async (prompt: string, model?: string) => {
    if (!result) return

    setAiLoading(true)
    setAiResponse(null) // Clear previous response
    setError(null) // Clear any previous error
    try {
      console.log('[AI Request] Sending request for result:', result.id)
      const response = await programmingApi.improveWithAI({
        result_id: result.id,
        prompt,
        model: model || undefined,
        temperature: 0.5
      })
      console.log('[AI Request] Response received:', response)

      // Store AI response for display - always set, even if empty
      const suggestions = response.suggestions as { analysis?: string; modifications?: Array<{ action: string; original_title: string; replacement_title?: string; reason: string }>; summary?: string } | undefined
      if (suggestions) {
        console.log('[AI Request] Setting aiResponse:', suggestions)
        setAiResponse(suggestions)
      } else {
        // Fallback if no suggestions - still show that AI responded
        console.log('[AI Request] No suggestions in response, setting fallback')
        setAiResponse({
          analysis: t('programming.aiNoChanges'),
          modifications: [],
          summary: ''
        })
      }

      // Refresh the result to get updated programs
      if (response.result_id) {
        const updatedResult = await programmingApi.getResult(response.result_id)
        setResult(updatedResult)
      }
    } catch (err: unknown) {
      console.error('[AI Request] Error:', err)
      const errorMessage = err instanceof Error ? err.message : t('common.errors.generic')
      setError(errorMessage)
      // Set a response showing the error
      setAiResponse({
        analysis: errorMessage,
        modifications: [],
        summary: ''
      })
    } finally {
      setAiLoading(false)
    }
  }

  const handleApplyModification = async (originalTitle: string, replacementTitle: string) => {
    if (!result) return

    console.log('[Apply Modification]', originalTitle, '->', replacementTitle)
    try {
      const response = await programmingApi.applyAIModification(result.id, originalTitle, replacementTitle)
      if (response.success) {
        console.log('[Apply Modification] Success:', response)
        // Refresh result to get updated programs
        const updatedResult = await programmingApi.getResult(result.id)
        setResult(updatedResult)

        // Remove applied modification from AI response
        if (aiResponse?.modifications) {
          setAiResponse({
            ...aiResponse,
            modifications: aiResponse.modifications.filter(m => m.original_title !== originalTitle)
          })
        }
      }
    } catch (err: unknown) {
      console.error('[Apply Modification] Error:', err)
      // Extract error message from axios response or generic error
      let errorMessage = t('common.errors.generic')
      if (err && typeof err === 'object') {
        const axiosError = err as { response?: { data?: { detail?: string } }; message?: string }
        if (axiosError.response?.data?.detail) {
          errorMessage = axiosError.response.data.detail
        } else if (axiosError.message) {
          errorMessage = axiosError.message
        }
      }
      setError(errorMessage)
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
        <div className="flex items-center gap-2 sm:gap-3">
          <Tv className="w-6 h-6 sm:w-8 sm:h-8 text-primary-500" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {t('programming.title')}
          </h1>
        </div>
        <button
          onClick={() => setFormCollapsed(!formCollapsed)}
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">{t('programming.configuration')}</span>
          {formCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Service status banner */}
      <ServiceStatusBanner
        requiredServices={['tunarr', 'plex']}
        optionalServices={['tmdb', 'ollama']}
      />

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
          {/* Channel + Profile selectors */}
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

            {/* Profile selector */}
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
          </div>

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
              {ollamaModels.length > 0 && (
                <button
                  onClick={() => setAiImprove(!aiImprove)}
                  title={t('programming.aiImproveDesc')}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    aiImprove
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
          {aiImprove && ollamaModels.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
              <div className="flex items-start gap-2 mb-3 px-2 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{t('programming.aiExperimentalWarning')}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedAiModelForm}
                  onChange={e => setSelectedAiModelForm(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white sm:w-40"
                >
                  <option value="">{t('common.auto')}</option>
                  {ollamaModels.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
                <textarea
                  value={aiPromptForm}
                  onChange={e => setAiPromptForm(e.target.value)}
                  placeholder={t('programming.aiImprovePlaceholder')}
                  rows={2}
                  className="flex-1 px-3 py-2 text-sm border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 resize-none"
                />
              </div>
            </div>
          )}

          {/* Generate button at bottom */}
          <div className="pt-2">
            <button
              onClick={handleGenerate}
              disabled={!selectedChannelId || !selectedProfileId || running}
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
          ollamaModels={ollamaModels}
          onAiRequest={handleAiRequest}
          onApplyModification={handleApplyModification}
          aiLoading={aiLoading}
          aiResponse={aiResponse}
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
