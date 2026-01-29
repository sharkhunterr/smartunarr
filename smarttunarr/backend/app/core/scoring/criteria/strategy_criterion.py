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
        penalty_per_violation = 20.0

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

        # Check for per-criterion rules
        # For strategy, rules use strategy names: "sequence", "variety", "marathon", "filler"
        rule_violation = None
        if block:
            block_criteria = block.get("criteria", {})
            strategy_rules = block_criteria.get("strategy_rules")
            if strategy_rules:
                strategies = profile.get("strategies", {})
                active_strategies = []
                if strategies.get("maintain_sequence", False):
                    active_strategies.append("sequence")
                if strategies.get("maximize_variety", False):
                    active_strategies.append("variety")
                if strategies.get("marathon_mode", False):
                    active_strategies.append("marathon")
                if strategies.get("filler_insertion", {}).get("enabled", False):
                    active_strategies.append("filler")
                # Add content type for matching
                content_type = content.get("type", "")
                if content_type:
                    active_strategies.append(content_type)

                adjustment, rule_violation = self.check_rules(active_strategies, strategy_rules)
                score += adjustment

        score = max(0.0, min(100.0, score))
        return CriterionResult(
            name=self.name,
            score=score,
            weight=weight,
            weighted_score=score * weight / 100.0,
            rule_violation=rule_violation,
        )
