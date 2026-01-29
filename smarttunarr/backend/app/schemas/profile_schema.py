"""Pydantic models for profile validation - v6 with enhanced criteria."""

from typing import Any

from pydantic import BaseModel, Field


class MFPPolicy(BaseModel):
    """Configurable M/F/P (Mandatory/Forbidden/Preferred) point policy."""

    mandatory_matched_bonus: float = Field(
        10.0, description="Bonus when mandatory requirement is met"
    )
    mandatory_missed_penalty: float = Field(
        -40.0, description="Penalty when mandatory requirement is not met"
    )
    forbidden_detected_penalty: float = Field(
        -400.0, description="Penalty when forbidden value is detected"
    )
    preferred_matched_bonus: float = Field(
        20.0, description="Bonus when preferred value is matched"
    )


class CriterionMultipliers(BaseModel):
    """Multipliers for each scoring criterion (default 1.0 = no change)."""

    type: float = Field(1.0, ge=0.0, le=10.0, description="Multiplier for type criterion")
    duration: float = Field(1.0, ge=0.0, le=10.0, description="Multiplier for duration criterion")
    genre: float = Field(1.0, ge=0.0, le=10.0, description="Multiplier for genre criterion")
    timing: float = Field(1.0, ge=0.0, le=10.0, description="Multiplier for timing criterion")
    strategy: float = Field(1.0, ge=0.0, le=10.0, description="Multiplier for strategy criterion")
    age: float = Field(1.0, ge=0.0, le=10.0, description="Multiplier for age criterion")
    rating: float = Field(1.0, ge=0.0, le=10.0, description="Multiplier for rating criterion")
    filter: float = Field(1.0, ge=0.0, le=10.0, description="Multiplier for filter criterion")
    bonus: float = Field(1.0, ge=0.0, le=10.0, description="Multiplier for bonus criterion")


class CriterionRules(BaseModel):
    """Optional rules for a scoring criterion (mandatory/forbidden/preferred)."""

    mandatory_values: list[str] | None = Field(
        None, description="Values that must be present"
    )
    mandatory_penalty: float = Field(
        -50.0, description="Penalty if mandatory values missing"
    )
    forbidden_values: list[str] | None = Field(
        None, description="Values that must not be present"
    )
    forbidden_penalty: float = Field(
        -200.0, description="Penalty if forbidden values found"
    )
    preferred_values: list[str] | None = Field(
        None, description="Values that give bonus points"
    )
    preferred_bonus: float = Field(
        20.0, description="Bonus if preferred values found"
    )


class LibraryConfig(BaseModel):
    """Library configuration."""

    id: str = Field(..., description="Plex library section ID")
    name: str = Field(..., description="Library display name")
    type: str | None = Field(None, description="Library content type")
    weight: float = Field(50.0, ge=0, le=100, description="Selection weight")
    enabled: bool = Field(True, description="Whether library is enabled")


class BlockCriteria(BaseModel):
    """Time block specific criteria."""

    preferred_types: list[str] = Field(default_factory=list)
    allowed_types: list[str] = Field(default_factory=list)
    excluded_types: list[str] = Field(default_factory=list)
    preferred_genres: list[str] = Field(default_factory=list)
    allowed_genres: list[str] = Field(default_factory=list)
    forbidden_genres: list[str] = Field(default_factory=list)
    min_duration_min: int | None = Field(None, ge=1)
    max_duration_min: int | None = Field(None, ge=1)
    max_age_rating: str | None = None
    allowed_age_ratings: list[str] = Field(default_factory=list)
    min_tmdb_rating: float | None = Field(None, ge=0, le=10)
    preferred_tmdb_rating: float | None = Field(None, ge=0, le=10)
    min_vote_count: int | None = Field(None, ge=0)
    max_release_age_years: int | None = Field(None, ge=0)
    # Keyword modifiers
    exclude_keywords: list[str] = Field(default_factory=list, description="Keywords that penalize content (-50%)")
    include_keywords: list[str] = Field(default_factory=list, description="Keywords that boost content (+10%)")
    # Per-criterion rules (optional - if not defined, normal calculation applies)
    type_rules: CriterionRules | None = Field(None, description="Rules for type criterion")
    duration_rules: CriterionRules | None = Field(None, description="Rules for duration criterion")
    genre_rules: CriterionRules | None = Field(None, description="Rules for genre criterion")
    timing_rules: CriterionRules | None = Field(None, description="Rules for timing criterion")
    strategy_rules: CriterionRules | None = Field(None, description="Rules for strategy criterion")
    age_rules: CriterionRules | None = Field(None, description="Rules for age criterion")
    rating_rules: CriterionRules | None = Field(None, description="Rules for rating criterion")
    filter_rules: CriterionRules | None = Field(None, description="Rules for filter criterion")
    bonus_rules: CriterionRules | None = Field(None, description="Rules for bonus criterion")
    # M/F/P policy and multipliers (override profile-level if defined)
    mfp_policy: MFPPolicy | None = Field(None, description="M/F/P point policy for this block")
    criterion_multipliers: CriterionMultipliers | None = Field(None, description="Criterion score multipliers for this block")


