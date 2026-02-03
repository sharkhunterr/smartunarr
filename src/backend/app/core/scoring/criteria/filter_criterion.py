"""FilterCriterion - Keyword/studio filters scoring."""

from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, MFPPolicyConfig, RuleViolation, ScoringContext


class FilterCriterion(BaseCriterion):
    """Score based on keyword and studio filters."""

    name = "filter"
    weight_key = "filter"
    default_weight = 20.0

    def _calculate_with_mfp(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
        mfp_policy: MFPPolicyConfig | None = None,
    ) -> tuple[float, RuleViolation | None, list[str]]:
        """
        Calculate filter compliance score using MFP policy.

        Returns:
            Tuple of (score, rule_violation, matched_keywords)
        """
        if not content_meta:
            return 50.0, None, []

        # Get MFP bonus/penalty values (use defaults if not provided)
        preferred_bonus = mfp_policy.preferred_matched_bonus if mfp_policy else 20.0
        forbidden_penalty = mfp_policy.forbidden_detected_penalty if mfp_policy else -400.0

        content_keywords = set(k.lower() for k in content_meta.get("keywords", []))
        content_studios = set(s.lower() for s in content_meta.get("studios", []))
        content_title = content.get("title", "").lower()

        # Get filters from block or profile
        filter_rules = None
        if block:
            block_criteria = block.get("criteria", {})
            forbidden_keywords = set(k.lower() for k in block_criteria.get("forbidden_keywords", []))
            preferred_keywords = set(k.lower() for k in block_criteria.get("preferred_keywords", []))
            forbidden_studios = set(s.lower() for s in block_criteria.get("forbidden_studios", []))
            preferred_studios = set(s.lower() for s in block_criteria.get("preferred_studios", []))
            # Also include from filter_rules if defined
            filter_rules = block_criteria.get("filter_rules", {})
            if filter_rules:
                forbidden_keywords |= set(k.lower() for k in (filter_rules.get("forbidden_values") or []))
                preferred_keywords |= set(k.lower() for k in (filter_rules.get("preferred_values") or []))
                # MFP policy takes precedence, only use rule-specific values as fallback
                # if MFP policy wasn't provided
                if not mfp_policy:
                    if filter_rules.get("preferred_bonus") is not None:
                        preferred_bonus = filter_rules["preferred_bonus"]
                    if filter_rules.get("forbidden_penalty") is not None:
                        forbidden_penalty = filter_rules["forbidden_penalty"]
        else:
            criteria = profile.get("mandatory_forbidden_criteria", {})
            forbidden_keywords = set(k.lower() for k in criteria.get("forbidden_keywords", []))
            preferred_keywords = set(k.lower() for k in criteria.get("preferred_keywords", []))
            forbidden_studios = set(s.lower() for s in criteria.get("forbidden_studios", []))
            preferred_studios = set(s.lower() for s in criteria.get("preferred_studios", []))

        rule_violation = None
        matched_keywords: list[str] = []

        # Check forbidden filters first (use substring matching)
        if forbidden_keywords:
            # Check keywords with substring matching
            for content_kw in content_keywords:
                for forbidden_kw in forbidden_keywords:
                    if forbidden_kw in content_kw:
                        rule_violation = RuleViolation("forbidden", [forbidden_kw], forbidden_penalty)
                        return 0.0, rule_violation, []
            # Check title for forbidden keywords
            for keyword in forbidden_keywords:
                if keyword in content_title:
                    rule_violation = RuleViolation("forbidden", [keyword], forbidden_penalty)
                    return 0.0, rule_violation, []

        if forbidden_studios and content_studios & forbidden_studios:
            matched_forbidden = list(content_studios & forbidden_studios)
            rule_violation = RuleViolation("forbidden", matched_forbidden, forbidden_penalty)
            return 0.0, rule_violation, []

        score = 50.0  # Base score (neutral)

        # Bonus for preferred matches - use MFP policy bonus
        if preferred_keywords:
            matched_preferred = set()  # Track which preferred keywords matched

            # Check each content keyword against preferred keywords
            for content_kw in content_keywords:
                for pref_kw in preferred_keywords:
                    # Match if preferred keyword is contained in content keyword
                    if pref_kw in content_kw:
                        matched_preferred.add(pref_kw)
                        break  # Count each content keyword only once

            # Also check title for preferred keywords not yet matched
            for pref_kw in preferred_keywords:
                if pref_kw not in matched_preferred and pref_kw in content_title:
                    matched_preferred.add(pref_kw)

            # Apply bonus based on MFP policy - scale by number of matches
            if matched_preferred:
                matched_keywords = list(matched_preferred)
                # Base bonus for first match, then diminishing returns for additional matches
                # First match gets full bonus, subsequent matches get 20% each (max 50 points total)
                bonus = preferred_bonus + min(30.0, (len(matched_preferred) - 1) * (preferred_bonus * 0.2))
                score += bonus
                rule_violation = RuleViolation("preferred", matched_keywords, bonus)

        if preferred_studios:
            studio_matches = content_studios & preferred_studios
            if studio_matches:
                # Studios also use MFP bonus, scaled
                studio_bonus = min(preferred_bonus, len(studio_matches) * (preferred_bonus * 0.5))
                score += studio_bonus
                # If no keyword match yet, create violation for studios
                if not rule_violation:
                    rule_violation = RuleViolation("preferred", list(studio_matches), studio_bonus)

        return min(100.0, score), rule_violation, matched_keywords

    def calculate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> float:
        """Calculate filter compliance score (for backward compatibility)."""
        score, _, _ = self._calculate_with_mfp(content, content_meta, profile, block, context)
        return score

    def evaluate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> CriterionResult:
        """Evaluate criterion with MFP policy applied."""
        weight = self.get_weight(profile)
        multiplier = self.get_multiplier(profile, block)
        mfp_policy = self.get_mfp_policy(profile, block)

        # Calculate score with MFP policy and get rule violation
        score, rule_violation, matched_keywords = self._calculate_with_mfp(
            content, content_meta, profile, block, context, mfp_policy
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
            details={"matched_keywords": matched_keywords} if matched_keywords else None,
            rule_violation=rule_violation,
        )
