import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileJson,
  FileSpreadsheet,
  Database,
  Zap,
  Film,
  Tv,
  Clock,
  Ban,
  AlertTriangle,
  Star
} from 'lucide-react'
import clsx from 'clsx'
import { profilesApi, tunarrApi, scoringApi } from '@/services/api'
import { useJobsStore, Job } from '@/stores/useJobsStore'
import type { Profile, TunarrChannel, ScoringResult, ProgramItem, ScoringCacheMode, TimingDetails, MFPPolicy, CriterionMultipliers } from '@/types'

const cacheModeOptions: { value: ScoringCacheMode; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'cache_only', label: 'Cache', icon: Database, description: 'Utilise uniquement le cache existant' },
  { value: 'full', label: 'Cache + TMDB', icon: Zap, description: 'Cache + enrichissement TMDB pour les nouveaux' },
  { value: 'none', label: 'Aucun', icon: XCircle, description: 'Pas d\'enrichissement (données Tunarr uniquement)' },
]

const CRITERION_LABELS: Record<string, string> = {
  type: 'Type',
  duration: 'Durée',
  genre: 'Genre',
  timing: 'Timing',
  strategy: 'Strat.',
  age: 'Âge',
  rating: 'Note',
  filter: 'Filtre',
  bonus: 'Bonus',
}

const BLOCK_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300' },
  { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
]

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-lime-600 dark:text-lime-400'
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
  if (score >= 20) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50 dark:bg-green-900/20'
  if (score >= 60) return 'bg-lime-50 dark:bg-lime-900/20'
  if (score >= 40) return 'bg-yellow-50 dark:bg-yellow-900/20'
  if (score >= 20) return 'bg-orange-50 dark:bg-orange-900/20'
  return 'bg-red-50 dark:bg-red-900/20'
}

