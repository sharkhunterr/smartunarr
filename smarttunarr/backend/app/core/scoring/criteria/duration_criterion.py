"""DurationCriterion - Duration fit in block."""

from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, ScoringContext


class DurationCriterion(BaseCriterion):
    """Score based on how well content duration fits in time block."""

    name = "duration"
    weight_key = "duration"
    default_weight = 15.0

    def calculate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> float:
        """
        Calculate duration fit score.

        - 100: Perfect fit within block
        - Decreases as content exceeds or significantly under-fills block
        """
        duration_ms = content.get("duration_ms") or 0
        if duration_ms <= 0:
            return 0.0

        duration_min = duration_ms / 60000  # Convert to minutes

        # If no block context, use profile defaults
        if not block:
            default_criteria = profile.get("mandatory_forbidden_criteria", {})
            min_duration = default_criteria.get("min_duration_min") or 1
            max_duration = default_criteria.get("max_duration_min") or 240
        else:
            block_criteria = block.get("criteria", {})
            min_duration = block_criteria.get("min_duration_min") or 1
            max_duration = block_criteria.get("max_duration_min") or 240

        # Check bounds
        if duration_min < min_duration:
            # Too short - calculate penalty
            ratio = duration_min / min_duration
            return max(0.0, ratio * 50.0)

        if duration_min > max_duration:
            # Too long - calculate penalty
            excess = duration_min - max_duration
            penalty = min(50.0, excess / max_duration * 100)
            return max(0.0, 100.0 - penalty)

        # Perfect fit calculation
        ideal_duration = (min_duration + max_duration) / 2
        deviation = abs(duration_min - ideal_duration)
        range_size = (max_duration - min_duration) / 2

        if range_size > 0:
            fit_ratio = 1 - (deviation / range_size)
            return 70.0 + (fit_ratio * 30.0)

        return 85.0  # Default good score

    def evaluate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> CriterionResult:
        """Evaluate criterion with optional rules check."""
        score = self.calculate(content, content_meta, profile, block, context)
        weight = self.get_weight(profile)

        # Check for per-criterion rules
        # For duration, rules use categories: "short", "medium", "long", "feature"
        rule_violation = None
        if block:
            block_criteria = block.get("criteria", {})
            duration_rules = block_criteria.get("duration_rules")
            if duration_rules:
                duration_ms = content.get("duration_ms") or 0
                duration_min = duration_ms / 60000
                # Categorize duration
                duration_categories = []
                if duration_min <= 30:
                    duration_categories.append("short")
                elif duration_min <= 60:
                    duration_categories.append("medium")
                elif duration_min <= 120:
                    duration_categories.append("long")
                else:
                    duration_categories.append("feature")
                # Also add exact minutes as string for precise matching
                duration_categories.append(f"{int(duration_min)}min")
                adjustment, rule_violation = self.check_rules(duration_categories, duration_rules)
                score += adjustment

        score = max(0.0, min(100.0, score))
        return CriterionResult(
            name=self.name,
            score=score,
            weight=weight,
            weighted_score=score * weight / 100.0,
            rule_violation=rule_violation,
        )
