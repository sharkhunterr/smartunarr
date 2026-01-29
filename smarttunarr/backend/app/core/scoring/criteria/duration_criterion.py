"""DurationCriterion - Duration fit in block."""

from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, RuleViolation, ScoringContext


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
        multiplier = self.get_multiplier(profile, block)
        mfp_policy = self.get_mfp_policy(profile, block)

        # Check for per-criterion rules
        # For duration, rules use categories: "short", "medium", "standard", "long", "epic", "very_long"
        # Logic: content has ONE category, mandatory means "must be one of these"
        rule_violation = None
        if block:
            block_criteria = block.get("criteria", {})
            duration_rules = block_criteria.get("duration_rules")
            if duration_rules:
                duration_ms = content.get("duration_ms") or 0
                duration_min = duration_ms / 60000
                # Categorize duration
                duration_category = None
                if duration_min <= 30:
                    duration_category = "short"
                elif duration_min <= 60:
                    duration_category = "medium"
                elif duration_min <= 90:
                    duration_category = "standard"
                elif duration_min <= 150:
                    duration_category = "long"
                elif duration_min <= 200:
                    duration_category = "epic"
                else:
                    duration_category = "very_long"

                if duration_category:
                    # Custom M/F/P logic for duration (single category vs list of allowed/forbidden)
                    forbidden = [v.lower() for v in (duration_rules.get("forbidden_values") or [])]
                    mandatory = [v.lower() for v in (duration_rules.get("mandatory_values") or [])]
                    preferred = [v.lower() for v in (duration_rules.get("preferred_values") or [])]

                    # Check forbidden first (highest priority)
                    if duration_category.lower() in forbidden:
                        penalty = duration_rules.get("forbidden_penalty", mfp_policy.forbidden_detected_penalty)
                        rule_violation = RuleViolation("forbidden", [duration_category], penalty)
                        score += penalty
                    # Check mandatory (content category must be IN the mandatory list)
                    elif mandatory and duration_category.lower() not in mandatory:
                        penalty = duration_rules.get("mandatory_penalty", mfp_policy.mandatory_missed_penalty)
                        rule_violation = RuleViolation("mandatory", mandatory, penalty)
                        score += penalty
                    # Check preferred (bonus if in preferred list)
                    elif duration_category.lower() in preferred:
                        bonus = duration_rules.get("preferred_bonus", mfp_policy.preferred_matched_bonus)
                        rule_violation = RuleViolation("preferred", [duration_category], bonus)
                        score += bonus
                    # If mandatory is defined and category matches, give bonus
                    elif mandatory and duration_category.lower() in mandatory:
                        bonus = mfp_policy.mandatory_matched_bonus
                        rule_violation = RuleViolation("mandatory", [duration_category], bonus)
                        score += bonus

        score = max(0.0, min(100.0, score))
        weighted_score = score * weight / 100.0
        return CriterionResult(
            name=self.name,
            score=score,
            weight=weight,
            weighted_score=weighted_score,
            multiplier=multiplier,
            multiplied_weighted_score=weighted_score * multiplier,
            rule_violation=rule_violation,
        )
