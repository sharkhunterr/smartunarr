import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  History,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  Eye,
  RefreshCw,
  Filter,
  Play,
  BarChart3,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Table,
  LayoutGrid,
  GitCompare,
  Square,
  CheckSquare
} from 'lucide-react'
import clsx from 'clsx'
import { historyApi, programmingApi, scoringApi, profilesApi } from '@/services/api'
import type { HistoryEntry, ProgramResult, ScoringResult, Profile, ComparisonSummary } from '@/types'
import { DayTimeline } from '@/components/timeline'
import { ScoresTable, getScoreColor } from '@/components/scoring/ScoringDisplay'
import { CompareModal } from '@/components/history'
import { compareResults } from '@/utils/comparison'

const statusIcons = {
  success: CheckCircle,
  failed: XCircle,
  cancelled: Clock,
  running: Loader2,
}

const statusColors = {
  success: 'text-green-500',
  failed: 'text-red-500',
  cancelled: 'text-yellow-500',
  running: 'text-blue-500 animate-spin',
}

const typeIcons = {
  programming: Play,
  scoring: BarChart3,
  ai_generation: Sparkles,
}

type FilterType = 'all' | 'programming' | 'scoring'
type ResultView = 'timeline' | 'table'

interface ResultModalProps {
  entry: HistoryEntry
  result: ProgramResult | ScoringResult | null
  profile: Profile | null
  onClose: () => void
}

