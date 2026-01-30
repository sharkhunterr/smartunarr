"""ScoringEngine orchestrator with weighted aggregation."""

from dataclasses import dataclass, field
from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, RuleViolation, ScoringContext
from app.core.scoring.criteria import (
    AgeCriterion,
    BonusCriterion,
    DurationCriterion,
    FilterCriterion,
    GenreCriterion,
    RatingCriterion,
    StrategyCriterion,
    TimingCriterion,
    TypeCriterion,
)


@dataclass
class ScoringResult:
    """Complete scoring result for content."""

    total_score: float
    weighted_total: float
    criterion_results: dict[str, CriterionResult] = field(default_factory=dict)
    forbidden_violations: list[dict[str, Any]] = field(default_factory=list)
    mandatory_penalties: list[dict[str, Any]] = field(default_factory=list)
    bonuses_applied: list[str] = field(default_factory=list)
    keyword_multiplier: float = 1.0
    keyword_match: str | None = None  # "exclude", "include", or None
    criterion_rule_violations: dict[str, dict[str, Any]] = field(default_factory=dict)  # Per-criterion rules

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        # Build breakdown with just scores for frontend compatibility
        # Skipped criteria have None instead of a score
        breakdown = {
            name: (result.score if not result.skipped else None)
            for name, result in self.criterion_results.items()
        }

        # Build criteria dict with rule violations and multipliers
        criteria_dict = {}
        for name, result in self.criterion_results.items():
            criterion_data = {
                "score": result.score if not result.skipped else None,
                "weight": result.weight,
                "weighted_score": result.weighted_score,
                "multiplier": result.multiplier,
                "multiplied_weighted_score": result.multiplied_weighted_score,
                "skipped": result.skipped,
            }
            # Add details if present (important for timing criterion)
            if result.details:
                criterion_data["details"] = result.details
            # Add rule violation if present
            if result.rule_violation:
                criterion_data["rule_violation"] = {
                    "rule_type": result.rule_violation.rule_type,
                    "values": result.rule_violation.values,
                    "penalty_or_bonus": result.rule_violation.penalty_or_bonus,
                }
            criteria_dict[name] = criterion_data

        return {
            "total_score": self.total_score,
            "total": self.total_score,  # Alias for frontend compatibility
            "weighted_total": self.weighted_total,
            "criteria": criteria_dict,
            "breakdown": breakdown,  # Frontend-compatible format
            "forbidden_violations": self.forbidden_violations,
            "mandatory_penalties": self.mandatory_penalties,
            "bonuses_applied": self.bonuses_applied,
            "forbidden_violated": len(self.forbidden_violations) > 0,
            "mandatory_met": len(self.mandatory_penalties) == 0,
            "keyword_multiplier": self.keyword_multiplier,
            "keyword_match": self.keyword_match,
            "criterion_rule_violations": self.criterion_rule_violations,
        }


