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
  enabled?: boolean
}

// Per-criterion rules (optional)
export interface CriterionRules {
  mandatory_values?: string[]
  mandatory_penalty?: number
  forbidden_values?: string[]
  forbidden_penalty?: number
  preferred_values?: string[]
  preferred_bonus?: number
  // Timing-specific fields
  preferred_max_minutes?: number
  mandatory_max_minutes?: number
  forbidden_max_minutes?: number
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
  // Block-level M/F/P policy (overrides profile-level)
  mfp_policy?: MFPPolicy
  // Block-level criterion multipliers (overrides profile-level)
  criterion_multipliers?: CriterionMultipliers
}

export interface TimeBlock {
  name: string
  description?: string
  start_time: string
  end_time: string
  criteria: BlockCriteria
}

export interface MandatoryRules {
  content_ids?: string[]
  min_duration_min?: number
  min_tmdb_rating?: number
  min_vote_count?: number
  required_genres?: string[]
  allowed_age_ratings?: string[]
}

export interface ForbiddenRules {
  content_ids?: string[]
  types?: string[]
  keywords?: string[]
  genres?: string[]
  age_ratings?: string[]
  collections?: string[]
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
  holiday_bonus?: boolean
  recent_release_bonus?: boolean
  popular_content_bonus?: boolean
}

export interface Strategies {
  maintain_sequence?: boolean
  maximize_variety?: boolean
  marathon_mode?: boolean
  avoid_repeats_days?: number
  filler_insertion?: FillerInsertion
  bonuses?: Bonuses
}

// Enhanced criteria types
export interface KeywordsSafety {
  enabled: boolean
  safe_keywords?: string[]
  dangerous_keywords?: string[]
  safe_bonus_points?: number
  dangerous_penalty_points?: number
}

export interface CollectionsFranchises {
  enabled: boolean
  preferred_collections?: string[]
  preferred_franchises?: string[]
  forbidden_collections?: string[]
  collection_bonus_points?: number
  franchise_bonus_points?: number
}

export interface RecencyBonuses {
  enabled?: boolean
  very_recent_days?: number
  very_recent_bonus?: number
  recent_months?: number
  recent_bonus?: number
  this_year_bonus?: number
  max_age_years?: number
  old_content_penalty?: number
}

export interface TemporalIntelligence {
  enabled: boolean
  recency_bonuses?: RecencyBonuses
}

export interface VoteReliability {
  enabled?: boolean
  excellent_votes?: number
  good_votes?: number
  acceptable_votes?: number
  minimum_votes?: number
}

export interface QualityIndicators {
  enabled: boolean
  vote_reliability?: VoteReliability
}

