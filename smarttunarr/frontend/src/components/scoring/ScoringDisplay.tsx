/**
 * Shared scoring display components used by both ScoringPage and ProgrammingPage
 * Provides consistent M/F/P (Mandatory/Forbidden/Preferred) visualization
 */
import React, { useState } from 'react'
import clsx from 'clsx'
import { Film, Tv, Star, Ban, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Zap } from 'lucide-react'
import type {
  ProgramItem,
  BlockCriteria,
  CriterionRules,
  TimingDetails,
  MFPPolicy,
  CriterionMultipliers,
  ItemScore,
  Profile
} from '@/types'

// ============================================================================
// Block Colors (shared across pages)
// ============================================================================

export const BLOCK_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-400' },
  { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-400' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-400' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-400' },
  { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-400' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-400' },
]

// ============================================================================
// Constants
// ============================================================================

export const CRITERION_LABELS: Record<string, string> = {
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

// ============================================================================
// Helper Functions
// ============================================================================

/** Normalize accents for comparison (é -> e, è -> e, etc.) */
export function normalizeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Get all terms that match a category (for multilingual support) */
function getCategoryTerms(category: string): string[] {
  const terms = BONUS_CATEGORY_TERMS[category.toLowerCase()] || []
  return [category.toLowerCase(), ...terms]
}

/** Get score color class based on value */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-lime-600 dark:text-lime-400'
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
  if (score >= 20) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

/** Get score background class based on value */
export function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50 dark:bg-green-900/20'
  if (score >= 60) return 'bg-lime-50 dark:bg-lime-900/20'
  if (score >= 40) return 'bg-yellow-50 dark:bg-yellow-900/20'
  if (score >= 20) return 'bg-orange-50 dark:bg-orange-900/20'
  return 'bg-red-50 dark:bg-red-900/20'
}

// ============================================================================
// Score Pill Component
// ============================================================================

interface ScorePillProps {
  value: number | null
}

export function ScorePill({ value }: ScorePillProps) {
  if (value === null) return <span className="text-gray-400 text-[10px]">—</span>
  return (
    <span className={clsx(
      'inline-flex items-center justify-center min-w-[24px] px-1 py-0.5 rounded text-[10px] font-bold text-white',
      value >= 80 ? 'bg-green-500' :
      value >= 60 ? 'bg-lime-500' :
      value >= 40 ? 'bg-yellow-500' :
      value >= 20 ? 'bg-orange-500' :
      'bg-red-500'
    )}>
      {value.toFixed(0)}
    </span>
  )
}

// ============================================================================
// MFP Cell Component
// ============================================================================

interface MFPCellProps {
  values: string[]
  status: boolean | null
  type: 'M' | 'F' | 'P'
  criterion: string
}

