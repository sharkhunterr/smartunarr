"""TypeCriterion - Content type matching."""

from typing import Any

from app.core.scoring.base_criterion import (
    BaseCriterion,
    CriterionResult,
    RuleViolation,
    ScoringContext,
)


class TypeCriterion(BaseCriterion):
    """Score based on content type matching block preferences."""

    name = "type"
    weight_key = "type"
    default_weight = 20.0

    def calculate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> float:
        """
        Calculate type matching score.

        - 100: Perfect match with block's preferred types
        - 50: Match with profile's allowed types
        - 0: Type not allowed
        """
        content_type = content.get("type", "").lower()
        if not content_type:
            return 50.0  # Neutral if no type

        # Check block preferences first
        if block:
            block_criteria = block.get("criteria", {})
            preferred_types = block_criteria.get("preferred_types", [])
            allowed_types = block_criteria.get("allowed_types", [])
            excluded_types = block_criteria.get("excluded_types", [])

            # Check if excluded
            if content_type in [t.lower() for t in excluded_types]:
                return 0.0

            # Check if preferred
            if preferred_types and content_type in [t.lower() for t in preferred_types]:
                return 100.0

            # Check if allowed
            if allowed_types and content_type in [t.lower() for t in allowed_types]:
                return 75.0

        # Check profile-level type preferences
        mandatory_criteria = profile.get("mandatory_forbidden_criteria", {})
        allowed_types = mandatory_criteria.get("allowed_types", [])
        forbidden_types = mandatory_criteria.get("forbidden_types", [])

        if content_type in [t.lower() for t in forbidden_types]:
            return 0.0

        if allowed_types and content_type not in [t.lower() for t in allowed_types]:
            return 25.0

        return 75.0  # Default acceptable score

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
        # Logic: content has ONE type, mandatory means "must be one of these"
        rule_violation = None
        if block:
            block_criteria = block.get("criteria", {})
            type_rules = block_criteria.get("type_rules")
            if type_rules:
                content_type = content.get("type", "").lower()
                if content_type:
                    # Custom M/F/P logic for type (single type vs list of allowed/forbidden)
                    forbidden = [v.lower() for v in (type_rules.get("forbidden_values") or [])]
                    mandatory = [v.lower() for v in (type_rules.get("mandatory_values") or [])]
                    preferred = [v.lower() for v in (type_rules.get("preferred_values") or [])]

                    # Check forbidden first (highest priority)
                    if content_type in forbidden:
                        penalty = type_rules.get("forbidden_penalty", mfp_policy.forbidden_detected_penalty)
                        rule_violation = RuleViolation("forbidden", [content_type], penalty)
                        score += penalty
                    # Check mandatory (content type must be IN the mandatory list)
                    elif mandatory and content_type not in mandatory:
                        penalty = type_rules.get("mandatory_penalty", mfp_policy.mandatory_missed_penalty)
                        rule_violation = RuleViolation("mandatory", mandatory, penalty)
                        score += penalty
                    # Check preferred (bonus if in preferred list)
                    elif content_type in preferred:
                        bonus = type_rules.get("preferred_bonus", mfp_policy.preferred_matched_bonus)
                        rule_violation = RuleViolation("preferred", [content_type], bonus)
                        score += bonus
                    # If mandatory is defined and type matches, give bonus
                    elif mandatory and content_type in mandatory:
                        bonus = mfp_policy.mandatory_matched_bonus
                        rule_violation = RuleViolation("mandatory", [content_type], bonus)
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
