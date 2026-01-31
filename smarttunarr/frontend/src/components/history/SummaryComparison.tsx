import { ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import type { ComparisonSummary } from '@/types'
import { getDeltaColor, formatDelta, formatDuration } from '@/utils/comparison'

interface SummaryCardProps {
  label: string
  valueA: number
  valueB: number
  delta: number
  format?: 'number' | 'decimal' | 'duration'
  higherIsBetter?: boolean
}

function SummaryCard({ label, valueA, valueB, delta, format = 'decimal', higherIsBetter = true }: SummaryCardProps) {
  const formatValue = (val: number) => {
    if (format === 'duration') return formatDuration(val)
    if (format === 'number') return Math.round(val).toString()
    return val.toFixed(1)
  }

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-gray-900 dark:text-white">
          {formatValue(valueA)}
        </span>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <span className="text-lg font-semibold text-gray-900 dark:text-white">
          {formatValue(valueB)}
        </span>
      </div>
      <div className={clsx('text-sm font-medium mt-0.5', getDeltaColor(delta, higherIsBetter))}>
        {format === 'duration' ? formatDelta(delta, 0) + 'min' : formatDelta(delta)}
      </div>
    </div>
  )
}

interface SummaryComparisonProps {
  summary: ComparisonSummary
}

export function SummaryComparison({ summary }: SummaryComparisonProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <SummaryCard
        label="Score moyen"
        valueA={summary.averageScoreA}
        valueB={summary.averageScoreB}
        delta={summary.averageScoreDelta}
        format="decimal"
        higherIsBetter={true}
      />
      <SummaryCard
        label="Score total"
        valueA={summary.totalScoreA}
        valueB={summary.totalScoreB}
        delta={summary.totalScoreDelta}
        format="decimal"
        higherIsBetter={true}
      />
      <SummaryCard
        label="Programmes"
        valueA={summary.programCountA}
        valueB={summary.programCountB}
        delta={summary.programCountDelta}
        format="number"
        higherIsBetter={true}
      />
      <SummaryCard
        label="Duree totale"
        valueA={summary.durationMinA}
        valueB={summary.durationMinB}
        delta={summary.durationDelta}
        format="duration"
        higherIsBetter={true}
      />
    </div>
  )
}