function formatTime(isoString: string): string {
  if (!isoString) return '—'
  try {
    return new Date(isoString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

// Step icon component
function StepIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle className="w-4 h-4 text-green-500" />
  if (status === 'running') return <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
  if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500" />
  return <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
}

// Progress Sidebar Component
interface ProgressSidebarProps {
  job: Job | null
  lastJob: Job | null
}

function ProgressSidebar({ job, lastJob }: ProgressSidebarProps) {
  const displayJob = job || lastJob

  if (!displayJob) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-fit">
        <div className="flex flex-col items-center justify-center text-gray-400 py-6 gap-2">
          <Clock className="w-5 h-5" />
          <span className="text-sm">Aucune analyse en cours</span>
        </div>
      </div>
    )
  }

  const isRunning = displayJob.status === 'running' || displayJob.status === 'pending'
  const isCompleted = displayJob.status === 'completed'
  const isFailed = displayJob.status === 'failed'
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
            {isRunning ? 'Analyse en cours' : isCompleted ? 'Analyse terminée' : 'Échec'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {displayJob.currentStep || (isCompleted ? 'Terminé avec succès' : displayJob.errorMessage)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
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
            <span className="text-sm text-gray-500 dark:text-gray-400">Score moyen</span>
            <span className={clsx('text-xl font-bold', getScoreColor(displayJob.bestScore))}>
              {displayJob.bestScore.toFixed(1)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Types for block criteria
interface BlockCriteria {
  preferred_types?: string[]
  allowed_types?: string[]
  excluded_types?: string[]
  preferred_genres?: string[]
  allowed_genres?: string[]
  forbidden_genres?: string[]
  min_duration_min?: number
  max_duration_min?: number
  max_age_rating?: string
  allowed_age_ratings?: string[]
  min_tmdb_rating?: number
  preferred_tmdb_rating?: number
  min_vote_count?: number
  exclude_keywords?: string[]
  include_keywords?: string[]
  type_rules?: CriterionRules
  duration_rules?: CriterionRules
  genre_rules?: CriterionRules
  timing_rules?: CriterionRules
  strategy_rules?: CriterionRules
  age_rules?: CriterionRules
  rating_rules?: CriterionRules
  filter_rules?: CriterionRules
  bonus_rules?: CriterionRules
  // M/F/P policy and multipliers (block-level override)
  mfp_policy?: MFPPolicy
  criterion_multipliers?: CriterionMultipliers
}

interface CriterionRules {
  mandatory_values?: string[]
  mandatory_penalty?: number
  forbidden_values?: string[]
  forbidden_penalty?: number
  preferred_values?: string[]
  preferred_bonus?: number
}

interface TimeBlockWithCriteria {
  name: string
  start_time: string
  end_time: string
  criteria?: BlockCriteria
}

// Row type for expanded criteria table
interface CriterionRow {
  label: string
  content: string | React.ReactNode | null
  expected: string | React.ReactNode | null
  score: number | null
  isTotal?: boolean
}

// Expanded Row Component
interface ExpandedRowProps {
  prog: ProgramItem
  block?: TimeBlockWithCriteria
  profile?: Profile | null
}

// Helper to normalize accents for comparison (é -> e, è -> e, etc.)
function normalizeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Multilingual mapping for bonus categories (category -> terms in various languages)
const BONUS_CATEGORY_TERMS: Record<string, string[]> = {
  'recent': ['recent', 'recente', 'sortie recente', 'assez recent', 'nuevo', 'neue', 'reciente'],
  'recency': ['recent', 'recente', 'sortie recente', 'assez recent'],
  'popular': ['popular', 'populaire', 'tres populaire', 'beliebt', 'popolare'],
  'collection': ['collection', 'kollektion', 'collezione', 'coleccion'],
  'franchise': ['franchise', 'collection', 'saga'],
  'blockbuster': ['blockbuster', 'succes commercial', 'rentable', 'roi', 'exito'],
  'holiday': ['holiday', 'saison', 'noel', 'christmas', 'thanksgiving', 'halloween', 'feiertag'],
  'seasonal': ['seasonal', 'saison', 'saisonnier', 'estacional'],
}

// Get all terms that match a category (for multilingual support)
function getCategoryTerms(category: string): string[] {
  const terms = BONUS_CATEGORY_TERMS[category.toLowerCase()] || []
  return [category.toLowerCase(), ...terms]
}

// Helper to check value against M/F/P rules and return colored element
type MFPMatch = 'mandatory' | 'forbidden' | 'preferred' | null

function checkMFPMatch(
  value: string,
  mandatory?: string[],
  forbidden?: string[],
  preferred?: string[],
  rules?: CriterionRules
): MFPMatch {
  const valueLower = normalizeAccents(value.toLowerCase())

  // Merge explicit values with rules
  const allForbidden = [...(forbidden || []), ...(rules?.forbidden_values || [])]
  const allMandatory = [...(mandatory || []), ...(rules?.mandatory_values || [])]
  const allPreferred = [...(preferred || []), ...(rules?.preferred_values || [])]

  // Check forbidden first (highest priority)
  if (allForbidden.some(f => {
    // Get all terms for this category (multilingual)
    const terms = getCategoryTerms(f)
    return terms.some(term => {
      const termNorm = normalizeAccents(term.toLowerCase())
      return termNorm === valueLower || valueLower.includes(termNorm)
    })
  })) {
    return 'forbidden'
  }

  // Check mandatory match (content matches a required value)
  if (allMandatory.some(m => {
    const terms = getCategoryTerms(m)
    return terms.some(term => {
      const termNorm = normalizeAccents(term.toLowerCase())
      return termNorm === valueLower || valueLower.includes(termNorm)
    })
  })) {
    return 'mandatory'
  }

  // Check preferred match
  if (allPreferred.some(p => {
    const terms = getCategoryTerms(p)
    return terms.some(term => {
      const termNorm = normalizeAccents(term.toLowerCase())
      return termNorm === valueLower || valueLower.includes(termNorm)
    })
  })) {
    return 'preferred'
  }

  return null
}

// Render a single value with M/F/P coloring (matching Expected column style)
function renderColoredValue(
  value: string,
  mandatory?: string[],
  forbidden?: string[],
  preferred?: string[],
  rules?: CriterionRules
): React.ReactNode {
  const match = checkMFPMatch(value, mandatory, forbidden, preferred, rules)

  switch (match) {
    case 'forbidden':
      return <span className="text-red-700 dark:text-red-300 font-medium">{value}</span>
    case 'mandatory':
      return <span className="text-orange-700 dark:text-orange-300 font-medium">{value}</span>
    case 'preferred':
      return <span className="text-green-700 dark:text-green-300 font-medium">{value}</span>
    default:
      return <span>{value}</span>
  }
}

// Render an array of values with M/F/P coloring
function renderColoredArray(
  values: string[],
  mandatory?: string[],
  forbidden?: string[],
  preferred?: string[],
  rules?: CriterionRules
): React.ReactNode {
  if (!values || values.length === 0) return '—'

  return (
    <span>
      {values.map((v, i) => (
        <span key={i}>
          {i > 0 && ', '}
          {renderColoredValue(v, mandatory, forbidden, preferred, rules)}
        </span>
      ))}
    </span>
  )
}

function ExpandedRow({ prog, block, profile }: ExpandedRowProps) {
  const criteria = block?.criteria || {} as BlockCriteria
  const score = prog.score

  // Get MFP policy (block-level overrides profile-level)
  const getMFPPolicy = (): MFPPolicy => {
    const blockPolicy = criteria?.mfp_policy
    const profilePolicy = profile?.mfp_policy
    return {
      mandatory_matched_bonus: blockPolicy?.mandatory_matched_bonus ?? profilePolicy?.mandatory_matched_bonus ?? 10,
      mandatory_missed_penalty: blockPolicy?.mandatory_missed_penalty ?? profilePolicy?.mandatory_missed_penalty ?? -40,
      forbidden_detected_penalty: blockPolicy?.forbidden_detected_penalty ?? profilePolicy?.forbidden_detected_penalty ?? -400,
      preferred_matched_bonus: blockPolicy?.preferred_matched_bonus ?? profilePolicy?.preferred_matched_bonus ?? 20,
    }
  }

  // Get multiplier for a criterion (block-level overrides profile-level)
  const getMultiplier = (criterionName: keyof CriterionMultipliers): number => {
    const blockMultipliers = criteria?.criterion_multipliers
    const profileMultipliers = profile?.criterion_multipliers
    return blockMultipliers?.[criterionName] ?? profileMultipliers?.[criterionName] ?? 1.0
  }

  const mfpPolicy = getMFPPolicy()

  // Helper to render MFP policy footer
  const renderMFPFooter = (criterionName: keyof CriterionMultipliers, hasRules: boolean = false) => {
    const multiplier = getMultiplier(criterionName)
    const showMFP = hasRules
    const showMultiplier = multiplier !== 1.0

    if (!showMFP && !showMultiplier) return null

    return (
      <div className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700 space-y-0.5">
        {showMultiplier && (
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-semibold text-purple-600 dark:text-purple-400">×{multiplier.toFixed(1)}</span>
          </div>
        )}
        {showMFP && (
          <div className="flex flex-wrap gap-1 text-[8px] text-gray-500 dark:text-gray-400">
            <span className="text-orange-500">M:{mfpPolicy.mandatory_matched_bonus > 0 ? '+' : ''}{mfpPolicy.mandatory_matched_bonus}/{mfpPolicy.mandatory_missed_penalty}</span>
            <span className="text-red-500">F:{mfpPolicy.forbidden_detected_penalty}</span>
            <span className="text-green-500">P:+{mfpPolicy.preferred_matched_bonus}</span>
          </div>
        )}
      </div>
    )
  }

  // Helper to render expected values cell with M/F/P sub-rows
  const renderExpected = (
    mandatory?: string[],
    forbidden?: string[],
    preferred?: string[],
    rules?: CriterionRules,
    criterionName?: keyof CriterionMultipliers
  ) => {
    // Merge explicit values with rules
    const m = [...(mandatory || []), ...(rules?.mandatory_values || [])]
    const f = [...(forbidden || []), ...(rules?.forbidden_values || [])]
    const p = [...(preferred || []), ...(rules?.preferred_values || [])]
    const hasRules = m.length > 0 || f.length > 0 || p.length > 0

    const multiplier = criterionName ? getMultiplier(criterionName) : 1.0
    const showMultiplier = multiplier !== 1.0

    if (!hasRules && !showMultiplier) {
      return <span className="text-gray-400">—</span>
    }

    return (
      <div className="space-y-0.5">
        {m.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold text-orange-600 dark:text-orange-400 w-[18px]">M</span>
            <span className="text-xs text-orange-700 dark:text-orange-300">{m.join(', ')}</span>
          </div>
        )}
        {f.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold text-red-600 dark:text-red-400 w-[18px]">F</span>
            <span className="text-xs text-red-700 dark:text-red-300">{f.join(', ')}</span>
          </div>
        )}
        {p.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold text-green-600 dark:text-green-400 w-[18px]">P</span>
            <span className="text-xs text-green-700 dark:text-green-300">{p.join(', ')}</span>
          </div>
        )}
        {criterionName && renderMFPFooter(criterionName, hasRules)}
      </div>
    )
  }

  // Helper to render age expected values (different display than M/F/P)
  const renderExpectedAge = (allowed?: string[], maxRating?: string, rules?: CriterionRules, criterionName?: keyof CriterionMultipliers) => {
    const parts: React.ReactNode[] = []

    if (allowed && allowed.length > 0) {
      parts.push(
        <div key="allowed" className="flex items-start gap-1.5">
          <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 w-[30px] flex-shrink-0">OK</span>
          <span className="text-xs text-blue-700 dark:text-blue-300">{allowed.join(', ')}</span>
        </div>
      )
    }

    if (maxRating) {
      parts.push(
        <div key="max" className="flex items-start gap-1.5">
          <span className="text-[9px] font-semibold text-gray-600 dark:text-gray-400 w-[30px] flex-shrink-0">Max</span>
          <span className="text-xs text-gray-700 dark:text-gray-300">{maxRating}</span>
        </div>
      )
    }

    // Add rules if defined
    const m = rules?.mandatory_values || []
    const f = rules?.forbidden_values || []
    const p = rules?.preferred_values || []

    if (m.length > 0) {
      parts.push(
        <div key="m" className="flex items-start gap-1.5">
          <span className="text-[9px] font-semibold text-orange-600 dark:text-orange-400 w-[30px] flex-shrink-0">M</span>
          <span className="text-xs text-orange-700 dark:text-orange-300">{m.join(', ')}</span>
        </div>
      )
    }
    if (f.length > 0) {
      parts.push(
        <div key="f" className="flex items-start gap-1.5">
          <span className="text-[9px] font-semibold text-red-600 dark:text-red-400 w-[30px] flex-shrink-0">F</span>
          <span className="text-xs text-red-700 dark:text-red-300">{f.join(', ')}</span>
        </div>
      )
    }
    if (p.length > 0) {
      parts.push(
        <div key="p" className="flex items-start gap-1.5">
          <span className="text-[9px] font-semibold text-green-600 dark:text-green-400 w-[30px] flex-shrink-0">P</span>
          <span className="text-xs text-green-700 dark:text-green-300">{p.join(', ')}</span>
        </div>
      )
    }

    const hasRules = m.length > 0 || f.length > 0 || p.length > 0
    const multiplier = criterionName ? getMultiplier(criterionName) : 1.0
    const showMultiplier = multiplier !== 1.0

    if (parts.length === 0 && !showMultiplier) {
      return <span className="text-gray-400">—</span>
    }

    return (
      <div className="space-y-0.5">
        {parts}
        {criterionName && renderMFPFooter(criterionName, hasRules)}
      </div>
    )
  }

  // Helper to render expected range
  const renderExpectedRange = (min?: number, max?: number, preferred?: number, rules?: CriterionRules, criterionName?: keyof CriterionMultipliers) => {
    const rangeParts: string[] = []
    if (min != null) rangeParts.push(`Min: ${min}`)
    if (max != null) rangeParts.push(`Max: ${max}`)
    if (preferred != null) rangeParts.push(`Préf: ${preferred}`)

    const m = rules?.mandatory_values || []
    const f = rules?.forbidden_values || []
    const p = rules?.preferred_values || []

    const hasRules = m.length > 0 || f.length > 0 || p.length > 0
    const multiplier = criterionName ? getMultiplier(criterionName) : 1.0
    const showMultiplier = multiplier !== 1.0

    if (rangeParts.length === 0 && !hasRules && !showMultiplier) {
      return <span className="text-gray-400">—</span>
    }

    return (
      <div className="space-y-0.5">
        {rangeParts.length > 0 && (
          <div className="text-xs text-gray-600 dark:text-gray-400">{rangeParts.join(' / ')}</div>
        )}
        {m.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold text-orange-600 dark:text-orange-400 w-[18px]">M</span>
            <span className="text-xs text-orange-700 dark:text-orange-300">{m.join(', ')}</span>
          </div>
        )}
        {f.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold text-red-600 dark:text-red-400 w-[18px]">F</span>
            <span className="text-xs text-red-700 dark:text-red-300">{f.join(', ')}</span>
          </div>
        )}
        {p.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold text-green-600 dark:text-green-400 w-[18px]">P</span>
            <span className="text-xs text-green-700 dark:text-green-300">{p.join(', ')}</span>
          </div>
        )}
        {criterionName && renderMFPFooter(criterionName, hasRules)}
      </div>
    )
  }

  // Get score for a criterion (null if skipped)
  const getScore = (key: string): number | null => {
    const criterionData = score?.criteria?.[key as keyof NonNullable<typeof score.criteria>]
    const value = score?.breakdown?.[key as keyof typeof score.breakdown]
    // Check if skipped via criteria.skipped flag OR if breakdown value is null
    if (criterionData?.skipped === true || value === null || value === undefined) {
      return null
    }
    return value
  }

  // Data rows configuration
  const rows: CriterionRow[] = [
    {
      label: 'Début',
      content: formatTime(prog.start_time),
      expected: block ? block.start_time : '—',
      score: null
    },
    {
      label: 'Fin',
      content: formatTime(prog.end_time),
      expected: block ? block.end_time : '—',
      score: null
    },
    {
      label: 'Durée',
      content: prog.duration_min ? `${Math.round(prog.duration_min)} min` : '—',
      expected: renderExpectedRange(criteria.min_duration_min, criteria.max_duration_min, undefined, criteria.duration_rules, 'duration'),
      score: getScore('duration')
    },
    {
      label: 'Type',
      content: prog.type
        ? renderColoredValue(
            prog.type === 'movie' ? 'Film' : prog.type === 'episode' ? 'Série' : prog.type,
            criteria.allowed_types,
            criteria.excluded_types,
            criteria.preferred_types,
            criteria.type_rules
          )
        : '—',
      expected: renderExpected(criteria.allowed_types, criteria.excluded_types, criteria.preferred_types, criteria.type_rules, 'type'),
      score: getScore('type')
    },
    {
      label: 'Genre',
      content: prog.genres?.length
        ? renderColoredArray(
            prog.genres,
            criteria.allowed_genres,
            criteria.forbidden_genres,
            criteria.preferred_genres,
            criteria.genre_rules
          )
        : '—',
      expected: renderExpected(criteria.allowed_genres, criteria.forbidden_genres, criteria.preferred_genres, criteria.genre_rules, 'genre'),
      score: getScore('genre')
    },
    {
      label: 'Timing',
      content: (() => {
        const timingDetails = score?.criteria?.timing?.details as TimingDetails | null | undefined
        const parts: React.ReactNode[] = []

        // Show overflow for last in block (positive = overflow past block end)
        if (timingDetails?.is_last_in_block && timingDetails?.overflow_minutes !== null && timingDetails?.overflow_minutes !== undefined) {
          const overflow = timingDetails.overflow_minutes
          if (overflow > 0) {
            parts.push(
              <span key="overflow" className="text-red-600 dark:text-red-400">
                Dépassement: +{overflow.toFixed(0)}min
              </span>
            )
          } else if (overflow < 0) {
            parts.push(
              <span key="early-end" className="text-green-600 dark:text-green-400">
                Avant fin: {overflow.toFixed(0)}min
              </span>
            )
          } else {
            parts.push(
              <span key="perfect" className="text-green-600 dark:text-green-400">
                Pile à l'heure
              </span>
            )
          }
        }

        // Show late/early start for first in block
        if (timingDetails?.is_first_in_block) {
          if (timingDetails?.late_start_minutes !== null && timingDetails?.late_start_minutes !== undefined && timingDetails.late_start_minutes > 0) {
            parts.push(
              <span key="late" className="text-orange-600 dark:text-orange-400">
                Retard: +{timingDetails.late_start_minutes.toFixed(0)}min
              </span>
            )
          } else if (timingDetails?.early_start_minutes !== null && timingDetails?.early_start_minutes !== undefined && timingDetails.early_start_minutes > 0) {
            parts.push(
              <span key="early" className="text-blue-600 dark:text-blue-400">
                Avance: -{timingDetails.early_start_minutes.toFixed(0)}min
              </span>
            )
          }
        }

        if (parts.length === 0) {
          return <span className="text-gray-500">—</span>
        }

        return <div className="space-y-0.5 text-xs">{parts}</div>
      })(),
      expected: (() => {
        const multiplier = getMultiplier('timing')
        const showMultiplier = multiplier !== 1.0
        const timeRange = block ? `${block.start_time} - ${block.end_time}` : '—'
        if (!showMultiplier) return timeRange
        return (
          <div className="space-y-0.5">
            <div>{timeRange}</div>
            {renderMFPFooter('timing', false)}
          </div>
        )
      })(),
      score: getScore('timing')
    },
    {
      label: 'Strat.',
      content: '—', // Strategy is profile-level, not content-level
      expected: renderExpected(undefined, undefined, undefined, criteria.strategy_rules, 'strategy'),
      score: getScore('strategy')
    },
    {
      label: 'Âge',
      content: prog.content_rating
        ? renderColoredValue(
            prog.content_rating,
            criteria.allowed_age_ratings,
            undefined,  // No explicit forbidden, use rules
            undefined,  // No explicit preferred, use rules
            criteria.age_rules
          )
        : '—',
      expected: renderExpectedAge(criteria.allowed_age_ratings, criteria.max_age_rating, criteria.age_rules, 'age'),
      score: getScore('age')
    },
    {
      label: 'Note',
      content: (() => {
        const rating = prog.tmdb_rating
        if (!rating || isNaN(Number(rating))) return '—'

        const ratingNum = Number(rating)
        const minRating = criteria.min_tmdb_rating
        const preferredRating = criteria.preferred_tmdb_rating

        // Determine color based on thresholds
        let colorClass = 'text-gray-700 dark:text-gray-300'  // Default
        if (preferredRating && ratingNum >= preferredRating) {
          colorClass = 'text-green-700 dark:text-green-300'  // At or above preferred
        } else if (minRating && ratingNum >= minRating) {
          colorClass = 'text-yellow-700 dark:text-yellow-300'  // Between min and preferred
        } else if (minRating && ratingNum < minRating) {
          colorClass = 'text-red-700 dark:text-red-300'  // Below minimum
        }

        return <span className={colorClass}>{ratingNum.toFixed(1)}/10</span>
      })(),
      expected: renderExpectedRange(criteria.min_tmdb_rating, undefined, criteria.preferred_tmdb_rating, criteria.rating_rules, 'rating'),
      score: getScore('rating')
    },
    {
      label: 'Filtre',
      content: prog.keywords?.length
        ? renderColoredArray(
            prog.keywords,
            criteria.include_keywords,
            criteria.exclude_keywords,
            undefined,
            criteria.filter_rules
          )
        : '—',
      expected: renderExpected(criteria.include_keywords, criteria.exclude_keywords, undefined, criteria.filter_rules, 'filter'),
      score: getScore('filter')
    },
    {
      label: 'Bonus',
      content: score?.bonuses?.length
        ? renderColoredArray(
            score.bonuses,
            undefined,
            undefined,
            criteria.bonus_rules?.preferred_values,
            criteria.bonus_rules
          )
        : '—',
      expected: renderExpected(undefined, undefined, undefined, criteria.bonus_rules, 'bonus'),
      score: getScore('bonus')
    },
    {
      label: 'Total',
      content: null,
      expected: null,
      score: score?.total ?? 0,
      isTotal: true
    }
  ]

  return (
    <tr className="bg-gray-50 dark:bg-gray-800/50">
      <td colSpan={16} className="px-4 py-3">
        {/* Header with title and final score */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {prog.type === 'movie' ? <Film className="w-5 h-5 text-blue-500" /> : <Tv className="w-5 h-5 text-purple-500" />}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">{prog.title}</h4>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {prog.year || '?'} • {prog.duration_min ? `${Math.round(prog.duration_min)} min` : '?'}
                {prog.tmdb_rating && !isNaN(Number(prog.tmdb_rating)) && <> • <span className={getScoreColor(Number(prog.tmdb_rating) * 10)}>★ {Number(prog.tmdb_rating).toFixed(1)}</span></>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={clsx('text-2xl font-bold', getScoreColor(score?.total ?? 0))}>{(score?.total ?? 0).toFixed(0)}</div>
            <div className="text-[10px] text-gray-500 uppercase">Score</div>
          </div>
        </div>

        {/* Criteria table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 w-20">Critère</th>
                <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300">Contenu</th>
                <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300">Attendu (M/F/P)</th>
                <th className="px-2 py-1.5 text-center font-semibold text-gray-700 dark:text-gray-300 w-16">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {rows.map((row, idx) => (
                <tr key={idx} className={clsx(row.isTotal && 'bg-gray-100 dark:bg-gray-900/50 font-semibold')}>
                  <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400 font-medium">{row.label}</td>
                  <td className="px-2 py-1.5 text-gray-900 dark:text-white">
                    {row.content !== null ? (typeof row.content === 'string' ? row.content : row.content) : ''}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.expected !== null ? (typeof row.expected === 'string' ? <span className="text-gray-600 dark:text-gray-400">{row.expected}</span> : row.expected) : ''}
                  </td>
                  <td className={clsx('px-2 py-1.5 text-center', row.score !== null ? getScoreColor(row.score) : 'text-gray-400')}>
                    {row.score !== null ? row.score.toFixed(0) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Forbidden Violations */}
        {score?.forbidden_violated && score?.forbidden_details && score.forbidden_details.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Ban className="w-3 h-3 text-red-500" /> Violations Forbidden (Score = 0)
            </h5>
            <ul className="space-y-0.5">
              {score.forbidden_details.map((v: { criterion?: string; message?: string; rule?: string; values?: string[] }, i: number) => (
                <li key={i} className="text-xs text-red-600 dark:text-red-400">
                  • {v.criterion && <span className="font-medium">[{v.criterion}]</span>} {v.message || v.rule || (v.values ? `Valeurs interdites: ${v.values.join(', ')}` : 'Violation')}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mandatory Penalties */}
        {score?.penalties && score.penalties.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-orange-500" /> Pénalités Mandatory
            </h5>
            <ul className="space-y-0.5">
              {score.penalties.map((p, i) => (
                <li key={i} className="text-xs text-orange-600 dark:text-orange-400">• {p}</li>
              ))}
            </ul>
          </div>
        )}
      </td>
    </tr>
  )
}

// Block Settings Legend Component
interface BlockSettingsLegendProps {
  timeBlocks: TimeBlockWithCriteria[]
  profile?: Profile | null
}

function BlockSettingsLegend({ timeBlocks, profile }: BlockSettingsLegendProps) {
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
    const label = isDefault ? '(défaut)' : ''
    return (
      <span className="text-[9px]">
        <span className="text-orange-500">M:{policy.mandatory_matched_bonus > 0 ? '+' : ''}{policy.mandatory_matched_bonus}/{policy.mandatory_missed_penalty}</span>
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
      .map(([key, val]) => `${CRITERION_LABELS[key] || key}:×${val?.toFixed(1)}`)
    return nonDefault.join(', ')
  }

  return (
    <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Paramètres MFP & Multiplicateurs par bloc</div>
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
                <div className="mt-0.5 text-gray-400 text-[9px]">MFP: défaut</div>
              )}
              {blockMultipliers ? (
                <div className="text-[9px] text-purple-600 dark:text-purple-400 mt-0.5 truncate" title={blockMultipliers}>
                  {blockMultipliers}
                </div>
              ) : (
                <div className="text-[9px] text-gray-400 mt-0.5">×1.0 (tous)</div>
              )}
            </div>
          )
        })}
      </div>
      {/* Profile defaults */}
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-400">
        <span className="font-medium">Défauts profil:</span> {formatMFP(profile?.mfp_policy, true)}
        {profile?.criterion_multipliers && formatMultipliers(profile.criterion_multipliers) && (
          <span className="ml-2 text-purple-500">| {formatMultipliers(profile.criterion_multipliers)}</span>
        )}
      </div>
    </div>
  )
}

