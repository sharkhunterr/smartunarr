"""BonusCriterion - Contextual bonuses scoring."""

from datetime import datetime
from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, RuleViolation, ScoringContext


class BonusCriterion(BaseCriterion):
    """Score based on contextual bonuses."""

    name = "bonus"
    weight_key = "bonus"
    default_weight = 20.0

    def calculate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> float:
        """Calculate contextual bonus score."""
        score, _, _, _ = self._calculate_with_bonuses(content, content_meta, profile, block, context)
        return score

    def _calculate_with_bonuses(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> tuple[float, list[str]]:
        """
        Calculate contextual bonus score with applied bonus tracking.

        Returns:
            Tuple of (score, list of applied bonus descriptions)
        """
        score = 50.0  # Base score
        bonuses_applied: list[str] = []
        bonus_categories_earned: list[str] = []  # Track earned bonus categories for M/F/P

        if not content_meta:
            return score, bonuses_applied

        # Get bonus_rules from block criteria if available
        bonus_rules = None
        if block:
            bonus_rules = block.get("criteria", {}).get("bonus_rules")

        forbidden_categories = [v.lower() for v in (bonus_rules.get("forbidden_values") or [])] if bonus_rules else []
        preferred_categories = [v.lower() for v in (bonus_rules.get("preferred_values") or [])] if bonus_rules else []
        mandatory_categories = [v.lower() for v in (bonus_rules.get("mandatory_values") or [])] if bonus_rules else []

        current_year = datetime.now().year

        # Release year bonus (categories: "recent", "recency")
        content_year = content.get("year")
        if content_year:
            age = current_year - content_year
            category_forbidden = any(c in forbidden_categories for c in ["recent", "recency"])
            category_preferred = any(c in preferred_categories for c in ["recent", "recency"])

            if age <= 2 and not category_forbidden:
                bonus = 20.0
                if category_preferred:
                    bonus += 10.0  # Extra bonus for preferred
                score += bonus
                bonuses_applied.append(f"Sortie récente ({content_year}): +{bonus:.0f}")
                bonus_categories_earned.extend(["recent", "recency"])
            elif age <= 5 and not category_forbidden:
                bonus = 10.0
                if category_preferred:
                    bonus += 5.0
                score += bonus
                bonuses_applied.append(f"Assez récent ({content_year}): +{bonus:.0f}")
                bonus_categories_earned.extend(["recent", "recency"])
            elif age > 20:
                score -= 5.0
                bonuses_applied.append(f"Contenu ancien ({content_year}): -5")

        # Box office success bonus (category: "blockbuster")
        revenue = content_meta.get("revenue") or 0
        budget = content_meta.get("budget") or 0
        category_forbidden = "blockbuster" in forbidden_categories
        category_preferred = "blockbuster" in preferred_categories

        if budget and revenue and not category_forbidden:
            if revenue > budget * 3:
                bonus = 15.0
                if category_preferred:
                    bonus += 10.0
                score += bonus
                bonuses_applied.append(f"Blockbuster (3x+ ROI): +{bonus:.0f}")
                bonus_categories_earned.append("blockbuster")
            elif revenue > budget * 2:
                bonus = 10.0
                if category_preferred:
                    bonus += 5.0
                score += bonus
                bonuses_applied.append(f"Succès commercial (2x+ ROI): +{bonus:.0f}")
                bonus_categories_earned.append("blockbuster")
            elif revenue > budget:
                bonus = 5.0
                score += bonus
                bonuses_applied.append(f"Rentable: +{bonus:.0f}")
                bonus_categories_earned.append("blockbuster")

        # Collection membership bonus (categories: "collection", "franchise")
        collections = content_meta.get("collections") or []
        category_forbidden = any(c in forbidden_categories for c in ["collection", "franchise"])
        category_preferred = any(c in preferred_categories for c in ["collection", "franchise"])

        if collections and not category_forbidden:
            bonus = min(10.0, len(collections) * 5.0)
            if category_preferred:
                bonus += 5.0
            score += bonus
            coll_names = ", ".join(collections[:2])
            bonuses_applied.append(f"Collection ({coll_names}): +{bonus:.0f}")
            bonus_categories_earned.extend(["collection", "franchise"])

        # High vote count bonus (category: "popular")
        vote_count = content_meta.get("vote_count") or 0
        category_forbidden = "popular" in forbidden_categories
        category_preferred = "popular" in preferred_categories

        if not category_forbidden:
            if vote_count > 10000:
                bonus = 10.0
                if category_preferred:
                    bonus += 5.0
                score += bonus
                bonuses_applied.append(f"Très populaire ({vote_count} votes): +{bonus:.0f}")
                bonus_categories_earned.append("popular")
            elif vote_count > 5000:
                bonus = 5.0
                if category_preferred:
                    bonus += 3.0
                score += bonus
                bonuses_applied.append(f"Populaire ({vote_count} votes): +{bonus:.0f}")
                bonus_categories_earned.append("popular")

        # Seasonal bonuses (categories: "holiday", "seasonal")
        bonuses_config = profile.get("strategies", {}).get("bonuses", {})
        category_forbidden = any(c in forbidden_categories for c in ["holiday", "seasonal"])
        category_preferred = any(c in preferred_categories for c in ["holiday", "seasonal"])

        # Holiday season bonus
        if bonuses_config.get("holiday_bonus", False) and not category_forbidden:
            content_keywords = [k.lower() for k in content_meta.get("keywords", [])]

            holiday_keywords = ["christmas", "holiday", "thanksgiving", "halloween", "noel", "noël"]
            if any(k in kw for kw in content_keywords for k in holiday_keywords):
                current_month = datetime.now().month
                if current_month in [10, 11, 12]:
                    bonus = 15.0
                    if category_preferred:
                        bonus += 10.0
                    score += bonus
                    bonuses_applied.append(f"Contenu de saison: +{bonus:.0f}")
                    bonus_categories_earned.extend(["holiday", "seasonal"])

        # Enhanced criteria bonuses (v6)
        enhanced = profile.get("enhanced_criteria", {})

        # Keywords safety bonus
        keywords_safety = enhanced.get("keywords_safety", {})
        if keywords_safety.get("enabled", False):
            content_keywords = [k.lower() for k in content_meta.get("keywords", [])]
            safe_keywords = [k.lower() for k in keywords_safety.get("safe_keywords", [])]
            dangerous_keywords = [k.lower() for k in keywords_safety.get("dangerous_keywords", [])]

            for kw in content_keywords:
                if any(safe in kw for safe in safe_keywords):
                    bonus = keywords_safety.get("safe_bonus_points", 5)
                    score += bonus
                    bonuses_applied.append(f"Mot-clé sûr: +{bonus}")
                    break

            for kw in content_keywords:
                if any(danger in kw for danger in dangerous_keywords):
                    penalty = keywords_safety.get("dangerous_penalty_points", -100)
                    score += penalty
                    bonuses_applied.append(f"Mot-clé dangereux: {penalty}")
                    break

        # Collections/Franchises bonus (enhanced)
        collections_config = enhanced.get("collections_franchises", {})
        if collections_config.get("enabled", False):
            content_collections = [c.lower() for c in (content_meta.get("collections") or [])]
            preferred_collections = [c.lower() for c in collections_config.get("preferred_collections", [])]

            for coll in content_collections:
                if any(pref in coll or coll in pref for pref in preferred_collections):
                    bonus = collections_config.get("collection_bonus_points", 10)
                    score += bonus
                    bonuses_applied.append(f"Collection préférée: +{bonus}")
                    break

        # Cast/Crew bonus
        cast_config = enhanced.get("cast_crew", {})
        if cast_config.get("enabled", False):
            content_cast = [c.lower() for c in content_meta.get("cast", [])]
            preferred_actors = [a.lower() for a in cast_config.get("preferred_actors", [])]

            for actor in content_cast[:5]:
                if any(pref in actor or actor in pref for pref in preferred_actors):
                    bonus = cast_config.get("popular_actor_bonus", 3)
                    score += bonus
                    bonuses_applied.append(f"Acteur préféré: +{bonus}")
                    break

        # Educational value bonus
        edu_config = enhanced.get("educational_value", {})
        if edu_config.get("enabled", False):
            content_keywords = [k.lower() for k in content_meta.get("keywords", [])]
            edu_keywords = [k.lower() for k in edu_config.get("educational_keywords", [])]

            if any(edu in kw for kw in content_keywords for edu in edu_keywords):
                bonus = edu_config.get("bonus_points", 5)
                score += bonus
                bonuses_applied.append(f"Contenu éducatif: +{bonus}")

        # Check mandatory categories - apply penalty if required categories not earned
        rule_violation = None
        if mandatory_categories:
            earned_lower = [c.lower() for c in bonus_categories_earned]
            missing_mandatory = [m for m in mandatory_categories if m not in earned_lower]
            if missing_mandatory:
                penalty = bonus_rules.get("mandatory_penalty", -50.0) if bonus_rules else -50.0
                score += penalty
                bonuses_applied.append(f"Bonus requis manquant ({', '.join(missing_mandatory)}): {penalty:.0f}")
                rule_violation = RuleViolation("mandatory", missing_mandatory, penalty)

        # Check if any preferred categories were matched (for reporting)
        if not rule_violation and preferred_categories:
            earned_lower = [c.lower() for c in bonus_categories_earned]
            matched_preferred = [p for p in preferred_categories if p in earned_lower]
            if matched_preferred:
                rule_violation = RuleViolation("preferred", matched_preferred, bonus_rules.get("preferred_bonus", 20.0) if bonus_rules else 20.0)

        return max(0.0, min(100.0, score)), bonuses_applied, bonus_categories_earned, rule_violation

    def evaluate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> CriterionResult:
        """Evaluate criterion and return detailed result with bonuses."""
        score, bonuses, bonus_categories_earned, rule_violation = self._calculate_with_bonuses(
            content, content_meta, profile, block, context
        )
        weight = self.get_weight(profile)

        return CriterionResult(
            name=self.name,
            score=score,
            weight=weight,
            weighted_score=score * weight / 100.0,
            details={
                "bonuses_applied": bonuses,
                "bonus_categories_earned": bonus_categories_earned,
            },
            rule_violation=rule_violation,
        )
