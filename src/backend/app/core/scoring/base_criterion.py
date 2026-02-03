"""Base criterion abstract class for scoring."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class ScoringContext:
    """Context for scoring a content item at a specific position."""

    current_time: datetime | None = None  # When the content would start
    block_start_time: datetime | None = None  # When the current block starts
    block_end_time: datetime | None = None  # When the current block ends
    is_first_in_block: bool = False  # Whether this is the first program in the block
    is_last_in_block: bool = False  # Whether this is the last program in the block
    is_schedule_start: bool = False  # Whether this is the very first program of the entire schedule


@dataclass
class RuleViolation:
    """Rule violation or match detected for a criterion."""

    rule_type: str  # "mandatory", "forbidden", "preferred"
    values: list[str]  # Values involved in the violation/match
    penalty_or_bonus: float  # Points applied (negative for penalty, positive for bonus)


@dataclass
class MFPPolicyConfig:
    """M/F/P (Mandatory/Forbidden/Preferred) point policy configuration."""

    mandatory_matched_bonus: float = 10.0
    mandatory_missed_penalty: float = -40.0
    forbidden_detected_penalty: float = -400.0
    preferred_matched_bonus: float = 20.0


# Default MFP policy
DEFAULT_MFP_POLICY = MFPPolicyConfig()


@dataclass
class CriterionResult:
    """Result of a criterion calculation."""

    name: str
    score: float  # 0.0-100.0
    weight: float
    weighted_score: float
    multiplier: float = 1.0  # Criterion multiplier
    multiplied_weighted_score: float = 0.0  # weighted_score * multiplier
    details: dict[str, Any] | None = None
    rule_violation: RuleViolation | None = None  # Rule violation if detected
    skipped: bool = False  # If True, this criterion is not applicable and excluded from total


class BaseCriterion(ABC):
    """Abstract base class for scoring criteria."""

    name: str = "base"
    weight_key: str = "base"
    default_weight: float = 10.0

    @abstractmethod
    def calculate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> float:
        """
        Calculate score for content against profile criteria.

        Args:
            content: Content data (title, type, duration_ms, etc.)
            content_meta: TMDB metadata (genres, keywords, ratings, etc.)
            profile: Profile configuration
            block: Time block configuration (optional)
            context: Scoring context with timing information (optional)

        Returns:
            Score between 0.0 and 100.0
        """
        pass

    def get_weight(self, profile: dict[str, Any]) -> float:
        """Get weight from profile or use default."""
        weights = profile.get("scoring_weights", {})
        return weights.get(self.weight_key, self.default_weight)

    def get_multiplier(
        self,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
    ) -> float:
        """Get multiplier for this criterion from block or profile."""
        # Block-level multiplier takes priority
        if block:
            block_criteria = block.get("criteria", {})
            block_multipliers = block_criteria.get("criterion_multipliers", {})
            if block_multipliers and self.name in block_multipliers:
                return float(block_multipliers.get(self.name, 1.0))

        # Fall back to profile-level multiplier
        profile_multipliers = profile.get("criterion_multipliers", {})
        if profile_multipliers and self.name in profile_multipliers:
            return float(profile_multipliers.get(self.name, 1.0))

        return 1.0  # Default: no multiplication

    def get_mfp_policy(
        self,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
    ) -> MFPPolicyConfig:
        """Get M/F/P policy from block or profile."""
        # Block-level policy takes priority
        if block:
            block_criteria = block.get("criteria", {})
            block_policy = block_criteria.get("mfp_policy", {})
            if block_policy:
                return MFPPolicyConfig(
                    mandatory_matched_bonus=block_policy.get(
                        "mandatory_matched_bonus", DEFAULT_MFP_POLICY.mandatory_matched_bonus
                    ),
                    mandatory_missed_penalty=block_policy.get(
                        "mandatory_missed_penalty", DEFAULT_MFP_POLICY.mandatory_missed_penalty
                    ),
                    forbidden_detected_penalty=block_policy.get(
                        "forbidden_detected_penalty", DEFAULT_MFP_POLICY.forbidden_detected_penalty
                    ),
                    preferred_matched_bonus=block_policy.get(
                        "preferred_matched_bonus", DEFAULT_MFP_POLICY.preferred_matched_bonus
                    ),
                )

        # Fall back to profile-level policy
        profile_policy = profile.get("mfp_policy", {})
        if profile_policy:
            return MFPPolicyConfig(
                mandatory_matched_bonus=profile_policy.get(
                    "mandatory_matched_bonus", DEFAULT_MFP_POLICY.mandatory_matched_bonus
                ),
                mandatory_missed_penalty=profile_policy.get(
                    "mandatory_missed_penalty", DEFAULT_MFP_POLICY.mandatory_missed_penalty
                ),
                forbidden_detected_penalty=profile_policy.get(
                    "forbidden_detected_penalty", DEFAULT_MFP_POLICY.forbidden_detected_penalty
                ),
                preferred_matched_bonus=profile_policy.get(
                    "preferred_matched_bonus", DEFAULT_MFP_POLICY.preferred_matched_bonus
                ),
            )

        return DEFAULT_MFP_POLICY

    def check_rules(
        self,
        content_values: list[str],
        rules: dict[str, Any] | None,
        mfp_policy: MFPPolicyConfig | None = None,
    ) -> tuple[float, RuleViolation | None]:
        """
        Check mandatory/forbidden/preferred rules for this criterion.

        Args:
            content_values: Values from the content to check against rules
            rules: Rules dict with mandatory_values, forbidden_values, preferred_values, etc.
            mfp_policy: M/F/P policy config (uses defaults if None)

        Returns:
            Tuple of (adjustment, violation) where:
            - adjustment: Points to add/subtract from score
            - violation: RuleViolation if a rule was triggered, None otherwise
        """
        if not rules:
            return 0.0, None

        policy = mfp_policy or DEFAULT_MFP_POLICY
        content_lower = [v.lower() for v in content_values if v]

        # Forbidden check (highest priority - checked first)
        forbidden = rules.get("forbidden_values") or []
        for f in forbidden:
            if f.lower() in content_lower:
                # Use rules-level penalty if defined, otherwise use MFP policy
                penalty = rules.get("forbidden_penalty", policy.forbidden_detected_penalty)
                return penalty, RuleViolation("forbidden", [f], penalty)

        # Mandatory check
        mandatory = rules.get("mandatory_values") or []
        if mandatory:
            missing = [m for m in mandatory if m.lower() not in content_lower]
            if missing:
                # Use rules-level penalty if defined, otherwise use MFP policy
                penalty = rules.get("mandatory_penalty", policy.mandatory_missed_penalty)
                return penalty, RuleViolation("mandatory", missing, penalty)
            else:
                # All mandatory values present - apply bonus
                bonus = policy.mandatory_matched_bonus
                return bonus, RuleViolation("mandatory", mandatory, bonus)

        # Preferred check (bonus)
        preferred = rules.get("preferred_values") or []
        for p in preferred:
            if p.lower() in content_lower:
                # Use rules-level bonus if defined, otherwise use MFP policy
                bonus = rules.get("preferred_bonus", policy.preferred_matched_bonus)
                return bonus, RuleViolation("preferred", [p], bonus)

        return 0.0, None

    def evaluate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> CriterionResult:
        """Evaluate criterion and return detailed result."""
        score = self.calculate(content, content_meta, profile, block, context)
        weight = self.get_weight(profile)
        multiplier = self.get_multiplier(profile, block)
        clamped_score = max(0.0, min(100.0, score))
        weighted_score = clamped_score * weight / 100.0
        return CriterionResult(
            name=self.name,
            score=clamped_score,
            weight=weight,
            weighted_score=weighted_score,
            multiplier=multiplier,
            multiplied_weighted_score=weighted_score * multiplier,
        )
