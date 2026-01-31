import { X, Play, BarChart3, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import type { ComparisonSummary } from '@/types'
import { SummaryComparison } from './SummaryComparison'
import { ProgramComparisonTable } from './ProgramComparisonTable'

const typeIcons = {
  programming: Play,
  scoring: BarChart3,
  ai_generation: Sparkles,
}

const typeLabels = {
  programming: 'Programming',
  scoring: 'Scoring',
  ai_generation: 'AI',
}

const typeBadgeColors = {
  programming: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  scoring: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ai_generation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

interface CompareModalProps {
  summary: ComparisonSummary
  onClose: () => void
}

export function CompareModal({ summary, onClose }: CompareModalProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const TypeIconA = typeIcons[summary.entryA.type] || Play
  const TypeIconB = typeIcons[summary.entryB.type] || Play

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50">
      <div className="w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Comparaison
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {/* Entry A */}
              <div className="flex items-center gap-1.5">
                <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', typeBadgeColors[summary.entryA.type])}>
                  <TypeIconA className="w-3 h-3" />
                  {typeLabels[summary.entryA.type]}
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  {formatDate(summary.entryA.date)}
                </span>
              </div>

              <span className="text-gray-400 font-medium">vs</span>

              {/* Entry B */}
              <div className="flex items-center gap-1.5">
                <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', typeBadgeColors[summary.entryB.type])}>
                  <TypeIconB className="w-3 h-3" />
                  {typeLabels[summary.entryB.type]}
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  {formatDate(summary.entryB.date)}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {/* Summary cards */}
          <SummaryComparison summary={summary} />

          {/* Stats */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>
              {summary.programComparisons.filter(p => p.status === 'removed').length} retire(s)
            </span>
            <span>
              {summary.programComparisons.filter(p => p.status === 'added').length} ajoute(s)
            </span>
            <span>
              {summary.programComparisons.filter(p => p.status === 'improved').length} ameliore(s)
            </span>
            <span>
              {summary.programComparisons.filter(p => p.status === 'degraded').length} degrade(s)
            </span>
            <span>
              {summary.programComparisons.filter(p => p.status === 'unchanged').length} identique(s)
            </span>
          </div>

          {/* Programs table */}
          <ProgramComparisonTable
            programs={summary.programComparisons}
            maxHeight="calc(100vh - 400px)"
          />
        </div>
      </div>
    </div>
  )
}