class ScoringEngine:
    """Orchestrates scoring across all criteria with weighted aggregation."""

    def __init__(self) -> None:
        """Initialize scoring engine with all criteria."""
        self.criteria: list[BaseCriterion] = [
            TypeCriterion(),
            DurationCriterion(),
            GenreCriterion(),
            TimingCriterion(),
            StrategyCriterion(),
            AgeCriterion(),
            RatingCriterion(),
            FilterCriterion(),
            BonusCriterion(),
        ]

    def score(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> ScoringResult:
        """
        Calculate complete score for content.

        Args:
            content: Content data
            content_meta: TMDB metadata
            profile: Profile configuration
            block: Time block configuration (optional)
            context: Scoring context with timing information (optional)

        Returns:
            ScoringResult with all criterion scores and violations
        """
        criterion_results: dict[str, CriterionResult] = {}
        criterion_rule_violations: dict[str, dict[str, Any]] = {}
        total_weight = 0.0
        multiplied_weighted_sum = 0.0

        # Evaluate each criterion
        for criterion in self.criteria:
            result = criterion.evaluate(content, content_meta, profile, block, context)
            criterion_results[criterion.name] = result
            # Use weight * multiplier for total weight calculation
            effective_weight = result.weight * result.multiplier
            total_weight += effective_weight
            multiplied_weighted_sum += result.multiplied_weighted_score

            # Collect per-criterion rule violations
            if result.rule_violation:
                criterion_rule_violations[criterion.name] = {
                    "rule_type": result.rule_violation.rule_type,
                    "values": result.rule_violation.values,
                    "penalty_or_bonus": result.rule_violation.penalty_or_bonus,
                }

        # Calculate weighted total (normalize to 0-100) using multiplied scores
        if total_weight > 0:
            weighted_total = (multiplied_weighted_sum / total_weight) * 100
        else:
            weighted_total = 50.0  # Default neutral score

        # Check forbidden rules (profile-level)
        forbidden_violations = self._check_forbidden(content, content_meta, profile, block)

        # Add per-criterion forbidden rule violations to global forbidden list
        # This ensures content with forbidden age ratings, genres, etc. is completely excluded
        for criterion_name, violation in criterion_rule_violations.items():
            if violation.get("rule_type") == "forbidden":
                forbidden_violations.append({
                    "rule": f"forbidden_{criterion_name}_rule",
                    "value": ", ".join(violation.get("values", [])),
                    "message": f"Content has forbidden {criterion_name}: {', '.join(violation.get('values', []))}",
                    "criterion": criterion_name,
                    "penalty": violation.get("penalty_or_bonus", -200),
                })

        # Check mandatory rules
        mandatory_penalties = self._check_mandatory(content, content_meta, profile, block)

        # Apply violations and penalties
        final_score = weighted_total if weighted_total is not None else 50.0
        if forbidden_violations:
            final_score = 0.0  # Forbidden content gets zero score
        else:
            # Apply mandatory penalties
            for penalty in mandatory_penalties:
                final_score -= penalty.get("penalty", 10.0)

        # Calculate and apply keyword multiplier
        keyword_multiplier, keyword_match = self._calculate_keyword_multiplier(
            content, profile, block
        )
        if keyword_multiplier != 1.0:
            final_score = final_score * keyword_multiplier

        # Ensure final_score is always a valid float
        final_score = max(0.0, min(100.0, float(final_score or 0.0)))

        # Extract bonuses from bonus criterion
        bonuses_applied: list[str] = []
        bonus_result = criterion_results.get("bonus")
        if bonus_result and bonus_result.details:
            bonuses_applied = bonus_result.details.get("bonuses_applied", [])

        return ScoringResult(
            total_score=final_score,
            weighted_total=weighted_total,
            criterion_results=criterion_results,
            forbidden_violations=forbidden_violations,
            mandatory_penalties=mandatory_penalties,
            bonuses_applied=bonuses_applied,
            keyword_multiplier=keyword_multiplier,
            keyword_match=keyword_match,
            criterion_rule_violations=criterion_rule_violations,
        )

    def _check_forbidden(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Check for forbidden rule violations."""
        violations = []
        criteria = profile.get("mandatory_forbidden_criteria", {})
        forbidden = criteria.get("forbidden", {})

        content_title = content.get("title", "").lower()
        content_type = content.get("type", "").lower()

        # Check forbidden content IDs
        forbidden_ids = forbidden.get("content_ids", [])
        content_id = content.get("plex_key", "")
        if content_id in forbidden_ids:
            violations.append({
                "rule": "forbidden_content_id",
                "value": content_id,
                "message": f"Content ID {content_id} is forbidden",
            })

        # Check forbidden types
        forbidden_types = [t.lower() for t in forbidden.get("types", [])]
        if content_type in forbidden_types:
            violations.append({
                "rule": "forbidden_type",
                "value": content_type,
                "message": f"Content type '{content_type}' is forbidden",
            })

        # Check forbidden keywords in title
        forbidden_keywords = [k.lower() for k in forbidden.get("keywords", [])]
        for keyword in forbidden_keywords:
            if keyword in content_title:
                violations.append({
                    "rule": "forbidden_keyword_in_title",
                    "value": keyword,
                    "message": f"Title contains forbidden keyword '{keyword}'",
                })

        # Check forbidden genres (global)
        if content_meta:
            content_genres = [g.lower() for g in content_meta.get("genres", [])]
            forbidden_genres = [g.lower() for g in forbidden.get("genres", [])]
            for genre in content_genres:
                if genre in forbidden_genres:
                    violations.append({
                        "rule": "forbidden_genre",
                        "value": genre,
                        "message": f"Content has forbidden genre '{genre}'",
                    })

        # Check block-level forbidden genres
        if block and content_meta:
            block_criteria = block.get("criteria", {})
            block_forbidden_genres = [g.lower() for g in block_criteria.get("forbidden_genres", [])]
            if block_forbidden_genres:
                content_genres = [g.lower() for g in content_meta.get("genres", [])]
                for genre in content_genres:
                    if genre in block_forbidden_genres:
                        # Avoid duplicate violations
                        existing = any(
                            v.get("rule") == "forbidden_genre" and v.get("value") == genre
                            for v in violations
                        )
                        if not existing:
                            violations.append({
                                "rule": "forbidden_genre_block",
                                "value": genre,
                                "message": f"Content has genre '{genre}' forbidden in time block",
                            })

        return violations

    def _check_mandatory(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Check for mandatory rule violations and calculate penalties."""
        penalties = []
        criteria = profile.get("mandatory_forbidden_criteria", {})
        mandatory = criteria.get("mandatory", {})

        # Check minimum duration
        min_duration_min = mandatory.get("min_duration_min")
        if min_duration_min:
            duration_min = content.get("duration_ms", 0) / 60000
            if duration_min < min_duration_min:
                penalties.append({
                    "rule": "mandatory_min_duration",
                    "required": min_duration_min,
                    "actual": duration_min,
                    "penalty": 15.0,
                    "message": f"Duration {duration_min:.1f}min below minimum {min_duration_min}min",
                })

        # Check minimum TMDB rating
        min_rating = mandatory.get("min_tmdb_rating")
        if min_rating and content_meta:
            tmdb_rating_raw = content_meta.get("tmdb_rating")
            try:
                tmdb_rating = float(tmdb_rating_raw) if tmdb_rating_raw else 0.0
            except (TypeError, ValueError):
                tmdb_rating = 0.0
            if tmdb_rating < min_rating:
                penalties.append({
                    "rule": "mandatory_min_rating",
                    "required": min_rating,
                    "actual": tmdb_rating,
                    "penalty": 10.0,
                    "message": f"TMDB rating {tmdb_rating} below minimum {min_rating}",
                })

        # Check required genres (must have at least one)
        required_genres = mandatory.get("required_genres", [])
        if required_genres and content_meta:
            content_genres = [g.lower() for g in content_meta.get("genres", [])]
            required_lower = [g.lower() for g in required_genres]
            if not any(g in content_genres for g in required_lower):
                penalties.append({
                    "rule": "mandatory_genre_missing",
                    "required": required_genres,
                    "actual": content_genres,
                    "penalty": 20.0,
                    "message": f"Missing required genre from {required_genres}",
                })

        return penalties

    def _calculate_keyword_multiplier(
        self,
        content: dict[str, Any],
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
    ) -> tuple[float, str | None]:
        """
        Calculate keyword multiplier based on title matching.

        From the old system:
        - exclude_keywords in title: -50% (multiplier 0.5)
        - include_keywords in title: +10% (multiplier 1.1)
        - Exclusion always takes priority over inclusion

        Args:
            content: Content data with title
            profile: Profile configuration
            block: Time block configuration (optional)

        Returns:
            Tuple of (multiplier, match_type) where match_type is
            "exclude", "include", or None
        """
        content_title = content.get("title", "").lower()
        if not content_title:
            return 1.0, None

        # Get keyword config from block or profile
        if block:
            block_criteria = block.get("criteria", {})
            exclude_keywords = [k.lower() for k in block_criteria.get("exclude_keywords", [])]
            include_keywords = [k.lower() for k in block_criteria.get("include_keywords", [])]
        else:
            criteria = profile.get("mandatory_forbidden_criteria", {})
            exclude_keywords = [k.lower() for k in criteria.get("exclude_keywords", [])]
            include_keywords = [k.lower() for k in criteria.get("include_keywords", [])]

        # Also check enhanced_criteria.keywords_safety for dangerous_keywords (treated as exclude)
        enhanced_criteria = profile.get("enhanced_criteria", {})
        keywords_safety = enhanced_criteria.get("keywords_safety", {})
        dangerous_keywords = [k.lower() for k in keywords_safety.get("dangerous_keywords", [])]
        exclude_keywords = list(set(exclude_keywords + dangerous_keywords))

        # Check for exclusion first (takes priority)
        for keyword in exclude_keywords:
            if keyword in content_title:
                return 0.5, "exclude"  # -50% penalty

        # Check for inclusion bonus
        for keyword in include_keywords:
            if keyword in content_title:
                return 1.1, "include"  # +10% bonus

        return 1.0, None

    def score_batch(
        self,
        contents: list[tuple[dict[str, Any], dict[str, Any] | None]],
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
    ) -> list[ScoringResult]:
        """Score multiple content items efficiently."""
        return [
            self.score(content, meta, profile, block)
            for content, meta in contents
        ]
