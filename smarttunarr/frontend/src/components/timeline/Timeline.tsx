import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import type { ProgramItem, TimeBlock } from '@/types'
import { ProgramCard } from './ProgramCard'

interface TimelineProps {
  programs: ProgramItem[]
  timeBlocks?: TimeBlock[]
  showScores?: boolean
  compact?: boolean
  className?: string
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-lime-500'
  if (score >= 40) return 'bg-yellow-500'
  if (score >= 20) return 'bg-orange-500'
  return 'bg-red-500'
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function getBlockForTime(time: string, blocks: TimeBlock[]): TimeBlock | undefined {
  const timeNum = time.replace(':', '')

  return blocks.find(block => {
    const start = block.start_time.replace(':', '')
    const end = block.end_time.replace(':', '')

    // Handle overnight blocks
    if (end < start) {
      return timeNum >= start || timeNum < end
    }
    return timeNum >= start && timeNum < end
  })
}

const blockColors: Record<string, string> = {}
const availableColors = [
  'border-l-blue-500',
  'border-l-purple-500',
  'border-l-pink-500',
  'border-l-indigo-500',
  'border-l-teal-500',
  'border-l-cyan-500',
  'border-l-emerald-500',
  'border-l-amber-500',
]

function getBlockColor(blockName: string): string {
  if (!blockColors[blockName]) {
    const index = Object.keys(blockColors).length % availableColors.length
    blockColors[blockName] = availableColors[index]
  }
  return blockColors[blockName]
}

export function Timeline({
  programs = [],
  timeBlocks = [],
  showScores = false,
  compact = false,
  className
}: TimelineProps) {
  const { t } = useTranslation()

  // Ensure programs is always an array
  const safePrograms = programs || []

  const programsWithBlocks = useMemo(() => {
    return safePrograms.map(program => {
      const time = formatTime(program.start_time)
      const block = getBlockForTime(time, timeBlocks)
      return { program, block }
    })
  }, [safePrograms, timeBlocks])

  const totalScore = useMemo(() => {
    if (!showScores) return 0
    const scores = safePrograms.filter(p => p.score).map(p => p.score!.total)
    if (scores.length === 0) return 0
    return scores.reduce((a, b) => a + b, 0) / scores.length
  }, [safePrograms, showScores])

  if (safePrograms.length === 0) {
    return (
      <div className={clsx('text-center py-12 text-gray-500 dark:text-gray-400', className)}>
        {t('programming.noProfiles')}
      </div>
    )
  }

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Summary bar */}
      {showScores && (
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {safePrograms.length} {t('history.programsGenerated').toLowerCase()}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {safePrograms.reduce((acc, p) => acc + p.duration_min, 0)} min {t('history.totalDuration').toLowerCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('scoring.averageScore')}:
            </span>
            <span
              className={clsx(
                'px-3 py-1 rounded text-white font-bold',
                getScoreColor(totalScore)
              )}
            >
              {totalScore.toFixed(1)}
            </span>
          </div>
        </div>
      )}

      {/* Timeline blocks legend */}
      {timeBlocks.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
            {t('profiles.timeBlocks')}:
          </span>
          {timeBlocks.map((block, index) => {
            const colorClass = getBlockColor(block.name)
            return (
              <div
                key={index}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1 rounded border-l-4',
                  colorClass,
                  'bg-gray-50 dark:bg-gray-700/50'
                )}
              >
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {block.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {block.start_time}-{block.end_time}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Programs list */}
      <div className="space-y-2">
        {programsWithBlocks.map(({ program, block }) => (
          <div
            key={program.id}
            className={clsx(
              'relative',
              block && !compact && 'pl-4 border-l-4',
              block && getBlockColor(block.name)
            )}
          >
            {/* Block indicator */}
            {block && !compact && (
              <div className="absolute -left-1 top-0 transform -translate-x-1/2">
                <div
                  className={clsx(
                    'w-2 h-2 rounded-full',
                    getBlockColor(block.name).replace('border-l-', 'bg-')
                  )}
                />
              </div>
            )}

            <ProgramCard
              program={program}
              showScore={showScores}
              compact={compact}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export { ProgramCard } from './ProgramCard'
export { BlockMarker, BlockMarkersList } from './BlockMarker'