export function MFPCell({ values, status, type, criterion }: MFPCellProps) {
  if (values.length === 0) return <span className="text-gray-300 dark:text-gray-600">—</span>

  const colors = {
    M: { active: 'text-orange-600 dark:text-orange-400', inactive: 'text-orange-400/50 dark:text-orange-600/50' },
    F: { active: 'text-red-600 dark:text-red-400', inactive: 'text-red-400/50 dark:text-red-600/50' },
    P: { active: 'text-green-600 dark:text-green-400', inactive: 'text-green-400/50 dark:text-green-600/50' }
  }

  const icons = {
    M: status === true ? '✓' : status === false ? '✗' : '○',
    F: status === true ? '✓' : status === false ? '✗' : '○', // true = no forbidden (good)
    P: status === true ? '★' : '○'
  }

  const bgColors = {
    M: status === true ? 'bg-orange-100 dark:bg-orange-900/30' : status === false ? 'bg-red-100 dark:bg-red-900/30' : '',
    F: status === false ? 'bg-red-100 dark:bg-red-900/30' : '', // false = forbidden found (bad)
    P: status === true ? 'bg-green-100 dark:bg-green-900/30' : ''
  }

  const typeLabels = { M: 'Obligatoire', F: 'Interdit', P: 'Préféré' }
  const statusLabels = {
    M: status === true ? '✓ Respecté' : status === false ? '✗ Non respecté' : 'Non vérifié',
    F: status === true ? '✓ Aucun interdit' : status === false ? '✗ Interdit détecté' : 'Non vérifié',
    P: status === true ? '★ Match' : 'Pas de match'
  }

  // Build tooltip content
  const tooltip = `[${criterion}] ${typeLabels[type]}: ${values.join(', ')}\n${statusLabels[type]}`

  return (
    <div
      className={clsx('px-1 py-0.5 rounded text-[9px] leading-tight cursor-help', bgColors[type])}
      title={tooltip}
    >
      <div className="flex items-center gap-0.5">
        <span className={clsx('font-bold', status !== null ? colors[type].active : colors[type].inactive)}>
          {icons[type]}
        </span>
        <span className={clsx('truncate', status !== null ? colors[type].active : 'text-gray-500 dark:text-gray-400')}>
          {values.slice(0, 2).join(', ')}{values.length > 2 && `+${values.length - 2}`}
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Timing MFP Cell Component
// ============================================================================

interface TimingMFPCellProps {
  type: 'M' | 'F' | 'P'
  timingDetails: TimingDetails | null
}

export function TimingMFPCell({ type, timingDetails }: TimingMFPCellProps) {
  const rules = timingDetails?.timing_rules
  if (!rules) return <span className="text-gray-300 dark:text-gray-600">—</span>

  // Get the threshold for this type
  const threshold = type === 'M' ? rules.mandatory_max_minutes
    : type === 'F' ? rules.forbidden_max_minutes
    : rules.preferred_max_minutes

  if (threshold === null || threshold === undefined) {
    return <span className="text-gray-300 dark:text-gray-600">—</span>
  }

  // Get actual offset
  const isFirst = timingDetails?.is_first_in_block
  const isLast = timingDetails?.is_last_in_block
  const offset = isFirst && isLast
    ? Math.max(timingDetails?.late_start_minutes || 0, timingDetails?.overflow_minutes || 0)
    : isFirst
      ? (timingDetails?.late_start_minutes || 0)
      : (timingDetails?.overflow_minutes || 0)

  // Determine status
  let status: boolean | null = null
  if (isFirst || isLast) {
    if (type === 'F') {
      status = offset <= threshold  // true = no forbidden (good), false = forbidden violated
    } else if (type === 'M') {
      status = offset <= threshold  // true = mandatory met, false = exceeded
    } else if (type === 'P') {
      status = offset <= threshold  // true = within preferred (bonus)
    }
  }

  const colors = {
    M: { active: 'text-orange-600 dark:text-orange-400', inactive: 'text-orange-400/50 dark:text-orange-600/50' },
    F: { active: 'text-red-600 dark:text-red-400', inactive: 'text-red-400/50 dark:text-red-600/50' },
    P: { active: 'text-green-600 dark:text-green-400', inactive: 'text-green-400/50 dark:text-green-600/50' }
  }

  const icons = {
    M: status === true ? '✓' : status === false ? '✗' : '○',
    F: status === true ? '✓' : status === false ? '✗' : '○',
    P: status === true ? '★' : '○'
  }

  const bgColors = {
    M: status === true ? 'bg-orange-100 dark:bg-orange-900/30' : status === false ? 'bg-red-100 dark:bg-red-900/30' : '',
    F: status === false ? 'bg-red-100 dark:bg-red-900/30' : '',
    P: status === true ? 'bg-green-100 dark:bg-green-900/30' : ''
  }

  const operator = type === 'F' ? '>' : '≤'
  const label = `${operator}${threshold}min`
  const typeLabels = { M: 'Obligatoire', F: 'Interdit', P: 'Préféré' }
  const tooltip = `[Timing] ${typeLabels[type]}: ${label}\nActuel: ${offset.toFixed(0)}min\n${status === true ? '✓ OK' : status === false ? '✗ Dépassé' : 'Non applicable'}`

  return (
    <div
      className={clsx('px-1 py-0.5 rounded text-[9px] leading-tight cursor-help', bgColors[type])}
      title={tooltip}
    >
      <div className="flex items-center gap-0.5">
        <span className={clsx('font-bold', status !== null ? colors[type].active : colors[type].inactive)}>
          {icons[type]}
        </span>
        <span className={clsx('truncate', status !== null ? colors[type].active : 'text-gray-500 dark:text-gray-400')}>
          {label}
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Scoring Expandable Row Component
// ============================================================================

export interface ScoringExpandableRowProps {
  prog: ProgramItem
  score: ItemScore | null | undefined
  criteria: BlockCriteria
  profile?: Profile | null
}

interface CriteriaRow {
  key: string
  label: string
  content: string | null
  contentValues: string[]
}

interface Violation {
  type: 'M' | 'F'
  criterion: string
  expected: string[]
  content: string[]
}

export function ScoringExpandableRow({ prog, score, criteria, profile }: ScoringExpandableRowProps) {
  // Get MFP policy (block-level or profile-level)
  const mfpPolicy: MFPPolicy = criteria.mfp_policy ?? profile?.mfp_policy ?? {
    mandatory_matched_bonus: 10,
    mandatory_missed_penalty: -40,
    forbidden_detected_penalty: -400,
    preferred_matched_bonus: 20
  }

  // Get criterion multipliers (block-level or profile-level)
  const multipliers: CriterionMultipliers = criteria.criterion_multipliers ?? profile?.criterion_multipliers ?? {}

  // Get multiplier for a criterion
  const getMultiplier = (key: keyof CriterionMultipliers): number => {
    return multipliers[key] ?? 1.0
  }

  // Get score for a criterion
  const getScore = (key: string): number | null => {
    const criterionData = score?.criteria?.[key as keyof NonNullable<typeof score.criteria>]
    if (criterionData?.skipped) return null
    return score?.breakdown?.[key as keyof typeof score.breakdown] ?? null
  }

  // Get criterion-specific rules from block criteria
  const getCriterionRules = (criterionKey: string): CriterionRules | undefined => {
    const rulesKey = `${criterionKey}_rules` as keyof BlockCriteria
    return criteria[rulesKey] as CriterionRules | undefined
  }

  // Get M/F/P values for a criterion
  const getMFPValues = (criterionKey: string): { m: string[], f: string[], p: string[] } => {
    const rules = getCriterionRules(criterionKey)
    let m: string[] = []
    let f: string[] = []
    let p: string[] = []

    // Add rule values
    if (rules) {
      m = [...(rules.mandatory_values || [])]
      f = [...(rules.forbidden_values || [])]
      p = [...(rules.preferred_values || [])]
    }

    // Add criterion-specific explicit values
    switch (criterionKey) {
      case 'type':
        m = [...m, ...(criteria.allowed_types || [])]
        f = [...f, ...(criteria.excluded_types || [])]
        p = [...p, ...(criteria.preferred_types || [])]
        break
      case 'genre':
        m = [...m, ...(criteria.allowed_genres || [])]
        f = [...f, ...(criteria.forbidden_genres || [])]
        p = [...p, ...(criteria.preferred_genres || [])]
        break
      case 'age':
        m = [...m, ...(criteria.allowed_age_ratings || [])]
        break
      case 'filter':
        m = [...m, ...(criteria.include_keywords || [])]
        f = [...f, ...(criteria.exclude_keywords || [])]
        break
    }

    return { m, f, p }
  }

  // Normalize age rating (e.g., "fr/Tous publics" -> "tous publics", "fr/12" -> "12")
  const normalizeAgeRating = (rating: string): string[] => {
    const lower = rating.toLowerCase().trim()
    const results: string[] = [lower]
    // Handle country-prefixed formats (e.g., "fr/u", "us/pg-13")
    if (lower.includes('/')) {
      const parts = lower.split('/')
      const actualRating = parts[parts.length - 1].trim()
      results.push(actualRating)
    }
    // Map common ratings to equivalent levels
    const levelMap: Record<string, string[]> = {
      'tous publics': ['g', 'tp', 'tous publics', 'u'],
      'tp': ['g', 'tp', 'tous publics', 'u'],
      'u': ['g', 'tp', 'tous publics', 'u'],
      'g': ['g', 'tp', 'tous publics', 'u'],
      'pg': ['pg', '10', '+10', '-10', '10+'],
      'pg-13': ['pg-13', '12', '+12', '-12', '12+', '12a'],
      '12': ['pg-13', '12', '+12', '-12', '12+', '12a'],
      'r': ['r', '16', '+16', '-16', '16+', 'tv-ma'],
      '16': ['r', '16', '+16', '-16', '16+', 'tv-ma'],
      'nc-17': ['nc-17', '18', '+18', '-18', '18+'],
      '18': ['nc-17', '18', '+18', '-18', '18+'],
    }
    // Find equivalents for the normalized rating (iterate over a COPY to avoid infinite loop)
    const initialResults = [...results]
    for (const val of initialResults) {
      if (levelMap[val]) {
        results.push(...levelMap[val])
      }
    }
    return [...new Set(results)]
  }

  // Check if content matches M/F/P
  // Uses EXACT matching (after normalization) to avoid false positives like "PG" matching "G"
  // Returns null for all statuses if no content values to check (e.g., timing, duration, rating)
  const checkMFPStatus = (criterionKey: string, contentValues: string[]): { mOk: boolean | null, fOk: boolean | null, pOk: boolean | null } => {
    // If no content values to check, we can't determine M/F/P status
    if (contentValues.length === 0) {
      return { mOk: null, fOk: null, pOk: null }
    }

    const { m, f, p } = getMFPValues(criterionKey)

    // Special handling for age criterion - use normalized age rating matching
    const isAgeCriterion = criterionKey === 'age'

    // Normalize content values
    let contentLower: string[]
    if (isAgeCriterion) {
      // For age ratings, expand to all equivalent values
      contentLower = contentValues.flatMap(v => normalizeAgeRating(v))
    } else {
      contentLower = contentValues.map(v => normalizeAccents(v.toLowerCase().trim()))
    }

    // Helper to check if a rule value matches content
    const matchesContent = (ruleValue: string): boolean => {
      if (isAgeCriterion) {
        // For age ratings, use exact matching on normalized values
        const ruleNorm = normalizeAccents(ruleValue.toLowerCase().trim())
        return contentLower.includes(ruleNorm)
      } else {
        // For other criteria, use category-based matching
        const terms = getCategoryTerms(ruleValue)
        return terms.some(term => {
          const termNorm = normalizeAccents(term.toLowerCase())
          // Use word-boundary matching to avoid false positives (e.g., "r" in "horror")
          return contentLower.some(cv => {
            // Exact match
            if (cv === termNorm) return true
            // Word boundary match (term must be a complete word in cv)
            const wordRegex = new RegExp(`\\b${termNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
            return wordRegex.test(cv)
          })
        })
      }
    }

    // Mandatory: null if not defined, true if any match, false if no match
    let mOk: boolean | null = null
    if (m.length > 0) {
      mOk = m.some(mv => matchesContent(mv))
    }

    // Forbidden: null if not defined, true if no match (good), false if any match (bad)
    let fOk: boolean | null = null
    if (f.length > 0) {
      const hasForbidden = f.some(fv => matchesContent(fv))
      fOk = !hasForbidden // true = no forbidden found (good)
    }

    // Preferred: null if not defined, true if any match
    let pOk: boolean | null = null
    if (p.length > 0) {
      pOk = p.some(pv => matchesContent(pv))
    }

    return { mOk, fOk, pOk }
  }

  // Build row data with MFP info
  const criteriaRows: CriteriaRow[] = [
    { key: 'duration', label: 'Durée', content: prog.duration_min ? `${Math.round(prog.duration_min)}min` : null, contentValues: [] },
    { key: 'type', label: 'Type', content: prog.type ? (prog.type === 'movie' ? 'Film' : prog.type === 'episode' ? 'Série' : prog.type) : null, contentValues: prog.type ? [prog.type] : [] },
    { key: 'genre', label: 'Genre', content: prog.genres?.join(', ') || null, contentValues: prog.genres || [] },
    { key: 'timing', label: 'Timing', content: (() => {
      const td = score?.criteria?.timing?.details as TimingDetails | null
      if (!td) return null
      if (td.skipped) return null  // Middle programs

      const isFirst = td.is_first_in_block
      const isLast = td.is_last_in_block
      if (!isFirst && !isLast) return null

      const lateStart = td.late_start_minutes || 0
      const overflow = td.overflow_minutes || 0
      const early = td.early_start_minutes || 0
      const parts: string[] = []

      // First in block: check late start or early start
      if (isFirst) {
        if (lateStart > 2) {
          parts.push(`Retard +${lateStart.toFixed(0)}min`)
        } else if (early > 2) {
          parts.push(`Avance -${early.toFixed(0)}min`)
        }
      }

      // Last in block: check overflow
      if (isLast && overflow > 2) {
        parts.push(`Dépassement +${overflow.toFixed(0)}min`)
      }

      if (parts.length > 0) return parts.join(', ')
      return 'OK'
    })(), contentValues: [] },
    { key: 'strategy', label: 'Strat.', content: null, contentValues: [] },
    { key: 'age', label: 'Âge', content: prog.content_rating || null, contentValues: prog.content_rating ? [prog.content_rating] : [] },
    { key: 'rating', label: 'Note', content: prog.tmdb_rating && !isNaN(Number(prog.tmdb_rating)) ? `${Number(prog.tmdb_rating).toFixed(1)}/10` : null, contentValues: [] },
    { key: 'filter', label: 'Filtre', content: prog.keywords?.slice(0, 3).join(', ') || null, contentValues: prog.keywords || [] },
    { key: 'bonus', label: 'Bonus', content: score?.bonuses?.slice(0, 2).join(', ') || null, contentValues: score?.bonuses || [] },
  ]

  // Collect violations for summary (after criteriaRows is defined)
  // Only include violations for criteria that:
  // 1. Are not skipped (e.g., timing for middle programs)
  // 2. Have contentValues to check (duration/timing don't have string values to match)
  const violations: Violation[] = []
  criteriaRows.forEach(row => {
    // Skip if criterion is skipped (not applicable)
    const criterionData = score?.criteria?.[row.key as keyof NonNullable<typeof score.criteria>]
    if (criterionData?.skipped) return

    // Skip if no content values to check (duration, timing, rating use numeric ranges, not string matching)
    if (row.contentValues.length === 0) return

    const { m, f } = getMFPValues(row.key)
    const { mOk, fOk } = checkMFPStatus(row.key, row.contentValues)
    if (mOk === false && m.length > 0) {
      violations.push({ type: 'M', criterion: row.label, expected: m, content: row.contentValues })
    }
    if (fOk === false && f.length > 0) {
      violations.push({ type: 'F', criterion: row.label, expected: f, content: row.contentValues })
    }
  })

  return (
    <tr className="bg-gray-50/50 dark:bg-gray-800/30">
      <td colSpan={16} className="p-2">
        {/* Compact header bar */}
        <div className={clsx(
          'flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1.5',
          score?.forbidden_violated ? 'bg-red-500' :
          (score?.total ?? 0) >= 80 ? 'bg-green-500' :
          (score?.total ?? 0) >= 60 ? 'bg-lime-500' :
          (score?.total ?? 0) >= 40 ? 'bg-yellow-500' :
          (score?.total ?? 0) >= 20 ? 'bg-orange-500' :
          'bg-red-500'
        )}>
          {prog.type === 'movie' ? <Film className="w-3.5 h-3.5 text-white/80" /> : <Tv className="w-3.5 h-3.5 text-white/80" />}
          <span className="font-semibold text-white text-xs truncate flex-1">{prog.title}</span>
          <div className="flex items-center gap-1.5 text-white/80 text-[10px]">
            {prog.year && <span>{prog.year}</span>}
            {prog.duration_min && <span>{Math.round(prog.duration_min)}m</span>}
            {prog.tmdb_rating && !isNaN(Number(prog.tmdb_rating)) && (
              <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-current" />{Number(prog.tmdb_rating).toFixed(1)}</span>
            )}
          </div>
          <span className="text-lg font-black text-white ml-1">{(score?.total ?? 0).toFixed(0)}</span>
          {score?.forbidden_violated && <Ban className="w-3.5 h-3.5 text-white" />}
        </div>

        {/* Criteria table with M/F/P columns */}
        <div className="rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-[10px]">
            <thead className="bg-gray-100 dark:bg-gray-900/50">
              <tr>
                <th className="px-1.5 py-1 text-left font-medium text-gray-500 dark:text-gray-400 w-12">Crit.</th>
                <th className="px-1.5 py-1 text-left font-medium text-gray-500 dark:text-gray-400 w-24">Contenu</th>
                <th className="px-1.5 py-1 text-left font-medium text-orange-500 w-28">M (Obligatoire)</th>
                <th className="px-1.5 py-1 text-left font-medium text-red-500 w-28">F (Interdit)</th>
                <th className="px-1.5 py-1 text-left font-medium text-green-500 w-28">P (Préféré)</th>
                <th className="px-1.5 py-1 text-center font-medium text-purple-500 w-10">×</th>
                <th className="px-1.5 py-1 text-center font-medium text-gray-500 dark:text-gray-400 w-10">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {criteriaRows.map((row, idx) => {
                const { m, f, p } = getMFPValues(row.key)
                const { mOk, fOk, pOk } = checkMFPStatus(row.key, row.contentValues)
                const multiplier = getMultiplier(row.key as keyof CriterionMultipliers)
                const scoreVal = getScore(row.key)

                // Special handling for timing: use minute-based M/F/P display
                const isTiming = row.key === 'timing'
                const timingDetails = isTiming ? (score?.criteria?.timing?.details as TimingDetails | null) : null

                return (
                  <tr key={row.key} className={clsx(
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-900/20'
                  )}>
                    <td className="px-1.5 py-1 font-medium text-gray-700 dark:text-gray-300">{row.label}</td>
                    <td className="px-1.5 py-1 text-gray-900 dark:text-white truncate max-w-[100px]" title={row.content || ''}>
                      {row.content || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-1.5 py-1">
                      {isTiming ? (
                        <TimingMFPCell type="M" timingDetails={timingDetails} />
                      ) : (
                        <MFPCell values={m} status={mOk} type="M" criterion={row.label} />
                      )}
                    </td>
                    <td className="px-1.5 py-1">
                      {isTiming ? (
                        <TimingMFPCell type="F" timingDetails={timingDetails} />
                      ) : (
                        <MFPCell values={f} status={fOk} type="F" criterion={row.label} />
                      )}
                    </td>
                    <td className="px-1.5 py-1">
                      {isTiming ? (
                        <TimingMFPCell type="P" timingDetails={timingDetails} />
                      ) : (
                        <MFPCell values={p} status={pOk} type="P" criterion={row.label} />
                      )}
                    </td>
                    <td className="px-1.5 py-1 text-center">
                      {multiplier !== 1.0 ? (
                        <span className="text-purple-600 dark:text-purple-400 font-medium">×{multiplier.toFixed(1)}</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1 text-center">
                      <ScorePill value={scoreVal} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Violations summary */}
        {violations.length > 0 && (
          <div className="mt-1.5 rounded border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 p-1.5">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-red-700 dark:text-red-300 mb-1">
              <AlertTriangle className="w-3 h-3" />
              {violations.length} violation(s) détectée(s)
            </div>
            <div className="space-y-0.5">
              {violations.map((v, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[9px]">
                  <span className={clsx(
                    'font-bold px-1 rounded',
                    v.type === 'M' ? 'bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300' :
                    'bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300'
                  )}>
                    {v.type === 'M' ? 'M' : 'F'}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    <strong>{v.criterion}</strong>:
                    {v.type === 'M' ? (
                      <> Requis <span className="text-orange-600 dark:text-orange-400">{v.expected.join(', ')}</span> — Contenu: <span className="text-gray-500">{v.content.length > 0 ? v.content.join(', ') : 'aucun'}</span></>
                    ) : (
                      <> Interdit <span className="text-red-600 dark:text-red-400">{v.expected.join(', ')}</span> — Trouvé: <span className="text-red-500">{v.content.filter(c => v.expected.some(e => normalizeAccents(c.toLowerCase()).includes(normalizeAccents(e.toLowerCase())))).join(', ')}</span></>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compact MFP policy footer */}
        <div className="mt-1 flex items-center gap-3 text-[9px] text-gray-500 dark:text-gray-400">
          <span>MFP:</span>
          <span className="text-orange-500">M: +{mfpPolicy.mandatory_matched_bonus}/{mfpPolicy.mandatory_missed_penalty}</span>
          <span className="text-red-500">F: {mfpPolicy.forbidden_detected_penalty}</span>
          <span className="text-green-500">P: +{mfpPolicy.preferred_matched_bonus}</span>
        </div>
      </td>
    </tr>
  )
}

// ============================================================================
// Shared TimeBlock type for ScoresTable
// ============================================================================

export interface TimeBlockWithCriteria {
  name: string
  start_time: string
  end_time: string
  criteria?: BlockCriteria
}

// ============================================================================
// Offset calculation result type
// ============================================================================

export interface OffsetResult {
  offset: number
  status: 'early' | 'late' | 'on_time'
  type: 'block_start' | 'block_end' | 'gap'
}

// ============================================================================
// Shared ScoresTable Component
// ============================================================================

export interface ScoresTableProps {
  programs: ProgramItem[]
  timeBlocks?: TimeBlockWithCriteria[]
  profile?: Profile | null
  /** Show offset column (for ProgrammingPage) */
  showOffset?: boolean
  /** Calculate offset for a program (for ProgrammingPage) */
  calculateOffset?: (programs: ProgramItem[], index: number, timeBlocks: TimeBlockWithCriteria[]) => OffsetResult
  /** Max height of the table */
  maxHeight?: string
}

/** Format ISO time string to HH:MM */
function formatTime(isoString: string): string {
  if (!isoString) return '—'
  try {
    return new Date(isoString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export function ScoresTable({
  programs,
  timeBlocks = [],
  profile,
  showOffset = false,
  calculateOffset,
  maxHeight = '500px'
}: ScoresTableProps) {
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden overflow-y-auto" style={{ maxHeight }}>
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
              {showOffset && (
                <th className="px-2 py-2 text-center font-medium text-gray-600 dark:text-gray-400 w-12" title="Décalage par rapport à l'heure prévue du bloc">
                  Décal.
                </th>
              )}
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
              const currentBlock = getBlock(prog.block_name)

              // Calculate offset if function provided
              const offsetResult = showOffset && calculateOffset
                ? calculateOffset(programs, idx, timeBlocks)
                : null

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
                        {prog.is_replacement && (
                          <span
                            className={clsx(
                              'inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium flex-shrink-0',
                              prog.replacement_reason === 'forbidden'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            )}
                            title={prog.replaced_title ? `Remplace: ${prog.replaced_title}` : 'Contenu de remplacement'}
                          >
                            {prog.replacement_reason === 'forbidden' ? (
                              <RefreshCw className="w-2.5 h-2.5" />
                            ) : (
                              <Zap className="w-2.5 h-2.5" />
                            )}
                          </span>
                        )}
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
                    {showOffset && offsetResult && (
                      <td className="px-2 py-1.5 text-center">
                        {offsetResult.status === 'on_time' ? (
                          <span className="text-gray-400">—</span>
                        ) : offsetResult.status === 'late' ? (
                          <span
                            className="font-medium text-red-500"
                            title={
                              offsetResult.type === 'block_start'
                                ? `⚠️ Début ${offsetResult.offset} min après le début du bloc`
                                : offsetResult.type === 'block_end'
                                ? `⚠️ Déborde de ${offsetResult.offset} min après la fin du bloc`
                                : `${offsetResult.offset} min de trou après le programme précédent`
                            }
                          >
                            +{offsetResult.offset}
                          </span>
                        ) : (
                          <span
                            className={clsx('font-medium', offsetResult.type === 'gap' ? 'text-orange-400' : 'text-blue-500')}
                            title={
                              offsetResult.type === 'block_start'
                                ? `Début ${Math.abs(offsetResult.offset)} min avant le bloc (OK)`
                                : offsetResult.type === 'block_end'
                                ? `Fin ${Math.abs(offsetResult.offset)} min avant la fin du bloc (OK)`
                                : `${Math.abs(offsetResult.offset)} min de chevauchement`
                            }
                          >
                            {offsetResult.offset}
                          </span>
                        )}
                      </td>
                    )}
                    {showOffset && !offsetResult && (
                      <td className="px-2 py-1.5 text-center text-gray-400">—</td>
                    )}
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

                  {/* Expanded row with M/F/P scoring display */}
                  {isExpanded && currentBlock?.criteria && (
                    <ScoringExpandableRow
                      prog={prog}
                      score={prog.score}
                      criteria={currentBlock.criteria}
                      profile={profile}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
