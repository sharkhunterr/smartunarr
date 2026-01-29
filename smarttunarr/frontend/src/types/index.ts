// Channel types
export interface TunarrChannel {
  id: string
  name: string
  number: number
  icon?: string
  programs?: ProgramItem[]
}

// Profile types
export interface LibraryConfig {
  id: string
  name: string
  type?: string
  weight: number
}

// Per-criterion rules (optional)
export interface CriterionRules {
  mandatory_values?: string[]
  mandatory_penalty?: number
  forbidden_values?: string[]
  forbidden_penalty?: number
  preferred_values?: string[]
  preferred_bonus?: number
}

export interface BlockCriteria {
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
  max_release_age_years?: number
  // Keyword modifiers
  exclude_keywords?: string[]
  include_keywords?: string[]
  // Per-criterion rules (optional - if not defined, normal calculation applies)
  type_rules?: CriterionRules
  duration_rules?: CriterionRules
  genre_rules?: CriterionRules
  timing_rules?: CriterionRules
  strategy_rules?: CriterionRules
  age_rules?: CriterionRules
  rating_rules?: CriterionRules
  filter_rules?: CriterionRules
  bonus_rules?: CriterionRules
}

export interface TimeBlock {
  name: string
  start_time: string
  end_time: string
  criteria: BlockCriteria
}

export interface MandatoryRules {
  content_ids?: string[]
  min_duration_min?: number
  min_tmdb_rating?: number
  required_genres?: string[]
}

export interface ForbiddenRules {
  content_ids?: string[]
  types?: string[]
  keywords?: string[]
  genres?: string[]
}

export interface PreferredRules {
  genres?: string[]
  keywords?: string[]
  collections?: string[]
  studios?: string[]
  actors?: string[]
  directors?: string[]
  countries?: string[]
  languages?: string[]
}

export interface MandatoryForbiddenCriteria {
  mandatory: MandatoryRules
  forbidden: ForbiddenRules
  preferred?: PreferredRules
  // Profile-level keyword modifiers
  exclude_keywords?: string[]
  include_keywords?: string[]
}

export interface FillerInsertion {
  enabled: boolean
  types: string[]
  max_duration_min?: number
}

export interface Bonuses {
  holiday_bonus: boolean
  recent_release_bonus: boolean
}

export interface Strategies {
  maintain_sequence: boolean
  maximize_variety: boolean
  marathon_mode: boolean
  filler_insertion: FillerInsertion
  bonuses: Bonuses
}

export interface ScoringWeights {
  type: number
  duration: number
  genre: number
  timing: number
  strategy: number
  age: number
  rating: number
  filter: number
  bonus: number
}

export interface Profile {
  id: string
  name: string
  version: string
  libraries: LibraryConfig[]
  time_blocks: TimeBlock[]
  mandatory_forbidden_criteria: MandatoryForbiddenCriteria
  strategies?: Strategies
  scoring_weights: ScoringWeights
  default_iterations: number
  default_randomness: number
  labels: string[]
  created_at?: string
  updated_at?: string
}

// Programming types
export interface ProgramItem {
  id: string
  title: string
  type: 'movie' | 'episode' | 'filler'
  start_time: string
  end_time: string
  duration_min: number
  genres?: string[]
  keywords?: string[]
  year?: number
  tmdb_rating?: number
  content_rating?: string
  poster_url?: string
  plex_key?: string
  block_name?: string
  score?: ItemScore
}

// Rule violation for a criterion
export interface RuleViolation {
  rule_type: 'mandatory' | 'forbidden' | 'preferred'
  values: string[]
  penalty_or_bonus: number
}

// Timing criterion details
export interface TimingDetails {
  is_first_in_block: boolean
  is_last_in_block: boolean
  overflow_minutes: number | null  // For last in block: positive = overflow past end
  late_start_minutes: number | null  // For first in block: positive = late
  early_start_minutes: number | null  // For first in block: positive = early
  final_score: number
}

// Criterion score with optional rule violation and details
export interface CriterionScore {
  score: number
  weight: number
  details?: TimingDetails | Record<string, unknown> | null  // Criterion-specific details
  rule_violation?: RuleViolation | null
}

