"""TypeCriterion - Content type matching."""

from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, ScoringContext


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

        # Check for per-criterion rules
        rule_violation = None
        if block:
            block_criteria = block.get("criteria", {})
            type_rules = block_criteria.get("type_rules")
            if type_rules:
                content_type = content.get("type", "")
                content_values = [content_type] if content_type else []
                adjustment, rule_violation = self.check_rules(content_values, type_rules)
                score += adjustment

        score = max(0.0, min(100.0, score))
        return CriterionResult(
            name=self.name,
            score=score,
            weight=weight,
            weighted_score=score * weight / 100.0,
            rule_violation=rule_violation,
        )