class TimeBlock(BaseModel):
    """Time block configuration."""

    name: str = Field(..., description="Block display name")
    description: str | None = Field(None, description="Block description")
    start_time: str = Field(..., pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    end_time: str = Field(..., pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    criteria: BlockCriteria = Field(default_factory=BlockCriteria)
    scoring_overrides: dict[str, float] | None = Field(None)


class MandatoryRules(BaseModel):
    """Mandatory content rules."""

    content_ids: list[str] = Field(default_factory=list)
    min_duration_min: int | None = Field(None, ge=1)
    min_tmdb_rating: float | None = Field(None, ge=0, le=10)
    min_vote_count: int | None = Field(None, ge=0)
    required_genres: list[str] = Field(default_factory=list)
    required_all_genres: list[str] = Field(default_factory=list)
    allowed_age_ratings: list[str] = Field(default_factory=list)
    required_keywords: list[str] = Field(default_factory=list)
    required_collections: list[str] = Field(default_factory=list)
    required_studios: list[str] = Field(default_factory=list)
    required_countries: list[str] = Field(default_factory=list)
    required_languages: list[str] = Field(default_factory=list)


class ForbiddenRules(BaseModel):
    """Forbidden content rules."""

    content_ids: list[str] = Field(default_factory=list)
    types: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    tmdb_keywords: list[str] = Field(default_factory=list)
    genres: list[str] = Field(default_factory=list)
    age_ratings: list[str] = Field(default_factory=list)
    collections: list[str] = Field(default_factory=list)
    studios: list[str] = Field(default_factory=list)
    actors: list[str] = Field(default_factory=list)
    directors: list[str] = Field(default_factory=list)
    max_controversial_score: float | None = Field(None, ge=0, le=10)


class PreferredRules(BaseModel):
    """Preferred content rules (bonus points)."""

    genres: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    collections: list[str] = Field(default_factory=list)
    studios: list[str] = Field(default_factory=list)
    actors: list[str] = Field(default_factory=list)
    directors: list[str] = Field(default_factory=list)
    countries: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)


class MandatoryForbiddenCriteria(BaseModel):
    """Combined mandatory, forbidden and preferred rules."""

    mandatory: MandatoryRules = Field(default_factory=MandatoryRules)
    forbidden: ForbiddenRules = Field(default_factory=ForbiddenRules)
    preferred: PreferredRules = Field(default_factory=PreferredRules)
    # Profile-level keyword modifiers (applied when no block-level defined)
    exclude_keywords: list[str] = Field(default_factory=list, description="Keywords that penalize content (-50%)")
    include_keywords: list[str] = Field(default_factory=list, description="Keywords that boost content (+10%)")


# Enhanced Criteria v6 classes
class KeywordsSafety(BaseModel):
    """TMDB keywords-based safety filtering."""

    enabled: bool = False
    safe_keywords: list[str] = Field(default_factory=list)
    dangerous_keywords: list[str] = Field(default_factory=list)
    safe_bonus_points: float = 5
    dangerous_penalty_points: float = -100


class CollectionsFranchises(BaseModel):
    """Collection and franchise preferences."""

    enabled: bool = False
    preferred_collections: list[str] = Field(default_factory=list)
    preferred_franchises: list[str] = Field(default_factory=list)
    forbidden_collections: list[str] = Field(default_factory=list)
    collection_bonus_points: float = 10
    franchise_bonus_points: float = 5


class CastCrew(BaseModel):
    """Cast and crew preferences."""

    enabled: bool = False
    preferred_actors: list[str] = Field(default_factory=list)
    forbidden_actors: list[str] = Field(default_factory=list)
    preferred_directors: list[str] = Field(default_factory=list)
    min_actor_popularity: float | None = None
    popular_actor_bonus: float = 3


class RecencyBonuses(BaseModel):
    """Recency bonus configuration."""

    enabled: bool = False
    very_recent_days: int = 30
    very_recent_bonus: float = 8
    recent_months: int = 6
    recent_bonus: float = 6
    this_year_bonus: float = 4
    max_age_years: int | None = None
    old_content_penalty: float = 0


class SeasonalConfig(BaseModel):
    """Seasonal bonus configuration."""

    months: list[int] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    genres: list[str] = Field(default_factory=list)
    bonus_points: float = 5


class SeasonalBonuses(BaseModel):
    """Seasonal bonuses configuration."""

    enabled: bool = False
    christmas: SeasonalConfig = Field(default_factory=lambda: SeasonalConfig(months=[11, 12]))
    halloween: SeasonalConfig = Field(default_factory=lambda: SeasonalConfig(months=[10]))
    summer: SeasonalConfig = Field(default_factory=lambda: SeasonalConfig(months=[6, 7, 8]))


class PrimeTimeBonus(BaseModel):
    """Prime time bonus configuration."""

    enabled: bool = False
    prime_hours: list[str] = Field(default_factory=lambda: ["20:00", "21:00", "22:00"])
    bonus_points: float = 10


class TemporalIntelligence(BaseModel):
    """Time-based and seasonal bonuses."""

    enabled: bool = False
    recency_bonuses: RecencyBonuses = Field(default_factory=RecencyBonuses)
    seasonal_bonuses: SeasonalBonuses = Field(default_factory=SeasonalBonuses)
    prime_time_bonus: PrimeTimeBonus = Field(default_factory=PrimeTimeBonus)


class CulturalLinguistic(BaseModel):
    """Cultural and language preferences."""

    enabled: bool = False
    preferred_countries: list[str] = Field(default_factory=list)
    preferred_languages: list[str] = Field(default_factory=list)
    require_french_audio: bool = False
    country_bonus_points: float = 5
    language_bonus_points: float = 5


class VoteReliability(BaseModel):
    """Rating reliability based on vote count."""

    enabled: bool = False
    excellent_votes: int = 10000
    good_votes: int = 5000
    acceptable_votes: int = 1000
    minimum_votes: int = 100


class MultiSourceRating(BaseModel):
    """Multi-source rating aggregation."""

    enabled: bool = False
    sources: list[str] = Field(default_factory=lambda: ["tmdb"])
    aggregation_method: str = "average"


class TechnicalQuality(BaseModel):
    """Technical quality preferences."""

    enabled: bool = False
    prefer_4k: bool = False
    prefer_hdr: bool = False
    quality_bonus_points: float = 3


class QualityIndicators(BaseModel):
    """Quality-based scoring."""

    enabled: bool = False
    vote_reliability: VoteReliability = Field(default_factory=VoteReliability)
    multi_source_rating: MultiSourceRating = Field(default_factory=MultiSourceRating)
    technical_quality: TechnicalQuality = Field(default_factory=TechnicalQuality)


class EducationalValue(BaseModel):
    """Educational content bonuses."""

    enabled: bool = False
    educational_keywords: list[str] = Field(default_factory=list)
    bonus_points: float = 5


class EnhancedCriteria(BaseModel):
    """v6 Enhanced scoring criteria with TMDB integration."""

    keywords_safety: KeywordsSafety = Field(default_factory=KeywordsSafety)
    collections_franchises: CollectionsFranchises = Field(default_factory=CollectionsFranchises)
    cast_crew: CastCrew = Field(default_factory=CastCrew)
    temporal_intelligence: TemporalIntelligence = Field(default_factory=TemporalIntelligence)
    cultural_linguistic: CulturalLinguistic = Field(default_factory=CulturalLinguistic)
    quality_indicators: QualityIndicators = Field(default_factory=QualityIndicators)
    educational_value: EducationalValue = Field(default_factory=EducationalValue)


class FillerInsertion(BaseModel):
    """Filler insertion configuration."""

    enabled: bool = False
    types: list[str] = Field(default_factory=lambda: ["trailer"])
    max_duration_min: int | None = Field(None, ge=1)


class Bonuses(BaseModel):
    """Bonus configuration."""

    holiday_bonus: bool = False
    recent_release_bonus: bool = False
    popular_content_bonus: bool = False


class Strategies(BaseModel):
    """Programming strategies."""

    maintain_sequence: bool = False
    maximize_variety: bool = False
    marathon_mode: bool = False
    avoid_repeats_days: int = Field(7, ge=0)
    filler_insertion: FillerInsertion = Field(default_factory=FillerInsertion)
    bonuses: Bonuses = Field(default_factory=Bonuses)


class ScoringWeights(BaseModel):
    """Scoring criterion weights."""

    type: float = Field(15.0, ge=0, le=100)
    duration: float = Field(20.0, ge=0, le=100)
    genre: float = Field(15.0, ge=0, le=100)
    timing: float = Field(10.0, ge=0, le=100)
    strategy: float = Field(10.0, ge=0, le=100)
    age: float = Field(15.0, ge=0, le=100)
    rating: float = Field(10.0, ge=0, le=100)
    filter: float = Field(10.0, ge=0, le=100)
    bonus: float = Field(5.0, ge=0, le=100)
    # v6 new weights
    keywords: float = Field(5.0, ge=0, le=100)
    collections: float = Field(5.0, ge=0, le=100)
    cast: float = Field(5.0, ge=0, le=100)
    temporal: float = Field(5.0, ge=0, le=100)


class ProfileCreate(BaseModel):
    """Schema for creating a new profile."""

    name: str = Field(..., min_length=1, max_length=100)
    version: str = Field("6.0", pattern=r"^[456]\.[0-9]+$")
    description: str | None = Field(None, max_length=500)
    libraries: list[LibraryConfig] = Field(..., min_length=1)
    time_blocks: list[TimeBlock] = Field(..., min_length=1)
    mandatory_forbidden_criteria: MandatoryForbiddenCriteria = Field(
        default_factory=MandatoryForbiddenCriteria
    )
    enhanced_criteria: EnhancedCriteria = Field(default_factory=EnhancedCriteria)
    strategies: Strategies | None = Field(default_factory=Strategies)
    scoring_weights: ScoringWeights = Field(default_factory=ScoringWeights)
    # M/F/P policy and multipliers (profile-level defaults, can be overridden per block)
    mfp_policy: MFPPolicy = Field(default_factory=MFPPolicy, description="Default M/F/P point policy")
    criterion_multipliers: CriterionMultipliers = Field(default_factory=CriterionMultipliers, description="Default criterion multipliers")
    default_iterations: int = Field(10, ge=1, le=100)
    default_randomness: float = Field(0.3, ge=0, le=1)
    labels: list[str] = Field(default_factory=list)


class ProfileUpdate(BaseModel):
    """Schema for updating a profile."""

    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    libraries: list[LibraryConfig] | None = None
    time_blocks: list[TimeBlock] | None = None
    mandatory_forbidden_criteria: MandatoryForbiddenCriteria | None = None
    enhanced_criteria: EnhancedCriteria | None = None
    strategies: Strategies | None = None
    scoring_weights: ScoringWeights | None = None
    mfp_policy: MFPPolicy | None = None
    criterion_multipliers: CriterionMultipliers | None = None
    default_iterations: int | None = Field(None, ge=1, le=100)
    default_randomness: float | None = Field(None, ge=0, le=1)
    labels: list[str] | None = None


class ProfileResponse(BaseModel):
    """Schema for profile response."""

    id: str
    name: str
    version: str
    description: str | None = None
    libraries: list[dict[str, Any]]
    time_blocks: list[dict[str, Any]]
    mandatory_forbidden_criteria: dict[str, Any]
    enhanced_criteria: dict[str, Any] | None = None
    strategies: dict[str, Any] | None
    scoring_weights: dict[str, float]
    mfp_policy: dict[str, float] | None = None
    criterion_multipliers: dict[str, float] | None = None
    default_iterations: int
    default_randomness: float
    labels: list[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ProfileListResponse(BaseModel):
    """Schema for profile list response."""

    id: str
    name: str
    version: str
    description: str | None = None
    labels: list[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ProfileImport(BaseModel):
    """Schema for importing a profile."""

    profile: ProfileCreate
    overwrite: bool = False


class ProfileValidation(BaseModel):
    """Schema for profile validation result."""

    valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
