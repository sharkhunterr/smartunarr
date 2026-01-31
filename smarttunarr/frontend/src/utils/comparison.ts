import type {
  ProgramItem,
  ProgramResult,
  ScoringResult,
  HistoryEntry,
  ComparisonSummary,
  ProgramComparison,
  ComparisonStatus,
} from '@/types'

/**
 * Get programs from a result (works for both ProgramResult and ScoringResult)
 */
function getPrograms(result: ProgramResult | ScoringResult): ProgramItem[] {
  return result.programs || []
}

/**
 * Get total duration from result
 */
function getTotalDuration(result: ProgramResult | ScoringResult): number {
  if ('total_duration_min' in result && result.total_duration_min) {
    return result.total_duration_min
  }
  // Calculate from programs for scoring results
  const programs = getPrograms(result)
  return programs.reduce((sum, p) => sum + (p.duration_min || 0), 0)
}

/**
 * Determine comparison status based on score delta
 */
function getComparisonStatus(
  scoreA: number | null,
  scoreB: number | null,
  threshold = 0.5
): ComparisonStatus {
  if (scoreA === null && scoreB !== null) return 'added'
  if (scoreA !== null && scoreB === null) return 'removed'
  if (scoreA === null || scoreB === null) return 'unchanged'

  const delta = scoreB - scoreA
  if (Math.abs(delta) < threshold) return 'unchanged'
  return delta > 0 ? 'improved' : 'degraded'
}

/**
 * Extract criterion scores from a program
 */
function extractCriteriaScores(program: ProgramItem): Record<string, number | null> {
  const scores: Record<string, number | null> = {}
  const criteria = program.score?.criteria

  if (criteria) {
    for (const [key, criterion] of Object.entries(criteria)) {
      if (criterion && typeof criterion.score === 'number') {
        scores[key] = criterion.score
      } else {
        scores[key] = null
      }
    }
  }

  return scores
}

/**
 * Compare two results and generate comparison summary
 */
export function compareResults(
  entryA: HistoryEntry,
  entryB: HistoryEntry,
  resultA: ProgramResult | ScoringResult,
  resultB: ProgramResult | ScoringResult
): ComparisonSummary {
  const programsA = getPrograms(resultA)
  const programsB = getPrograms(resultB)

  // Create maps by title for matching
  const mapA = new Map<string, ProgramItem>()
  const mapB = new Map<string, ProgramItem>()

  for (const p of programsA) {
    mapA.set(p.title, p)
  }
  for (const p of programsB) {
    mapB.set(p.title, p)
  }

  // Build program comparisons
  const allTitles = new Set([...mapA.keys(), ...mapB.keys()])
  const programComparisons: ProgramComparison[] = []

  for (const title of allTitles) {
    const progA = mapA.get(title)
    const progB = mapB.get(title)

    const scoreA = progA?.score?.total ?? null
    const scoreB = progB?.score?.total ?? null
    const delta = scoreA !== null && scoreB !== null ? scoreB - scoreA : null

    // Build criteria deltas
    const criteriaA = progA ? extractCriteriaScores(progA) : {}
    const criteriaB = progB ? extractCriteriaScores(progB) : {}
    const allCriteria = new Set([...Object.keys(criteriaA), ...Object.keys(criteriaB)])

    const criteriaDeltas: Record<string, { scoreA: number | null; scoreB: number | null; delta: number | null }> = {}
    for (const criterion of allCriteria) {
      const cScoreA = criteriaA[criterion] ?? null
      const cScoreB = criteriaB[criterion] ?? null
      criteriaDeltas[criterion] = {
        scoreA: cScoreA,
        scoreB: cScoreB,
        delta: cScoreA !== null && cScoreB !== null ? cScoreB - cScoreA : null,
      }
    }

    programComparisons.push({
      title,
      status: getComparisonStatus(scoreA, scoreB),
      scoreA,
      scoreB,
      delta,
      criteriaDeltas,
    })
  }

  // Sort: removed first, then by absolute delta descending, then added
  programComparisons.sort((a, b) => {
    // Removed items first
    if (a.status === 'removed' && b.status !== 'removed') return -1
    if (b.status === 'removed' && a.status !== 'removed') return 1
    // Added items last
    if (a.status === 'added' && b.status !== 'added') return 1
    if (b.status === 'added' && a.status !== 'added') return -1
    // Sort by absolute delta descending
    const absA = Math.abs(a.delta ?? 0)
    const absB = Math.abs(b.delta ?? 0)
    return absB - absA
  })

  // Calculate summary stats
  const totalScoreA = resultA.total_score || 0
  const totalScoreB = resultB.total_score || 0
  const averageScoreA = resultA.average_score || 0
  const averageScoreB = resultB.average_score || 0
  const durationA = getTotalDuration(resultA)
  const durationB = getTotalDuration(resultB)

  return {
    entryA: {
      id: entryA.id,
      type: entryA.type,
      date: entryA.created_at,
      channelName: entryA.channel_name,
      profileName: entryA.profile_name,
    },
    entryB: {
      id: entryB.id,
      type: entryB.type,
      date: entryB.created_at,
      channelName: entryB.channel_name,
      profileName: entryB.profile_name,
    },
    totalScoreA,
    totalScoreB,
    totalScoreDelta: totalScoreB - totalScoreA,
    averageScoreA,
    averageScoreB,
    averageScoreDelta: averageScoreB - averageScoreA,
    programCountA: programsA.length,
    programCountB: programsB.length,
    programCountDelta: programsB.length - programsA.length,
    durationMinA: durationA,
    durationMinB: durationB,
    durationDelta: durationB - durationA,
    programComparisons,
  }
}

/**
 * Get color class for delta value
 */
export function getDeltaColor(value: number | null, higherIsBetter = true): string {
  if (value === null || Math.abs(value) < 0.5) return 'text-gray-500'
  if (value > 0) return higherIsBetter ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
  return higherIsBetter ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
}

/**
 * Format delta with sign
 */
export function formatDelta(value: number | null, decimals = 1): string {
  if (value === null) return '-'
  const formatted = Math.abs(value).toFixed(decimals)
  if (Math.abs(value) < 0.1) return '0'
  return value > 0 ? `+${formatted}` : `-${formatted}`
}

/**
 * Get status icon/label key for comparison status
 */
export function getStatusInfo(status: ComparisonStatus): { icon: string; labelKey: string; color: string } {
  switch (status) {
    case 'improved':
      return { icon: '↑', labelKey: 'comparison.statusLabels.improved', color: 'text-green-600 dark:text-green-400' }
    case 'degraded':
      return { icon: '↓', labelKey: 'comparison.statusLabels.degraded', color: 'text-red-600 dark:text-red-400' }
    case 'added':
      return { icon: '+', labelKey: 'comparison.statusLabels.added', color: 'text-blue-600 dark:text-blue-400' }
    case 'removed':
      return { icon: '×', labelKey: 'comparison.statusLabels.removed', color: 'text-orange-600 dark:text-orange-400' }
    default:
      return { icon: '=', labelKey: 'comparison.statusLabels.unchanged', color: 'text-gray-500' }
  }
}

/**
 * Format duration in hours and minutes
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours > 0) {
    return mins > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${hours}h`
  }
  return `${mins}min`
}