// Scores Table Component
interface ScoresTableProps {
  programs: ProgramItem[]
  timeBlocks?: TimeBlockWithCriteria[]
  profile?: Profile | null
}

function ScoresTable({ programs, timeBlocks = [], profile }: ScoresTableProps) {
  const criteria = Object.keys(CRITERION_LABELS)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Build block name to color index map
  const blockColorMap = new Map<string, number>()
  timeBlocks.forEach((block, idx) => {
    blockColorMap.set(block.name, idx % BLOCK_COLORS.length)
  })

  // Get block for a program
  const getBlock = (blockName: string | undefined): TimeBlockWithCriteria | undefined => {
    if (!blockName) return undefined
    return timeBlocks.find(b => b.name === blockName)
  }

  // Get multiplier for a criterion from block or profile
  const getMultiplierForBlock = (blockName: string | undefined, criterionName: string): number => {
    const block = getBlock(blockName)
    const blockMultipliers = block?.criteria?.criterion_multipliers
    const profileMultipliers = profile?.criterion_multipliers
    return blockMultipliers?.[criterionName as keyof CriterionMultipliers] ?? profileMultipliers?.[criterionName as keyof CriterionMultipliers] ?? 1.0
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[500px] overflow-y-auto">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-400 sticky left-0 bg-gray-50 dark:bg-gray-900/50 z-20 min-w-[150px]">
                Titre
              </th>
              <th className="px-2 py-2 text-center font-medium text-gray-600 dark:text-gray-400 w-16">
                Bloc
              </th>
              <th className="px-2 py-2 text-center font-medium text-gray-600 dark:text-gray-400 w-14">
                Début
              </th>
              <th className="px-2 py-2 text-center font-medium text-gray-600 dark:text-gray-400 w-14">
                Fin
              </th>
              <th className="px-2 py-2 text-center font-medium text-gray-600 dark:text-gray-400 w-12">
                Durée
              </th>
              <th className="px-2 py-2 text-center font-medium text-gray-600 dark:text-gray-400 w-10" title="Statut">
                Statut
              </th>
              {criteria.map(key => (
                <th key={key} className="px-1.5 py-2 text-center font-medium text-gray-600 dark:text-gray-400 w-12" title={`Score ${CRITERION_LABELS[key]}`}>
                  {CRITERION_LABELS[key]}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium text-gray-900 dark:text-white w-12 bg-gray-100 dark:bg-gray-800">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {programs.map((prog, idx) => {
              const score = prog.score?.total ?? 0
              const blockColorIdx = blockColorMap.get(prog.block_name || '') ?? 0
              const blockColor = BLOCK_COLORS[blockColorIdx]
              const isForbidden = prog.score?.forbidden_violated
              const isMandatoryMet = prog.score?.mandatory_met
              const isExpanded = expandedIds.has(prog.id)

              return (
                <React.Fragment key={prog.id}>
                  <tr
                    className={clsx(
                      idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-900/30',
                      isForbidden && 'bg-red-50/50 dark:bg-red-900/10',
                      'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    )}
                    onClick={() => toggleExpanded(prog.id)}
                  >
                    <td className="px-2 py-1.5 text-gray-900 dark:text-white truncate max-w-[150px] sticky left-0 z-10" style={{ background: 'inherit' }}>
                      <div className="flex items-center gap-1.5">
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                        {prog.type === 'movie' ? <Film className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <Tv className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                        <span className="truncate" title={prog.title}>{prog.title}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {prog.block_name && (
                        <span className={clsx(
                          'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[60px]',
                          blockColor.bg, blockColor.text
                        )} title={prog.block_name}>
                          {prog.block_name.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center text-gray-500 dark:text-gray-400">
                      {formatTime(prog.start_time)}
                    </td>
                    <td className="px-2 py-1.5 text-center text-gray-500 dark:text-gray-400">
                      {formatTime(prog.end_time)}
                    </td>
                    <td className="px-2 py-1.5 text-center text-gray-500 dark:text-gray-400">
                      {prog.duration_min ? `${Math.round(prog.duration_min)}m` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {isForbidden ? (
                        <span title="Contenu interdit"><Ban className="w-3.5 h-3.5 text-red-500 inline" /></span>
                      ) : isMandatoryMet === false ? (
                        <span title="Obligatoire non respecté"><AlertTriangle className="w-3.5 h-3.5 text-yellow-500 inline" /></span>
                      ) : isMandatoryMet === true ? (
                        <span title="Obligatoire respecté"><Star className="w-3.5 h-3.5 text-green-500 inline" /></span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    {criteria.map(key => {
                      const rawVal = prog.score?.breakdown?.[key as keyof typeof prog.score.breakdown]
                      const criterionData = prog.score?.criteria?.[key as keyof NonNullable<typeof prog.score.criteria>]
                      // Check if skipped via criteria.skipped flag OR if breakdown value is null
                      const isSkipped = criterionData?.skipped === true || rawVal === null || rawVal === undefined
                      const val = isSkipped ? 0 : (rawVal ?? 0)
                      const multiplier = getMultiplierForBlock(prog.block_name, key)
                      const hasMultiplier = multiplier !== 1.0 && !isSkipped
                      const multipliedVal = hasMultiplier ? Math.min(100, val * multiplier) : val
                      return (
                        <td key={key} className={clsx('px-1.5 py-1.5 text-center font-medium', isSkipped ? 'text-gray-400' : getScoreColor(hasMultiplier ? multipliedVal : val))}>
                          <div className="flex flex-col items-center leading-tight">
                            {isSkipped ? (
                              <span>—</span>
                            ) : hasMultiplier ? (
                              <>
                                <span className="text-gray-400 text-[9px] line-through">{val.toFixed(0)}</span>
                                <span className={clsx('font-bold', getScoreColor(multipliedVal))}>
                                  {multipliedVal.toFixed(0)}
                                </span>
                                <span className="text-[7px] text-gray-400">×{multiplier.toFixed(1)}</span>
                              </>
                            ) : (
                              <span>{val.toFixed(0)}</span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                    <td className={clsx('px-2 py-1.5 text-center font-bold', getScoreColor(score), getScoreBg(score))}>
                      {score.toFixed(0)}
                    </td>
                  </tr>

                  {/* Expanded row with details */}
                  {isExpanded && <ExpandedRow prog={prog} block={getBlock(prog.block_name)} profile={profile} />}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
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

  // Loading states
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // Watch for job completion
  useEffect(() => {
    if (currentJob) {
      if (currentJob.status === 'completed') {
        setLastCompletedJob(currentJob)
        if (currentJob.result) {
          setResult(currentJob.result as unknown as ScoringResult)
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

  const handleAnalyze = async () => {
    if (!selectedChannelId || !selectedProfileId) return

    setError(null)
    setResult(null)

    try {
      const response = await scoringApi.analyze({
        channel_id: selectedChannelId,
        profile_id: selectedProfileId,
        cache_mode: cacheMode
      })
      setCurrentJobId(response.job_id)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erreur lors de l'analyse"
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
      const errorMessage = err instanceof Error ? err.message : "Erreur lors de l'export"
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
      const errorMessage = err instanceof Error ? err.message : "Erreur lors de l'export"
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
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
        {t('scoring.title')}
      </h1>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.number ? `${channel.number}. ` : ''}{channel.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Profile selection */}
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} (v{profile.version})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Cache mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Mode d'enrichissement
            </label>
            <div className="flex flex-wrap gap-2">
              {cacheModeOptions.map(option => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    onClick={() => setCacheMode(option.value)}
                    title={option.description}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                      cacheMode === option.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{option.label}</span>
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
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BarChart3 className="w-4 h-4" />
              )}
              <span>{t('scoring.analyze')}</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!result || exporting}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportJSON}
              disabled={!result || exporting}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FileJson className="w-4 h-4" />
              <span>JSON</span>
            </button>

            <button
              onClick={loadData}
              disabled={analyzing}
              className="ml-auto px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right column - Progress Sidebar */}
        <ProgressSidebar job={currentJob ?? null} lastJob={lastCompletedJob} />
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Results header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {result.channel_name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {result.total_items} prog. • {result.violations_count} violations
                  </p>
                </div>
              </div>

              {/* Score */}
              <div className="text-right">
                <div className="text-xs text-gray-500">Score moyen</div>
                <div className={clsx('text-lg font-bold', getScoreColor(result.average_score))}>
                  {result.average_score.toFixed(1)}
                </div>
              </div>
            </div>
          </div>

          {/* Block settings legend */}
          <BlockSettingsLegend
            timeBlocks={(selectedProfile?.time_blocks || []) as TimeBlockWithCriteria[]}
            profile={selectedProfile}
          />

          {/* Scores table */}
          <ScoresTable
            programs={result.programs || []}
            timeBlocks={(selectedProfile?.time_blocks || []) as TimeBlockWithCriteria[]}
            profile={selectedProfile}
          />
        </div>
      )}
    </div>
  )
}
