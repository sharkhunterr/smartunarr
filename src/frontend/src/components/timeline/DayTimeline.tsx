import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Film, Tv, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import clsx from 'clsx'
import type { ProgramItem, TimeBlock } from '@/types'

interface DayTimelineProps {
  programs: ProgramItem[]
  timeBlocks?: TimeBlock[]
  showScores?: boolean
  className?: string
}

const HOUR_HEIGHT = 40 // pixels per hour (compact)
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500/80'
  if (score >= 60) return 'bg-lime-500/80'
  if (score >= 40) return 'bg-yellow-500/80'
  if (score >= 20) return 'bg-orange-500/80'
  return 'bg-red-500/80'
}

const blockColors = [
  { bg: 'bg-blue-500/10', border: 'border-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  { bg: 'bg-purple-500/10', border: 'border-purple-500', text: 'text-purple-600 dark:text-purple-400' },
  { bg: 'bg-pink-500/10', border: 'border-pink-500', text: 'text-pink-600 dark:text-pink-400' },
  { bg: 'bg-indigo-500/10', border: 'border-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
  { bg: 'bg-teal-500/10', border: 'border-teal-500', text: 'text-teal-600 dark:text-teal-400' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
]

function getTimeOffset(timeString: string): number {
  // Returns offset in hours from 00:00
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours + minutes / 60
}

function getDateTimeOffset(isoString: string, baseDate: Date): number {
  const date = new Date(isoString)
  const baseStart = new Date(baseDate)
  baseStart.setHours(0, 0, 0, 0)
  return (date.getTime() - baseStart.getTime()) / (1000 * 60 * 60)
}

export function DayTimeline({
  programs = [],
  timeBlocks = [],
  showScores = false,
  className
}: DayTimelineProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [hoveredProgram, setHoveredProgram] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState(0) // 0 = first day in programs

  const safePrograms = programs || []

  // Group programs by day
  const programsByDay = useMemo(() => {
    const days: Map<string, ProgramItem[]> = new Map()

    safePrograms.forEach(prog => {
      const date = new Date(prog.start_time)
      const dayKey = date.toISOString().split('T')[0]
      if (!days.has(dayKey)) {
        days.set(dayKey, [])
      }
      days.get(dayKey)!.push(prog)
    })

    return Array.from(days.entries()).map(([date, progs]) => ({
      date,
      programs: progs.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    }))
  }, [safePrograms])

  const currentDayData = programsByDay[selectedDay] || { date: new Date().toISOString().split('T')[0], programs: [] }
  const baseDate = new Date(currentDayData.date)

  // Calculate time block positions for the visual display
  const timeBlockPositions = useMemo(() => {
    return timeBlocks.map((block, idx) => {
      const startOffset = getTimeOffset(block.start_time)
      const endOffset = getTimeOffset(block.end_time)

      // Handle overnight blocks (e.g., 20:00 - 07:00)
      if (endOffset <= startOffset) {
        // This block spans midnight
        return [
          { block, startOffset, endOffset: 24, colorIdx: idx % blockColors.length },
          { block, startOffset: 0, endOffset, colorIdx: idx % blockColors.length },
        ]
      }

      return [{ block, startOffset, endOffset, colorIdx: idx % blockColors.length }]
    }).flat()
  }, [timeBlocks])

  // Calculate program positions
  const programPositions = useMemo(() => {
    return currentDayData.programs.map(prog => {
      const startOffset = getDateTimeOffset(prog.start_time, baseDate)
      const endOffset = getDateTimeOffset(prog.end_time, baseDate)
      const duration = endOffset - startOffset

      return {
        program: prog,
        startOffset: Math.max(0, startOffset),
        endOffset: Math.min(24, endOffset),
        duration,
        isOvernight: endOffset > 24
      }
    })
  }, [currentDayData.programs, baseDate])

  // Calculate stats
  const stats = useMemo(() => {
    const totalMinutes = currentDayData.programs.reduce((acc, p) => acc + p.duration_min, 0)
    const avgScore = currentDayData.programs.length > 0
      ? currentDayData.programs.filter(p => p.score).reduce((acc, p) => acc + (p.score?.total || 0), 0) / currentDayData.programs.filter(p => p.score).length
      : 0
    return {
      count: currentDayData.programs.length,
      totalMinutes,
      totalHours: Math.floor(totalMinutes / 60),
      remainingMinutes: totalMinutes % 60,
      avgScore
    }
  }, [currentDayData.programs])

  const hourHeight = HOUR_HEIGHT * zoom

  if (safePrograms.length === 0) {
    return (
      <div className={clsx('text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700', className)}>
        {t('programming.noProfiles')}
      </div>
    )
  }

  return (
    <div className={clsx('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden', className)}>
      {/* Header with controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          {/* Day navigation */}
          {programsByDay.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedDay(Math.max(0, selectedDay - 1))}
                disabled={selectedDay === 0}
                className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[100px] text-center">
                {new Date(currentDayData.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <button
                onClick={() => setSelectedDay(Math.min(programsByDay.length - 1, selectedDay + 1))}
                disabled={selectedDay === programsByDay.length - 1}
                className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
          <span>{stats.count} prog.</span>
          <span>{stats.totalHours}h{stats.remainingMinutes > 0 ? stats.remainingMinutes.toString().padStart(2, '0') : ''}</span>
          {showScores && stats.avgScore > 0 && (
            <span className={clsx('px-1.5 py-0.5 rounded text-white text-[10px] font-medium', getScoreColor(stats.avgScore))}>
              {stats.avgScore.toFixed(1)}
            </span>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(Math.max(MIN_ZOOM, zoom - 0.25))}
            disabled={zoom <= MIN_ZOOM}
            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-gray-500 w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + 0.25))}
            disabled={zoom >= MAX_ZOOM}
            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Timeline legend */}
      {timeBlocks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          {timeBlocks.map((block, idx) => {
            const colors = blockColors[idx % blockColors.length]
            return (
              <div
                key={idx}
                className={clsx(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
                  colors.bg,
                  colors.text
                )}
              >
                <div className={clsx('w-1.5 h-1.5 rounded-full', colors.border.replace('border-', 'bg-'))} />
                <span className="font-medium">{block.name}</span>
                <span className="opacity-70">{block.start_time}-{block.end_time}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Timeline view */}
      <div
        ref={containerRef}
        className="relative overflow-auto"
        style={{ maxHeight: '450px' }}
      >
        <div className="flex" style={{ height: 24 * hourHeight }}>
          {/* Hour markers */}
          <div className="w-10 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700">
            {Array.from({ length: 24 }).map((_, hour) => (
              <div
                key={hour}
                className="flex items-start justify-end pr-1 text-[10px] text-gray-500 dark:text-gray-400"
                style={{ height: hourHeight }}
              >
                <span className="-mt-1.5">{formatHour(hour)}</span>
              </div>
            ))}
          </div>

          {/* Timeline content */}
          <div className="flex-1 relative">
            {/* Hour grid lines */}
            {Array.from({ length: 24 }).map((_, hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-700/50"
                style={{ top: hour * hourHeight }}
              />
            ))}

            {/* Time blocks background */}
            {timeBlockPositions.map((tb, idx) => {
              const colors = blockColors[tb.colorIdx]
              return (
                <div
                  key={`${tb.block.name}-${idx}`}
                  className={clsx('absolute left-0 right-0', colors.bg, 'border-l-4', colors.border)}
                  style={{
                    top: tb.startOffset * hourHeight,
                    height: (tb.endOffset - tb.startOffset) * hourHeight,
                  }}
                />
              )
            })}

            {/* Programs */}
            {programPositions.map(({ program, startOffset, endOffset }) => {
              const TypeIcon = program.type === 'movie' ? Film : Tv
              const score = program.score?.total ?? 0
              const isHovered = hoveredProgram === program.id
              const height = (endOffset - startOffset) * hourHeight
              const showDetails = height > 40

              return (
                <div
                  key={program.id}
                  className={clsx(
                    'absolute left-2 right-2 rounded border shadow-sm transition-all cursor-pointer overflow-hidden box-border',
                    isHovered
                      ? 'z-20 ring-2 ring-primary-500 shadow-lg scale-[1.02]'
                      : 'z-10',
                    showScores && score > 0
                      ? getScoreColor(score)
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                  )}
                  style={{
                    top: startOffset * hourHeight + 1,
                    height: Math.max(height - 2, 16),
                  }}
                  onMouseEnter={() => setHoveredProgram(program.id)}
                  onMouseLeave={() => setHoveredProgram(null)}
                >
                  <div className={clsx(
                    'h-full p-2 flex flex-col',
                    showScores && score > 0 ? 'text-white' : 'text-gray-900 dark:text-white'
                  )}>
                    <div className="flex items-start gap-1">
                      <TypeIcon className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-80" />
                      <span className="text-xs font-medium truncate flex-1">
                        {program.title}
                      </span>
                      {showScores && score > 0 && (
                        <span className="text-xs font-bold opacity-90">
                          {score.toFixed(0)}
                        </span>
                      )}
                    </div>
                    {showDetails && (
                      <div className="mt-auto flex items-center gap-2 text-[10px] opacity-80">
                        <span>{formatTime(program.start_time)}-{formatTime(program.end_time)}</span>
                        <span>{program.duration_min}min</span>
                      </div>
                    )}
                  </div>

                  {/* Tooltip on hover */}
                  {isHovered && (
                    <div className="absolute left-full top-0 ml-2 z-30 w-64 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {program.title}
                      </h4>
                      <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex justify-between">
                          <span>Type:</span>
                          <span className="font-medium">{t(`content.types.${program.type}`)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Durée:</span>
                          <span className="font-medium">{program.duration_min} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Horaire:</span>
                          <span className="font-medium">{formatTime(program.start_time)} - {formatTime(program.end_time)}</span>
                        </div>
                        {program.year && (
                          <div className="flex justify-between">
                            <span>Année:</span>
                            <span className="font-medium">{program.year}</span>
                          </div>
                        )}
                        {program.genres && program.genres.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {program.genres.map(g => (
                              <span key={g} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">
                                {g}
                              </span>
                            ))}
                          </div>
                        )}
                        {showScores && program.score && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-center">
                              <span>Score:</span>
                              <span className={clsx('px-2 py-0.5 rounded text-white font-bold', getScoreColor(score))}>
                                {score.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Current time indicator */}
            {(() => {
              const now = new Date()
              const todayStr = now.toISOString().split('T')[0]
              if (currentDayData.date === todayStr) {
                const currentHour = now.getHours() + now.getMinutes() / 60
                return (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-red-500 z-30 pointer-events-none"
                    style={{ top: currentHour * hourHeight }}
                  >
                    <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full" />
                    <span className="absolute left-3 -top-2.5 text-[10px] font-medium text-red-500 bg-white dark:bg-gray-800 px-1 rounded">
                      {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              }
              return null
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
