"""GenreCriterion - Genre preference matching with mandatory/forbidden support."""

from typing import Any

from app.core.scoring.base_criterion import (
    BaseCriterion,
    CriterionResult,
    RuleViolation,
    ScoringContext,
)


class GenreCriterion(BaseCriterion):
    """Score based on genre matching with preferences and mandatory/forbidden rules."""

    name = "genre"
    weight_key = "genre"
    default_weight = 25.0

    def calculate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> float:
        """
        Calculate genre matching score following the unified scoring system.

        Scoring logic:
        - 100: Has at least one mandatory genre AND matches preferred genres
        - 0: Contains forbidden genres (VIOLATION)
        - Heavy penalty if no mandatory genre present (when mandatory defined)
        - Bonus for preferred genres
        """
        if not content_meta:
            return 50.0  # Neutral if no metadata

        content_genres = {g.lower() for g in content_meta.get("genres", [])}
        if not content_genres:
            return 50.0  # Neutral if no genres

        # Get genre criteria from block or profile
        if block:
            block_criteria = block.get("criteria", {})
            genre_config = block_criteria.get("genre_criteria", {})
            # Direct definitions from block criteria
            # allowed_genres = mandatory (at least one must match)
            allowed = {g.lower() for g in block_criteria.get("allowed_genres", [])}
            preferred = {g.lower() for g in block_criteria.get("preferred_genres", [])}
            forbidden = {g.lower() for g in block_criteria.get("forbidden_genres", [])}
            # Also check genre_rules for M/F/P values
            genre_rules = block_criteria.get("genre_rules", {})
            if genre_rules:
                allowed |= {g.lower() for g in (genre_rules.get("mandatory_values") or [])}
                forbidden |= {g.lower() for g in (genre_rules.get("forbidden_values") or [])}
                preferred |= {g.lower() for g in (genre_rules.get("preferred_values") or [])}
        else:
            criteria = profile.get("mandatory_forbidden_criteria", {})
            genre_config = criteria.get("genre_criteria", {})
            # Direct definitions from profile
            allowed = {g.lower() for g in criteria.get("allowed_genres", [])}
            preferred = {g.lower() for g in criteria.get("preferred_genres", [])}
            forbidden = {g.lower() for g in criteria.get("forbidden_genres", [])}

        # Extract mandatory/forbidden/preferred from genre_criteria structure (legacy)
        mandatory_config = genre_config.get("mandatory_genres", {})
        forbidden_config = genre_config.get("forbidden_genres", {})
        preferred_config = genre_config.get("preferred_genres", {})

        # Get genres from legacy configs
        mandatory_genres_legacy = {g.lower() for g in mandatory_config.get("genres", [])}
        forbidden_genres_legacy = {g.lower() for g in forbidden_config.get("genres", [])}
        preferred_genres_legacy = {g.lower() for g in preferred_config.get("genres", [])}

        # Merge all mandatory sources (allowed_genres + legacy mandatory)
        mandatory = allowed | mandatory_genres_legacy
        forbidden = forbidden | forbidden_genres_legacy
        preferred = preferred | preferred_genres_legacy

        score = 75.0  # Base score

        # 1. Check for FORBIDDEN genres first (CRITICAL VIOLATION - score = 0)
        forbidden_matches = content_genres & forbidden
        if forbidden_matches:
            return 0.0

        # 2. Check MANDATORY genres (at least one must be present)
        # This is the key fix: if mandatory genres are defined, at least one must match
        if mandatory:
            has_any_mandatory = bool(content_genres & mandatory)
            if not has_any_mandatory:
                # No mandatory genre present - heavy penalty
                # This makes the score very low (close to 0 but allows other criteria to have effect)
                score = 10.0  # Very low base when mandatory not met
            else:
                # Has at least one mandatory genre - good!
                score = 85.0  # Higher base score

        # 3. Calculate bonus for preferred genres
        if preferred:
            preferred_matches = content_genres & preferred
            if preferred_matches:
                # Bonus based on number of preferred matches
                bonus = min(15.0, len(preferred_matches) * 5.0)
                score += bonus

        # 4. Extra bonus if content matches multiple mandatory genres
        if mandatory:
            mandatory_matches = content_genres & mandatory
            if len(mandatory_matches) > 1:
                # Bonus for matching multiple mandatory
                extra_bonus = min(10.0, (len(mandatory_matches) - 1) * 3.0)
                score += extra_bonus

        return max(0.0, min(100.0, score))

    def evaluate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> CriterionResult:
        """Evaluate criterion with genre-specific rules check."""
        score = self.calculate(content, content_meta, profile, block, context)
        weight = self.get_weight(profile)
        multiplier = self.get_multiplier(profile, block)
        mfp_policy = self.get_mfp_policy(profile, block)

        # Check for rule violations (genre-specific logic: at least one mandatory must match)
        rule_violation = None
        if content_meta:
            content_genres = {g.lower() for g in content_meta.get("genres", [])}

            # Collect all mandatory/forbidden/preferred genres from block or profile
            if block:
                block_criteria = block.get("criteria", {})
                mandatory = {g.lower() for g in block_criteria.get("allowed_genres", [])}
                forbidden = {g.lower() for g in block_criteria.get("forbidden_genres", [])}
                preferred = {g.lower() for g in block_criteria.get("preferred_genres", [])}
                # Add from genre_rules
                genre_rules = block_criteria.get("genre_rules", {})
                if genre_rules:
                    mandatory |= {g.lower() for g in (genre_rules.get("mandatory_values") or [])}
                    forbidden |= {g.lower() for g in (genre_rules.get("forbidden_values") or [])}
                    preferred |= {g.lower() for g in (genre_rules.get("preferred_values") or [])}
            else:
                criteria = profile.get("mandatory_forbidden_criteria", {})
                mandatory = {g.lower() for g in criteria.get("allowed_genres", [])}
                forbidden = {g.lower() for g in criteria.get("forbidden_genres", [])}
                preferred = {g.lower() for g in criteria.get("preferred_genres", [])}

            # 1. Check for FORBIDDEN violation (highest priority)
            forbidden_matches = content_genres & forbidden
            if forbidden_matches:
                rule_violation = RuleViolation(
                    rule_type="forbidden",
                    values=list(forbidden_matches),
                    penalty_or_bonus=mfp_policy.forbidden_detected_penalty,
                )
                score = 0.0  # Forbidden = zero score

            # 2. Check for MANDATORY violation (at least one must match)
            elif mandatory and not rule_violation:
                mandatory_matches = content_genres & mandatory
                if not mandatory_matches:
                    # No mandatory genre present - violation
                    rule_violation = RuleViolation(
                        rule_type="mandatory",
                        values=list(mandatory),  # Show what was expected
                        penalty_or_bonus=mfp_policy.mandatory_missed_penalty,
                    )
                    # Score already reduced in calculate()
                else:
                    # Mandatory met - report with bonus
                    rule_violation = RuleViolation(
                        rule_type="mandatory",
                        values=list(mandatory_matches),
                        penalty_or_bonus=mfp_policy.mandatory_matched_bonus,
                    )

            # 3. Check for PREFERRED match (for reporting)
            elif preferred and not rule_violation:
                preferred_matches = content_genres & preferred
                if preferred_matches:
                    rule_violation = RuleViolation(
                        rule_type="preferred",
                        values=list(preferred_matches),
                        penalty_or_bonus=mfp_policy.preferred_matched_bonus,
                    )

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
