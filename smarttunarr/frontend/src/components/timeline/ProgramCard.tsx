import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Film, Tv, Clock, Star, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Sparkles, RefreshCw, Zap } from 'lucide-react'
import clsx from 'clsx'
import type { ProgramItem } from '@/types'

interface ProgramCardProps {
  program: ProgramItem
  showScore?: boolean
  compact?: boolean
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-lime-500'
  if (score >= 40) return 'bg-yellow-500'
  if (score >= 20) return 'bg-orange-500'
  return 'bg-red-500'
}

function getScoreBgClass(score: number): string {
  if (score >= 80) return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
  if (score >= 60) return 'border-lime-200 dark:border-lime-800 bg-lime-50 dark:bg-lime-900/20'
  if (score >= 40) return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
  if (score >= 20) return 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
  return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function ProgramCard({ program, showScore = false, compact = false }: ProgramCardProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const TypeIcon = program.type === 'movie' ? Film : program.type === 'episode' ? Tv : Clock
  const score = program.score?.total ?? 0
  const hasViolations = program.score?.forbidden_violated || !program.score?.mandatory_met

  if (compact) {
    return (
      <div
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded border',
          showScore && program.score
            ? getScoreBgClass(score)
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        )}
      >
        <TypeIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
        <span className="flex-1 truncate text-sm text-gray-900 dark:text-white">
          {program.title}
        </span>
        {program.is_ai_improved && (
          <span
            className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium flex-shrink-0 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
            title={t('common.aiModifiedTooltip')}
          >
            <Sparkles className="w-2.5 h-2.5" />
          </span>
        )}
        {program.is_replacement && (
          <span
            className={clsx(
              'inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium flex-shrink-0',
              program.replacement_reason === 'forbidden'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
            )}
            title={program.replaced_title ? t('common.replaces', { title: program.replaced_title }) : t('common.replacementContent')}
          >
            {program.replacement_reason === 'forbidden' ? (
              <RefreshCw className="w-2.5 h-2.5" />
            ) : (
              <Zap className="w-2.5 h-2.5" />
            )}
          </span>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          {formatTime(program.start_time)}
        </span>
        {showScore && program.score && (
          <span
            className={clsx(
              'px-2 py-0.5 text-xs font-medium rounded text-white',
              getScoreColor(score)
            )}
          >
            {score.toFixed(0)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'rounded-lg border overflow-hidden',
        showScore && program.score
          ? getScoreBgClass(score)
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {/* Poster placeholder */}
        <div className="w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
          {program.poster_url ? (
            <img
              src={program.poster_url}
              alt={program.title}
              className="w-full h-full object-cover rounded"
            />
          ) : (
            <TypeIcon className="w-8 h-8 text-gray-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {program.title}
              </h3>
              {program.is_replacement && (
                <span
                  className={clsx(
                    'inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium flex-shrink-0',
                    program.replacement_reason === 'forbidden'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  )}
                  title={program.replaced_title ? t('common.replaces', { title: program.replaced_title }) : t('common.replacementContent')}
                >
                  {program.replacement_reason === 'forbidden' ? (
                    <RefreshCw className="w-2.5 h-2.5" />
                  ) : (
                    <Zap className="w-2.5 h-2.5" />
                  )}
                </span>
              )}
              {program.is_ai_improved && (
                <span
                  className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium flex-shrink-0 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                  title={t('common.aiModifiedTooltip')}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            {showScore && program.score && (
              <div className="flex items-center gap-1">
                {hasViolations && (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
                <span
                  className={clsx(
                    'px-2 py-1 text-sm font-bold rounded text-white',
                    getScoreColor(score)
                  )}
                >
                  {score.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <TypeIcon className="w-4 h-4" />
              {t(`content.types.${program.type}`)}
            </span>
            {program.year && <span>{program.year}</span>}
            {program.tmdb_rating && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500" />
                {program.tmdb_rating.toFixed(1)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {formatTime(program.start_time)} - {formatTime(program.end_time)}
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600 dark:text-gray-400">
              {program.duration_min} min
            </span>
          </div>

          {program.genres && program.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {program.genres.slice(0, 3).map(genre => (
                <span
                  key={genre}
                  className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                >
                  {genre}
                </span>
              ))}
              {program.genres.length > 3 && (
                <span className="text-xs text-gray-400">
                  +{program.genres.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Score breakdown (expandable) */}
      {showScore && program.score && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <span>{t('scoring.breakdown')}</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-3">
              {/* Score breakdown grid */}
              <div className="grid grid-cols-3 gap-2 text-sm">
                {Object.entries(program.score.breakdown).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      {t(`scoring.criteria.${key}`)}
                    </span>
                    <span className={`font-medium ${value == null ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                      {value == null ? '-' : value.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Violations */}
              {program.score.penalties.length > 0 && (
                <div className="text-sm">
                  <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {t('scoring.penalties')}
                  </span>
                  <ul className="mt-1 pl-5 list-disc text-red-500 dark:text-red-400">
                    {program.score.penalties.map((penalty, i) => (
                      <li key={i}>{penalty}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bonuses */}
              {program.score.bonuses.length > 0 && (
                <div className="text-sm">
                  <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Bonus
                  </span>
                  <ul className="mt-1 pl-5 list-disc text-green-500 dark:text-green-400">
                    {program.score.bonuses.map((bonus, i) => (
                      <li key={i}>{bonus}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
