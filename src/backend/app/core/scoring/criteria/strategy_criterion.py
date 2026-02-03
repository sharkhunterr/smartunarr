"""StrategyCriterion - Sequence/insertion rules scoring."""

from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, ScoringContext


class StrategyCriterion(BaseCriterion):
    """Score based on programming strategy compliance."""

    name = "strategy"
    weight_key = "strategy"
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
        Calculate strategy compliance score.

        Strategies include:
        - sequence: Follow series order
        - insertion: Insert filler content
        - variety: Maximize genre variety
        - marathon: Same series/franchise
        """
        strategies = profile.get("strategies", {})
        if not strategies:
            return 80.0  # No strategies defined

        score = 100.0

        # Check sequence strategy
        if strategies.get("maintain_sequence", False):
            # This would need context about previous programs
            # For now, assume episode content follows sequence
            content_type = content.get("type", "").lower()
            if content_type == "episode":
                # Episodes are assumed to follow sequence
                pass
            else:
                # Non-episode content gets slight penalty in sequence mode
                score -= 5.0

        # Check variety strategy
        if strategies.get("maximize_variety", False):
            # Would need context about other content in block
            # For now, diverse genres score better
            if content_meta:
                genres = content_meta.get("genres", [])
                if len(genres) > 2:
                    score += 5.0  # Bonus for diverse content

        # Check marathon strategy
        if strategies.get("marathon_mode", False):
            # Would need context about series/franchise
            # For now, check if content is part of collection
            if content_meta:
                collections = content_meta.get("collections", [])
                if collections:
                    score += 10.0  # Bonus for collection content

        # Check filler insertion strategy
        filler_config = strategies.get("filler_insertion", {})
        if filler_config.get("enabled", False):
            content_type = content.get("type", "").lower()
            filler_types = filler_config.get("types", ["trailer"])
            if content_type in [t.lower() for t in filler_types]:
                score += 5.0  # Slight bonus for filler content

        return max(0.0, min(100.0, score))

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
        # For strategy, rules check content characteristics, not profile settings
        # "filler" = content IS filler type (trailer, etc.)
        # "variety" = content has diverse genres
        # "marathon" = content is part of a collection/franchise
        rule_violation = None
        if block:
            block_criteria = block.get("criteria", {})
            strategy_rules = block_criteria.get("strategy_rules")
            if strategy_rules:
                strategies = profile.get("strategies", {})
                content_characteristics = []

                # Check if content IS a filler type (not if filler is enabled in profile)
                content_type = content.get("type", "").lower()
                filler_types = strategies.get("filler_insertion", {}).get("types", ["trailer"])
                filler_types_lower = [t.lower() for t in filler_types]
                if content_type in filler_types_lower:
                    content_characteristics.append("filler")

                # Check if content has variety (multiple genres)
                if content_meta:
                    genres = content_meta.get("genres", [])
                    if len(genres) >= 2:
                        content_characteristics.append("variety")

                    # Check if content is part of a collection (marathon-suitable)
                    collections = content_meta.get("collections", [])
                    if collections:
                        content_characteristics.append("marathon")

                # Add content type for type-based matching
                if content_type:
                    content_characteristics.append(content_type)

                adjustment, rule_violation = self.check_rules(content_characteristics, strategy_rules, mfp_policy)
                score += adjustment

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