export interface ItemScore {
  total: number
  breakdown: {
    type: number
    duration: number
    genre: number
    timing: number
    strategy: number
    age: number
    rating: number
    filter: number
    bonus: number
  }
  // Detailed criteria with rule violations
  criteria?: {
    type?: CriterionScore
    duration?: CriterionScore
    genre?: CriterionScore
    timing?: CriterionScore
    strategy?: CriterionScore
    age?: CriterionScore
    rating?: CriterionScore
    filter?: CriterionScore
    bonus?: CriterionScore
  }
  penalties: string[]
  bonuses: string[]
  mandatory_met: boolean
  forbidden_violated: boolean
  forbidden_details?: Array<{ message?: string; rule?: string }>
  mandatory_details?: Array<{ message?: string; rule?: string }>
  // Keyword multiplier info
  keyword_multiplier?: number
  keyword_match?: 'exclude' | 'include' | null
  // Per-criterion rule violations summary
  criterion_rule_violations?: Record<string, RuleViolation>
}

export interface IterationResult {
  iteration: number
  programs: ProgramItem[]
  total_score: number
  average_score: number
  total_duration_min: number
  program_count: number
}

export interface ProgramResult {
  id: string
  channel_id: string
  profile_id: string
  programs: ProgramItem[]
  total_score: number
  average_score: number
  total_duration_min: number
  iteration: number
  created_at: string
  // All iterations sorted by score descending
  all_iterations?: IterationResult[]
  total_iterations?: number
  // Time blocks for rendering
  time_blocks?: TimeBlock[]
}

// Programming request types
export interface ProgrammingRequest {
  channel_id: string
  profile_id: string
  iterations: number
  randomness: number
  cache_mode: 'none' | 'plex_only' | 'tmdb_only' | 'cache_only' | 'full' | 'enrich_cache'
  preview_only: boolean
  duration_days: number  // Number of days to program (1-30)
  start_datetime?: string  // ISO format datetime
}

export interface AIProgrammingRequest {
  channel_id: string
  prompt: string
  model?: string
  temperature?: number
  iterations: number
  randomness: number
  cache_mode: 'none' | 'plex_only' | 'tmdb_only' | 'cache_only' | 'full' | 'enrich_cache'
  preview_only: boolean
  save_profile?: boolean
  profile_name?: string
  duration_days: number  // Number of days to program (1-30)
  start_datetime?: string  // ISO format datetime
}

// Scoring types
export type ScoringCacheMode = 'none' | 'cache_only' | 'full'  // full = cache + TMDB enrichment

export interface ScoringRequest {
  channel_id: string
  profile_id: string
  cache_mode?: ScoringCacheMode
}

export interface ScoringResult {
  id: string
  channel_id: string
  channel_name: string
  profile_id: string
  profile_name: string
  programs: ProgramItem[]
  total_score: number
  average_score: number
  total_items: number
  violations_count: number
  mandatory_violations: string[]
  forbidden_violations: string[]
  penalties_applied: string[]
  bonuses_applied: string[]
  score_distribution: Record<string, number>
  created_at: string
}

// Service types
export interface ServiceConfig {
  service_type: string
  url?: string
  username?: string
  has_token?: boolean
  has_api_key?: boolean
  is_configured: boolean
}

export interface ConnectionTestResponse {
  success: boolean
  message: string
}

// Job types
export interface Job {
  id: string
  type: 'programming' | 'scoring' | 'sync' | 'ai_generation' | 'preview'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  title: string
  progress: number
  currentStep?: string
  bestScore?: number
  currentIteration?: number
  totalIterations?: number
  // Progress details
  libraryName?: string
  librariesFetched?: number
  totalLibraries?: number
  totalContent?: number
  programsCount?: number
  bestIteration?: number
  phase?: string
  // Error and result
  error?: string
  errorMessage?: string
  result?: ProgramResult | ScoringResult
  startedAt: string
  completedAt?: string
}

// Job API response
export interface JobResponse {
  job_id: string
  status: string
  message: string
}

// History types
export interface HistoryEntry {
  id: string
  type: 'programming' | 'scoring' | 'ai_generation'
  status: 'success' | 'failed' | 'cancelled'
  channel_id?: string
  channel_name?: string
  profile_id?: string
  profile_name?: string
  score?: number
  iterations?: number
  duration_sec?: number
  error?: string
  result_id?: string
  created_at: string
}

// Ollama types
export interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
}

// Plex types
export interface PlexLibrary {
  id: string
  key: string
  title: string
  type: string
  agent: string
  scanner: string
}
