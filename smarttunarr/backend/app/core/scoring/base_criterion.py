"""Base criterion abstract class for scoring."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
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


@dataclass
class RuleViolation:
    """Rule violation or match detected for a criterion."""

    rule_type: str  # "mandatory", "forbidden", "preferred"
    values: list[str]  # Values involved in the violation/match
    penalty_or_bonus: float  # Points applied (negative for penalty, positive for bonus)


@dataclass
class CriterionResult:
    """Result of a criterion calculation."""

    name: str
    score: float  # 0.0-100.0
    weight: float
    weighted_score: float
    details: dict[str, Any] | None = None
    rule_violation: RuleViolation | None = None  # Rule violation if detected


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

    def check_rules(
        self,
        content_values: list[str],
        rules: dict[str, Any] | None,
    ) -> tuple[float, RuleViolation | None]:
        """
        Check mandatory/forbidden/preferred rules for this criterion.

        Args:
            content_values: Values from the content to check against rules
            rules: Rules dict with mandatory_values, forbidden_values, preferred_values, etc.

        Returns:
            Tuple of (adjustment, violation) where:
            - adjustment: Points to add/subtract from score
            - violation: RuleViolation if a rule was triggered, None otherwise
        """
        if not rules:
            return 0.0, None

        content_lower = [v.lower() for v in content_values if v]

        # Forbidden check (highest priority - checked first)
        forbidden = rules.get("forbidden_values") or []
        for f in forbidden:
            if f.lower() in content_lower:
                penalty = rules.get("forbidden_penalty", -200.0)
                return penalty, RuleViolation("forbidden", [f], penalty)

        # Mandatory check
        mandatory = rules.get("mandatory_values") or []
        if mandatory:
            missing = [m for m in mandatory if m.lower() not in content_lower]
            if missing:
                penalty = rules.get("mandatory_penalty", -50.0)
                return penalty, RuleViolation("mandatory", missing, penalty)

        # Preferred check (bonus)
        preferred = rules.get("preferred_values") or []
        for p in preferred:
            if p.lower() in content_lower:
                bonus = rules.get("preferred_bonus", 20.0)
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
        return CriterionResult(
            name=self.name,
            score=max(0.0, min(100.0, score)),  # Clamp to 0-100
            weight=weight,
            weighted_score=score * weight / 100.0,
        )
