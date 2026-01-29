"""FilterCriterion - Keyword/studio filters scoring."""

from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, ScoringContext


class FilterCriterion(BaseCriterion):
    """Score based on keyword and studio filters."""

    name = "filter"
    weight_key = "filter"
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
        Calculate filter compliance score.

        - 0: Matches forbidden keyword/studio
        - 100: Matches preferred keyword/studio
        - 50: No match with any filter (neutral)
        """
        if not content_meta:
            return 50.0  # Neutral if no metadata

        content_keywords = set(k.lower() for k in content_meta.get("keywords", []))
        content_studios = set(s.lower() for s in content_meta.get("studios", []))
        content_title = content.get("title", "").lower()

        # Get filters from block or profile
        if block:
            block_criteria = block.get("criteria", {})
            forbidden_keywords = set(k.lower() for k in block_criteria.get("forbidden_keywords", []))
            preferred_keywords = set(k.lower() for k in block_criteria.get("preferred_keywords", []))
            forbidden_studios = set(s.lower() for s in block_criteria.get("forbidden_studios", []))
            preferred_studios = set(s.lower() for s in block_criteria.get("preferred_studios", []))
            # Also include from filter_rules if defined
            filter_rules = block_criteria.get("filter_rules", {})
            if filter_rules:
                forbidden_keywords |= set(k.lower() for k in filter_rules.get("forbidden_values", []))
                preferred_keywords |= set(k.lower() for k in filter_rules.get("preferred_values", []))
        else:
            criteria = profile.get("mandatory_forbidden_criteria", {})
            forbidden_keywords = set(k.lower() for k in criteria.get("forbidden_keywords", []))
            preferred_keywords = set(k.lower() for k in criteria.get("preferred_keywords", []))
            forbidden_studios = set(s.lower() for s in criteria.get("forbidden_studios", []))
            preferred_studios = set(s.lower() for s in criteria.get("preferred_studios", []))

        # Check forbidden filters first (use substring matching)
        if forbidden_keywords:
            # Check keywords with substring matching
            for content_kw in content_keywords:
                for forbidden_kw in forbidden_keywords:
                    if forbidden_kw in content_kw:
                        return 0.0
            # Check title for forbidden keywords
            for keyword in forbidden_keywords:
                if keyword in content_title:
                    return 0.0

        if forbidden_studios and content_studios & forbidden_studios:
            return 0.0

        score = 50.0  # Base score (neutral)

        # Bonus for preferred matches - use substring matching and stack bonuses
        if preferred_keywords:
            matched_count = 0
            matched_preferred = set()  # Track which preferred keywords matched

            # Check each content keyword against preferred keywords
            for content_kw in content_keywords:
                for pref_kw in preferred_keywords:
                    # Match if preferred keyword is contained in content keyword
                    # e.g., "superhero" in "superhero team", "dc" in "dc extended universe"
                    if pref_kw in content_kw:
                        matched_count += 1
                        matched_preferred.add(pref_kw)
                        break  # Count each content keyword only once

            # Also check title for preferred keywords not yet matched
            for pref_kw in preferred_keywords:
                if pref_kw not in matched_preferred and pref_kw in content_title:
                    matched_count += 1

            # Stack bonuses: +5 per match, max 50 points from keywords
            if matched_count > 0:
                score += min(50.0, matched_count * 5.0)

        if preferred_studios:
            studio_matches = content_studios & preferred_studios
            if studio_matches:
                score += min(20.0, len(studio_matches) * 10.0)

        return min(100.0, score)

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

        # Check for per-criterion rules (for RuleViolation reporting only)
        # Score adjustment already handled in calculate()
        rule_violation = None
        if block and content_meta:
            block_criteria = block.get("criteria", {})
            filter_rules = block_criteria.get("filter_rules")
            if filter_rules:
                # Combine keywords, studios, and title words for matching
                content_values = list(content_meta.get("keywords", []))
                content_values.extend(content_meta.get("studios", []))
                # Add title words
                title = content.get("title", "")
                if title:
                    content_values.extend(title.split())
                # Only get violation for reporting, don't apply adjustment
                _, rule_violation = self.check_rules(content_values, filter_rules)

        score = max(0.0, min(100.0, score))
        return CriterionResult(
            name=self.name,
            score=score,
            weight=weight,
            weighted_score=score * weight / 100.0,
            rule_violation=rule_violation,
        )