function ResultModal({ entry, result, profile, onClose }: ResultModalProps) {
  const { t } = useTranslation()
  const [view, setView] = useState<ResultView>('timeline')
  const [selectedIterationIdx, setSelectedIterationIdx] = useState(0)

  if (!result) return null

  const isProgramming = entry.type === 'programming' || entry.type === 'ai_generation'
  const programResult = isProgramming ? (result as ProgramResult) : null
  const scoringResult = !isProgramming ? (result as ScoringResult) : null

  // Iteration navigation for programming results
  const allIterations = programResult?.all_iterations || []
  const hasMultipleIterations = allIterations.length > 1

  const currentIteration = hasMultipleIterations ? allIterations[selectedIterationIdx] : null
  const displayPrograms = currentIteration?.programs || programResult?.programs || scoringResult?.programs || []
  const displayScore = currentIteration?.average_score ?? currentIteration?.total_score ?? programResult?.average_score ?? programResult?.total_score ?? scoringResult?.average_score ?? 0
  const displayIteration = currentIteration?.iteration ?? programResult?.iteration ?? 1
  const isOptimized = currentIteration?.is_optimized ?? false
  const isImproved = currentIteration?.is_improved ?? false

  const totalMinutes = currentIteration?.total_duration_min || programResult?.total_duration_min || 0
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  const durationText = hours > 0 ? `${hours}h${minutes > 0 ? minutes.toString().padStart(2, '0') : ''}` : `${minutes}min`

  const programDates = new Set(displayPrograms.map(p => new Date(p.start_time).toISOString().split('T')[0]))
  const daysCount = programDates.size

  const timeBlocks = programResult?.time_blocks || profile?.time_blocks || []

  // Count replacements in current iteration
  const replacedCount = displayPrograms.filter(p => p.is_replacement).length
  const forbiddenReplacements = displayPrograms.filter(p => p.replacement_reason === 'forbidden').length
  const improvedReplacements = displayPrograms.filter(p => p.replacement_reason === 'improved').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50">
      <div className="w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
              {t(`history.types.${entry.type}`)} - {entry.channel_name}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
              {entry.profile_name} • {new Date(entry.created_at).toLocaleString('fr-FR')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {programResult && (
            <div className="space-y-4">
              {/* Compact header with controls */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5 sm:p-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {/* Title with badges */}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-500" />
                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                      {(isOptimized || isImproved) ? t('historyPage.optimized') : `#${displayIteration}`}
                    </span>
                    {isImproved && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                        {t('historyPage.improved')}
                      </span>
                    )}
                    {isOptimized && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                        {t('historyPage.noForbidden')}
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <span className="text-xs text-gray-500">
                    {t('historyPage.stats', { count: displayPrograms.length })} • {durationText} • {t('historyPage.days', { count: daysCount })}
                  </span>

                  {/* Replacement info */}
                  {replacedCount > 0 && (
                    <span className="text-xs text-gray-500">
                      ({forbiddenReplacements > 0 && `${forbiddenReplacements} ${t('historyPage.replacements')}`}
                      {improvedReplacements > 0 && ` ${improvedReplacements} ${t('historyPage.improvements')}`})
                    </span>
                  )}

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
                      title={t('historyPage.viewTimeline')}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setView('table')}
                      className={clsx('p-1.5 rounded', view === 'table' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500')}
                      title={t('historyPage.viewTable')}
                    >
                      <Table className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Score */}
                  <div className={clsx('text-lg font-bold', getScoreColor(displayScore))}>
                    {displayScore.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('scoring.totalScore')}</div>
                  <div className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {(currentIteration?.total_score ?? programResult.total_score).toFixed(1)}
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('scoring.averageScore')}</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {displayScore.toFixed(1)}
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('comparison.programs')}</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {displayPrograms.length}
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('history.totalDuration')}</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {durationText}
                  </div>
                </div>
              </div>

              {/* Content view */}
              {view === 'timeline' && (
                <DayTimeline programs={displayPrograms} timeBlocks={timeBlocks} showScores={true} />
              )}
              {view === 'table' && (
                <ScoresTable programs={displayPrograms} timeBlocks={timeBlocks} profile={profile} maxHeight="450px" />
              )}
            </div>
          )}

          {scoringResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('scoring.totalScore')}</div>
                  <div className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {scoringResult.total_score.toFixed(1)}
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('scoring.averageScore')}</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {scoringResult.average_score.toFixed(1)}
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('comparison.programs')}</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {scoringResult.total_items}
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('scoring.violations')}</div>
                  <div className={clsx(
                    'text-xl sm:text-2xl font-bold',
                    scoringResult.violations_count > 0 ? 'text-red-500' : 'text-green-500'
                  )}>
                    {scoringResult.violations_count}
                  </div>
                </div>
              </div>

              {/* View toggle for scoring */}
              <div className="flex justify-end">
                <div className="flex gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                  <button
                    onClick={() => setView('timeline')}
                    className={clsx('p-1.5 rounded', view === 'timeline' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500')}
                    title={t('historyPage.viewTimeline')}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setView('table')}
                    className={clsx('p-1.5 rounded', view === 'table' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500')}
                    title={t('historyPage.viewTable')}
                  >
                    <Table className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {view === 'timeline' && (
                <DayTimeline programs={scoringResult.programs || []} showScores={true} />
              )}
              {view === 'table' && (
                <ScoresTable programs={scoringResult.programs || []} profile={profile} maxHeight="450px" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function HistoryPage() {
  const { t } = useTranslation()

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [actionId, setActionId] = useState<string | null>(null)

  // Modal state
  const [viewEntry, setViewEntry] = useState<HistoryEntry | null>(null)
  const [viewResult, setViewResult] = useState<ProgramResult | ScoringResult | null>(null)
  const [viewProfile, setViewProfile] = useState<Profile | null>(null)
  const [loadingResult, setLoadingResult] = useState(false)

  // Comparison mode state
  const [compareMode, setCompareMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [comparisonSummary, setComparisonSummary] = useState<ComparisonSummary | null>(null)
  const [loadingComparison, setLoadingComparison] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [filter])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? { type: filter as 'programming' | 'scoring' } : {}
      const data = await historyApi.list(params)
      setHistory(data)
    } catch {
      // History API not implemented yet, use empty array
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('historyPage.confirmDelete'))) return

    setActionId(id)
    try {
      await historyApi.delete(id)
      setHistory(prev => prev.filter(h => h.id !== id))
    } catch {
      // Error deleting
    } finally {
      setActionId(null)
    }
  }

  const handleClearAll = async () => {
    if (!confirm(t('historyPage.confirmClearAll'))) return

    setLoading(true)
    try {
      await historyApi.clear(filter !== 'all' ? filter : undefined)
      setHistory([])
    } catch {
      // Error clearing
    } finally {
      setLoading(false)
    }
  }

  const handleViewResult = async (entry: HistoryEntry) => {
    if (!entry.result_id) return

    setViewEntry(entry)
    setLoadingResult(true)
    setViewProfile(null)

    try {
      let result: ProgramResult | ScoringResult
      if (entry.type === 'programming' || entry.type === 'ai_generation') {
        result = await programmingApi.getResult(entry.result_id)
      } else {
        result = await scoringApi.getResult(entry.result_id)
      }
      setViewResult(result)

      // Load profile for time blocks display
      if (entry.profile_id) {
        try {
          const profile = await profilesApi.get(entry.profile_id)
          setViewProfile(profile)
        } catch {
          // Profile may have been deleted
        }
      }
    } catch {
      setViewEntry(null)
    } finally {
      setLoadingResult(false)
    }
  }

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '-'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  // Selection handlers for comparison
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 2) {
        next.add(id)
      }
      return next
    })
  }

  const exitCompareMode = () => {
    setCompareMode(false)
    setSelectedIds(new Set())
  }

  const handleCompare = async () => {
    if (selectedIds.size !== 2) return

    const [idA, idB] = Array.from(selectedIds)
    const entryA = history.find(h => h.id === idA)
    const entryB = history.find(h => h.id === idB)

    if (!entryA?.result_id || !entryB?.result_id) return

    setLoadingComparison(true)
    try {
      // Load both results
      const [resultA, resultB] = await Promise.all([
        entryA.type === 'programming' || entryA.type === 'ai_generation'
          ? programmingApi.getResult(entryA.result_id)
          : scoringApi.getResult(entryA.result_id),
        entryB.type === 'programming' || entryB.type === 'ai_generation'
          ? programmingApi.getResult(entryB.result_id)
          : scoringApi.getResult(entryB.result_id),
      ])

      // Generate comparison
      const summary = compareResults(entryA, entryB, resultA, resultB)
      setComparisonSummary(summary)
    } catch (err) {
      console.error('Failed to load comparison:', err)
    } finally {
      setLoadingComparison(false)
    }
  }

  const canCompare = selectedIds.size === 2 && Array.from(selectedIds).every(id => {
    const entry = history.find(h => h.id === id)
    return entry?.result_id
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {t('history.title')}
        </h1>
        <div className="flex items-center gap-2">
          {/* Compare mode controls */}
          {compareMode ? (
            <>
              <button
                onClick={handleCompare}
                disabled={!canCompare || loadingComparison}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors',
                  canCompare
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
              >
                {loadingComparison ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GitCompare className="w-4 h-4" />
                )}
                {t('comparison.compareSelection', { selected: selectedIds.size })}
              </button>
              <button
                onClick={exitCompareMode}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {t('comparison.cancel')}
              </button>
            </>
          ) : (
            <>
              {history.length >= 2 && (
                <button
                  onClick={() => setCompareMode(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <GitCompare className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('comparison.compare')}</span>
                </button>
              )}
              <button
                onClick={loadHistory}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <RefreshCw className="w-4 sm:w-5 h-4 sm:h-5" />
              </button>
              {history.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('historyPage.deleteAll')}</span>
                  <span className="sm:hidden">{t('historyPage.delete')}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
          {(['all', 'programming', 'scoring'] as FilterType[]).map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={clsx(
                'px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors whitespace-nowrap',
                filter === type
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              {type === 'all' ? t('historyPage.all') : t(`history.types.${type}`)}
            </button>
          ))}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8 sm:py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <History className="w-10 sm:w-12 h-10 sm:h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">{t('historyPage.noHistory')}</p>
        </div>
      ) : (
        <>
          {/* Desktop table view */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {compareMode && (
                      <th className="w-10 px-3 py-3">
                        <span className="sr-only">Selection</span>
                      </th>
                    )}
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('history.status')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('history.type')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('history.channel')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('history.profile')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('history.date')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('history.duration')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('history.score')}
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('historyPage.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {history.map(entry => {
                    const StatusIcon = statusIcons[entry.status] || Clock
                    const TypeIcon = typeIcons[entry.type] || Play

                    return (
                      <tr
                        key={entry.id}
                        className={clsx(
                          'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                          compareMode && selectedIds.has(entry.id) && 'bg-primary-50 dark:bg-primary-900/20'
                        )}
                      >
                          {compareMode && (
                            <td className="px-3 py-3">
                              <button
                                onClick={() => toggleSelection(entry.id)}
                                disabled={!entry.result_id || (selectedIds.size >= 2 && !selectedIds.has(entry.id))}
                                className="p-1 disabled:opacity-30"
                              >
                                {selectedIds.has(entry.id) ? (
                                  <CheckSquare className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                ) : (
                                  <Square className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <StatusIcon
                              className={clsx('w-5 h-5', statusColors[entry.status])}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                              <TypeIcon className="w-4 h-4 text-gray-400" />
                              {t(`history.types.${entry.type}`)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {entry.channel_name || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {entry.profile_name || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {new Date(entry.created_at).toLocaleString('fr-FR')}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {formatDuration(entry.duration_sec)}
                          </td>
                          <td className="px-4 py-3">
                            {entry.score ? (
                              <span className="font-medium text-primary-600 dark:text-primary-400">
                                {entry.score.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              {entry.result_id && (
                                <button
                                  onClick={() => handleViewResult(entry)}
                                  className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                                  title={t('history.viewResult')}
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(entry.id)}
                                disabled={actionId === entry.id}
                                className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                                title={t('common.delete')}
                              >
                                {actionId === entry.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {history.map(entry => {
              const StatusIcon = statusIcons[entry.status] || Clock
              const TypeIcon = typeIcons[entry.type] || Play

              return (
                <div
                  key={entry.id}
                  className={clsx(
                    'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3',
                    compareMode && selectedIds.has(entry.id) && 'ring-2 ring-primary-500'
                  )}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {compareMode && (
                        <button
                          onClick={() => toggleSelection(entry.id)}
                          disabled={!entry.result_id || (selectedIds.size >= 2 && !selectedIds.has(entry.id))}
                          className="p-0.5 disabled:opacity-30"
                        >
                          {selectedIds.has(entry.id) ? (
                            <CheckSquare className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      )}
                      <StatusIcon className={clsx('w-4 h-4', statusColors[entry.status])} />
                      <TypeIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {t(`history.types.${entry.type}`)}
                      </span>
                    </div>
                    {entry.score && (
                      <span className="font-medium text-primary-600 dark:text-primary-400 text-sm">
                        {entry.score.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>{entry.channel_name || '-'}</span>
                      <span>{formatDuration(entry.duration_sec)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="truncate max-w-[50%]">{entry.profile_name || '-'}</span>
                      <span>{new Date(entry.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    {entry.result_id && (
                      <button
                        onClick={() => handleViewResult(entry)}
                        className="p-1.5 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={actionId === entry.id}
                      className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {actionId === entry.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Result modal */}
      {viewEntry && (
        loadingResult ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        ) : (
          <ResultModal
            entry={viewEntry}
            result={viewResult}
            profile={viewProfile}
            onClose={() => {
              setViewEntry(null)
              setViewResult(null)
              setViewProfile(null)
            }}
          />
        )
      )}

      {/* Comparison modal */}
      {comparisonSummary && (
        <CompareModal
          summary={comparisonSummary}
          onClose={() => {
            setComparisonSummary(null)
            exitCompareMode()
          }}
        />
      )}
    </div>
  )
}