export interface EnhancedCriteria {
  keywords_safety?: KeywordsSafety
  collections_franchises?: CollectionsFranchises
  temporal_intelligence?: TemporalIntelligence
  quality_indicators?: QualityIndicators
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

// M/F/P (Mandatory/Forbidden/Preferred) point policy
export interface MFPPolicy {
  mandatory_matched_bonus?: number      // Bonus when mandatory requirement is met (default: 10)
  mandatory_missed_penalty?: number     // Penalty when mandatory requirement is not met (default: -40)
  forbidden_detected_penalty?: number   // Penalty when forbidden value is detected (default: -400)
  preferred_matched_bonus?: number      // Bonus when preferred value is matched (default: 20)
}

// Multipliers for each scoring criterion (default 1.0 = no change)
export interface CriterionMultipliers {
  type?: number
  duration?: number
  genre?: number
  timing?: number
  strategy?: number
  age?: number
  rating?: number
  filter?: number
  bonus?: number
}

export interface Profile {
  id: string
  name: string
  version: string
  description?: string
  libraries: LibraryConfig[]
  time_blocks: TimeBlock[]
  mandatory_forbidden_criteria: MandatoryForbiddenCriteria
  enhanced_criteria?: EnhancedCriteria
  strategies?: Strategies
  scoring_weights: ScoringWeights
  mfp_policy?: MFPPolicy                    // Profile-level M/F/P point policy
  criterion_multipliers?: CriterionMultipliers  // Profile-level criterion multipliers
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
  // Replacement info (for optimized/improved iterations)
  is_replacement?: boolean
  replacement_reason?: 'forbidden' | 'improved' | null
  replaced_title?: string | null
  // AI improvement flag
  is_ai_improved?: boolean
}

// Rule violation for a criterion
export interface RuleViolation {
  rule_type: 'mandatory' | 'forbidden' | 'preferred'
  values: string[]
  penalty_or_bonus: number
}

// Timing rules thresholds (minute-based M/F/P)
export interface TimingRulesThresholds {
  preferred_max_minutes: number | null  // Bonus if offset <= this
  mandatory_max_minutes: number | null  // OK if <= this, penalty if >
  forbidden_max_minutes: number | null  // Violation if offset > this
}

// Timing criterion details
export interface TimingDetails {
  is_first_in_block: boolean
  is_last_in_block: boolean
  overflow_minutes: number | null  // For last in block: positive = overflow past end
  late_start_minutes: number | null  // For first in block: positive = late
  early_start_minutes: number | null  // For first in block: positive = early
  final_score: number | null  // null if skipped (middle programs)
  skipped: boolean  // true for middle programs (not first, not last)
  timing_rules?: TimingRulesThresholds  // Minute-based M/F/P thresholds
}

// Criterion score with optional rule violation and details
export interface CriterionScore {
  score: number | null  // null if skipped
  weight: number
  weighted_score: number
  multiplier: number                  // Criterion multiplier (default: 1.0)
  multiplied_weighted_score: number   // weighted_score * multiplier
  details?: TimingDetails | Record<string, unknown> | null  // Criterion-specific details
  rule_violation?: RuleViolation | null
  skipped?: boolean  // true if this criterion is not applicable (e.g., timing for middle programs)
}

export interface ItemScore {
  total: number
  breakdown: {
    type: number | null
    duration: number | null
    genre: number | null
    timing: number | null  // null for middle programs (not first, not last in block)
    strategy: number | null
    age: number | null
    rating: number | null
    filter: number | null
    bonus: number | null
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
  is_optimized?: boolean  // True if this is the forbidden-replacement optimized iteration
  is_improved?: boolean  // True if this is the improved iteration (better programs from other iterations)
  is_ai_improved?: boolean  // True if this is the AI-improved iteration
}

// AI modification suggestion
export interface AIModification {
  action: 'replace' | 'reorder' | 'remove' | 'modify'
  original_title: string
  replacement_title?: string  // For replace action - the title to replace with
  reason: string
}

// AI response from generation
export interface AIResponse {
  analysis?: string
  modifications?: AIModification[]
  summary?: string
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
  // AI response from generation
  ai_response?: AIResponse | null
}

// Programming request types
export interface ProgrammingRequest {
  channel_id: string
  profile_id: string
  iterations: number
  randomness: number
  cache_mode: 'none' | 'plex_only' | 'tmdb_only' | 'cache_only' | 'full' | 'enrich_cache'
  preview_only: boolean
  replace_forbidden?: boolean  // Replace forbidden content in best iteration with alternatives
  improve_best?: boolean  // Upgrade programs with better ones from other iterations
  duration_days: number  // Number of days to program (1-30)
  start_datetime?: string  // ISO format datetime
  // AI improvement options
  ai_improve?: boolean
  ai_prompt?: string
  ai_model?: string
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
  time_blocks?: TimeBlock[]
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
  status: 'success' | 'failed' | 'cancelled' | 'running'
  channel_id?: string
  channel_name?: string
  profile_id?: string
  profile_name?: string
  schedule_id?: string
  schedule_name?: string
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
  count?: number
}

// AI Generation types
export interface AILibraryInfo {
  id: string
  name: string
  type: string
}

export interface AIGenerateProfileRequest {
  prompt: string
  model?: string
  temperature?: number
  save_profile?: boolean
  profile_name?: string
  libraries?: AILibraryInfo[]
}

export interface AIGenerationAttempt {
  attempt_number: number
  success: boolean
  validation_errors: string[]
  timestamp: string
}

export interface AIGenerateProfileResponse {
  success: boolean
  generation_id: string
  profile: Record<string, unknown> | null
  total_attempts: number
  attempts: AIGenerationAttempt[]
  error_message: string | null
  saved_profile_id: string | null
}

export interface AIModelInfo {
  name: string
  size: number
  modified_at: string
}

export interface AIModelsResponse {
  available_models: AIModelInfo[]
  recommended: {
    profile_generation: string
    quick_modification: string
    complex_schedule: string
  }
  all_recommendations: Record<string, string>
}

// AI Programming Improvement types
export interface AIImprovementRequest {
  result_id: string
  prompt: string
  model?: string
  iteration_index?: number  // Which iteration to improve (default: best)
  temperature?: number
}

export interface AIImprovementResponse {
  success: boolean
  result_id?: string
  model?: string
  suggestions?: unknown  // AI-generated suggestions object
  message?: string
}

// Comparison types
export type ComparisonStatus = 'unchanged' | 'improved' | 'degraded' | 'added' | 'removed'

export interface ProgramComparison {
  title: string
  status: ComparisonStatus
  scoreA: number | null
  scoreB: number | null
  delta: number | null
  // Criterion deltas for expanded view
  criteriaDeltas?: Record<string, {
    scoreA: number | null
    scoreB: number | null
    delta: number | null
  }>
}

export interface ComparisonSummary {
  entryA: {
    id: string
    type: 'programming' | 'scoring' | 'ai_generation'
    date: string
    channelName?: string
    profileName?: string
  }
  entryB: {
    id: string
    type: 'programming' | 'scoring' | 'ai_generation'
    date: string
    channelName?: string
    profileName?: string
  }
  totalScoreA: number
  totalScoreB: number
  totalScoreDelta: number
  averageScoreA: number
  averageScoreB: number
  averageScoreDelta: number
  programCountA: number
  programCountB: number
  programCountDelta: number
  durationMinA: number
  durationMinB: number
  durationDelta: number
  programComparisons: ProgramComparison[]
}

// Schedule types
export interface ScheduleConfig {
  mode: 'simple' | 'cron'
  // Simple mode fields
  frequency?: 'daily' | 'weekly' | 'specific_days'
  days?: number[]  // 0=Monday, 6=Sunday
  time?: string    // HH:MM format
  // Cron mode field
  expression?: string
}

export interface Schedule {
  id: string
  name: string
  description?: string
  schedule_type: 'programming' | 'scoring'
  channel_id: string
  channel_name?: string
  profile_id?: string
  profile_name?: string
  schedule_config: ScheduleConfig
  execution_params: Partial<ProgrammingRequest> | Partial<ScoringRequest>
  enabled: boolean
  last_execution_at?: string
  last_execution_status?: 'success' | 'failed' | 'running'
  next_execution_at?: string
  created_at: string
  updated_at: string
}

export interface ScheduleCreate {
  name: string
  description?: string
  schedule_type: 'programming' | 'scoring'
  channel_id: string
  profile_id: string
  schedule_config: ScheduleConfig
  execution_params: Partial<ProgrammingRequest> | Partial<ScoringRequest>
  enabled?: boolean
}

export interface ScheduleUpdate {
  name?: string
  description?: string
  channel_id?: string
  profile_id?: string
  schedule_config?: ScheduleConfig
  execution_params?: Partial<ProgrammingRequest> | Partial<ScoringRequest>
  enabled?: boolean
}
