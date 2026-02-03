"""BonusCriterion - Contextual bonuses scoring with M/F/P support."""

from datetime import datetime
from typing import Any

from app.core.scoring.base_criterion import (
    DEFAULT_MFP_POLICY,
    BaseCriterion,
    CriterionResult,
    MFPPolicyConfig,
    RuleViolation,
    ScoringContext,
)


class BonusCriterion(BaseCriterion):
    """Score based on contextual bonuses with configurable M/F/P policy."""

    name = "bonus"
    weight_key = "bonus"
    default_weight = 20.0

    # Bonus category definitions (for M/F/P matching)
    CATEGORY_RECENT = ["recent", "recency"]
    CATEGORY_OLD = ["old", "classic", "vintage", "retro", "ancient"]
    CATEGORY_BLOCKBUSTER = ["blockbuster", "commercial", "success"]
    CATEGORY_COLLECTION = ["collection", "franchise"]
    CATEGORY_POPULAR = ["popular", "trending"]
    CATEGORY_HOLIDAY = ["holiday", "seasonal", "christmas", "halloween"]

    def calculate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> float:
        """Calculate contextual bonus score."""
        mfp_policy = self.get_mfp_policy(profile, block)
        score, _, _, _ = self._calculate_with_bonuses(
            content, content_meta, profile, block, context, mfp_policy
        )
        return score

    def _get_scaled_bonus(self, base_multiplier: float, mfp_policy: MFPPolicyConfig) -> float:
        """Get a scaled bonus based on MFP preferred_matched_bonus.

        Args:
            base_multiplier: Multiplier relative to standard bonus (1.0 = full bonus, 0.5 = half)
            mfp_policy: M/F/P policy with preferred_matched_bonus

        Returns:
            Scaled bonus points
        """
        return mfp_policy.preferred_matched_bonus * base_multiplier

    def _get_scaled_penalty(self, base_multiplier: float, mfp_policy: MFPPolicyConfig) -> float:
        """Get a scaled penalty based on MFP mandatory_missed_penalty.

        Args:
            base_multiplier: Multiplier relative to standard penalty (1.0 = full, 0.5 = half)
            mfp_policy: M/F/P policy with mandatory_missed_penalty

        Returns:
            Scaled penalty points (negative)
        """
        return mfp_policy.mandatory_missed_penalty * base_multiplier

    def _calculate_with_bonuses(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
        mfp_policy: MFPPolicyConfig | None = None,
    ) -> tuple[float, list[str], list[str], RuleViolation | None]:
        """
        Calculate contextual bonus score with applied bonus tracking using M/F/P policy.

        Returns:
            Tuple of (score, bonuses_applied, bonus_categories_earned, rule_violation)
        """
        policy = mfp_policy or DEFAULT_MFP_POLICY
        score = 50.0  # Base score (neutral)
        bonuses_applied: list[str] = []
        bonus_categories_earned: list[str] = []

        if not content_meta:
            return score, bonuses_applied, bonus_categories_earned, None

        # Get bonus_rules from block criteria if available
        bonus_rules = None
        if block:
            bonus_rules = block.get("criteria", {}).get("bonus_rules")

        forbidden_categories = (
            [v.lower() for v in (bonus_rules.get("forbidden_values") or [])] if bonus_rules else []
        )
        preferred_categories = (
            [v.lower() for v in (bonus_rules.get("preferred_values") or [])] if bonus_rules else []
        )
        mandatory_categories = (
            [v.lower() for v in (bonus_rules.get("mandatory_values") or [])] if bonus_rules else []
        )

        # Get penalties/bonuses from rules or MFP policy
        forbidden_penalty = (
            bonus_rules.get("forbidden_penalty", policy.forbidden_detected_penalty)
            if bonus_rules
            else policy.forbidden_detected_penalty
        )
        preferred_bonus = (
            bonus_rules.get("preferred_bonus", policy.preferred_matched_bonus)
            if bonus_rules
            else policy.preferred_matched_bonus
        )

        # Helper to check category match
        def is_forbidden(categories: list[str]) -> bool:
            return any(c in forbidden_categories for c in categories)

        def is_preferred(categories: list[str]) -> bool:
            return any(c in preferred_categories for c in categories)

        def is_mandatory(categories: list[str]) -> bool:
            return any(c in mandatory_categories for c in categories)

        # Track forbidden categories detected for final violation reporting
        forbidden_detected: list[str] = []

        current_year = datetime.now().year

        # ========== RELEASE YEAR BONUS ==========
        # Categories: "recent", "recency" for new / "old", "classic", "vintage" for old
        content_year = content.get("year")
        if content_year:
            age = current_year - content_year
            recent_forbidden = is_forbidden(self.CATEGORY_RECENT)
            recent_preferred = is_preferred(self.CATEGORY_RECENT)
            old_forbidden = is_forbidden(self.CATEGORY_OLD)
            old_preferred = is_preferred(self.CATEGORY_OLD)

            if age <= 2:
                if recent_forbidden:
                    # Recent content is forbidden - mark for penalty
                    forbidden_detected.extend(
                        [c for c in self.CATEGORY_RECENT if c in forbidden_categories]
                    )
                else:
                    # Very recent release: apply preferred_bonus if preferred, otherwise base bonus
                    if recent_preferred:
                        bonus = preferred_bonus
                    else:
                        bonus = self._get_scaled_bonus(0.5, policy)  # Base bonus for recent
                    score += bonus
                    bonuses_applied.append(f"Sortie récente ({content_year}): +{bonus:.0f}")
                    bonus_categories_earned.extend(self.CATEGORY_RECENT)
            elif age <= 5:
                if recent_forbidden:
                    forbidden_detected.extend(
                        [c for c in self.CATEGORY_RECENT if c in forbidden_categories]
                    )
                else:
                    # Fairly recent: apply full preferred_bonus if preferred, otherwise smaller base bonus
                    if recent_preferred:
                        bonus = preferred_bonus  # Full bonus when preferred
                    else:
                        bonus = self._get_scaled_bonus(0.25, policy)  # Smaller base bonus
                    score += bonus
                    bonuses_applied.append(f"Assez récent ({content_year}): +{bonus:.0f}")
                    bonus_categories_earned.extend(self.CATEGORY_RECENT)
            elif age > 20:
                if old_forbidden:
                    # Old content is forbidden - mark for penalty
                    forbidden_detected.extend(
                        [c for c in self.CATEGORY_OLD if c in forbidden_categories]
                    )
                elif old_preferred:
                    # Old content is preferred - apply full preferred_bonus
                    bonus = preferred_bonus
                    score += bonus
                    bonuses_applied.append(f"Classique ({content_year}): +{bonus:.0f}")
                    bonus_categories_earned.extend(self.CATEGORY_OLD)
                # If neither preferred nor forbidden: neutral (no adjustment)

        # ========== BOX OFFICE SUCCESS BONUS ==========
        # Category: "blockbuster"
        revenue = content_meta.get("revenue") or 0
        budget = content_meta.get("budget") or 0
        blockbuster_forbidden = is_forbidden(self.CATEGORY_BLOCKBUSTER)
        blockbuster_preferred = is_preferred(self.CATEGORY_BLOCKBUSTER)

        if budget and revenue and not blockbuster_forbidden:
            if revenue > budget * 3:
                # Mega blockbuster: full preferred_bonus if preferred, otherwise base
                if blockbuster_preferred:
                    bonus = preferred_bonus
                else:
                    bonus = self._get_scaled_bonus(0.4, policy)  # Base bonus
                score += bonus
                bonuses_applied.append(f"Blockbuster (3x+ ROI): +{bonus:.0f}")
                bonus_categories_earned.extend(self.CATEGORY_BLOCKBUSTER)
            elif revenue > budget * 2:
                # Big success: full preferred_bonus if preferred
                if blockbuster_preferred:
                    bonus = preferred_bonus
                else:
                    bonus = self._get_scaled_bonus(0.25, policy)
                score += bonus
                bonuses_applied.append(f"Succès commercial (2x+ ROI): +{bonus:.0f}")
                bonus_categories_earned.extend(self.CATEGORY_BLOCKBUSTER)
            elif revenue > budget:
                # Profitable: full preferred_bonus if preferred (still profitable)
                if blockbuster_preferred:
                    bonus = preferred_bonus
                else:
                    bonus = self._get_scaled_bonus(0.15, policy)
                score += bonus
                bonuses_applied.append(f"Rentable: +{bonus:.0f}")
                bonus_categories_earned.extend(self.CATEGORY_BLOCKBUSTER)

        # ========== COLLECTION MEMBERSHIP BONUS ==========
        # Categories: "collection", "franchise"
        collections = content_meta.get("collections") or []
        collection_forbidden = is_forbidden(self.CATEGORY_COLLECTION)
        collection_preferred = is_preferred(self.CATEGORY_COLLECTION)

        if collections and not collection_forbidden:
            if collection_preferred:
                # Full preferred_bonus for being in a collection when preferred
                bonus = preferred_bonus
            else:
                # Base bonus: scaled by number of collections
                bonus = min(
                    self._get_scaled_bonus(0.3, policy),
                    len(collections) * self._get_scaled_bonus(0.15, policy),
                )
            score += bonus
            coll_names = ", ".join(collections[:2])
            bonuses_applied.append(f"Collection ({coll_names}): +{bonus:.0f}")
            bonus_categories_earned.extend(self.CATEGORY_COLLECTION)

        # ========== POPULARITY BONUS ==========
        # Category: "popular"
        vote_count = content_meta.get("vote_count") or 0
        popular_forbidden = is_forbidden(self.CATEGORY_POPULAR)
        popular_preferred = is_preferred(self.CATEGORY_POPULAR)

        if not popular_forbidden:
            if vote_count > 10000:
                # Very popular: full preferred_bonus if preferred
                if popular_preferred:
                    bonus = preferred_bonus
                else:
                    bonus = self._get_scaled_bonus(0.3, policy)  # Base bonus
                score += bonus
                bonuses_applied.append(f"Très populaire ({vote_count} votes): +{bonus:.0f}")
                bonus_categories_earned.extend(self.CATEGORY_POPULAR)
            elif vote_count > 5000:
                # Popular: full preferred_bonus if preferred
                if popular_preferred:
                    bonus = preferred_bonus
                else:
                    bonus = self._get_scaled_bonus(0.15, policy)
                score += bonus
                bonuses_applied.append(f"Populaire ({vote_count} votes): +{bonus:.0f}")
                bonus_categories_earned.extend(self.CATEGORY_POPULAR)

        # ========== SEASONAL/HOLIDAY BONUS ==========
        # Categories: "holiday", "seasonal"
        bonuses_config = profile.get("strategies", {}).get("bonuses", {})
        holiday_forbidden = is_forbidden(self.CATEGORY_HOLIDAY)
        holiday_preferred = is_preferred(self.CATEGORY_HOLIDAY)

        if bonuses_config.get("holiday_bonus", False) and not holiday_forbidden:
            content_keywords = [k.lower() for k in content_meta.get("keywords", [])]
            holiday_keywords = ["christmas", "holiday", "thanksgiving", "halloween", "noel", "noël"]

            if any(k in kw for kw in content_keywords for k in holiday_keywords):
                current_month = datetime.now().month
                if current_month in [10, 11, 12]:
                    if holiday_preferred:
                        bonus = preferred_bonus
                    else:
                        bonus = self._get_scaled_bonus(0.4, policy)  # Base holiday bonus
                    score += bonus
                    bonuses_applied.append(f"Contenu de saison: +{bonus:.0f}")
                    bonus_categories_earned.extend(self.CATEGORY_HOLIDAY)

        # ========== ENHANCED CRITERIA BONUSES ==========
        enhanced = profile.get("enhanced_criteria", {})

        # Keywords safety bonus (uses profile config, not MFP)
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

        # Collections/Franchises bonus (enhanced - uses profile config)
        collections_config = enhanced.get("collections_franchises", {})
        if collections_config.get("enabled", False):
            content_collections = [c.lower() for c in (content_meta.get("collections") or [])]
            preferred_collections = [
                c.lower() for c in collections_config.get("preferred_collections", [])
            ]

            for coll in content_collections:
                if any(pref in coll or coll in pref for pref in preferred_collections):
                    bonus = collections_config.get("collection_bonus_points", 10)
                    score += bonus
                    bonuses_applied.append(f"Collection préférée: +{bonus}")
                    break

        # Cast/Crew bonus (uses profile config)
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

        # Educational value bonus (uses profile config)
        edu_config = enhanced.get("educational_value", {})
        if edu_config.get("enabled", False):
            content_keywords = [k.lower() for k in content_meta.get("keywords", [])]
            edu_keywords = [k.lower() for k in edu_config.get("educational_keywords", [])]

            if any(edu in kw for kw in content_keywords for edu in edu_keywords):
                bonus = edu_config.get("bonus_points", 5)
                score += bonus
                bonuses_applied.append(f"Contenu éducatif: +{bonus}")

        # ========== M/F/P RULE CHECKING ==========
        rule_violation = None

        # Check forbidden categories (highest priority)
        # Use forbidden_detected list built during category evaluation
        if forbidden_detected:
            score += forbidden_penalty
            bonuses_applied.append(
                f"Catégorie interdite ({', '.join(forbidden_detected)}): {forbidden_penalty:.0f}"
            )
            rule_violation = RuleViolation("forbidden", forbidden_detected, forbidden_penalty)

        # Check mandatory categories (if no forbidden violation)
        if not rule_violation and mandatory_categories:
            earned_lower = [c.lower() for c in bonus_categories_earned]
            missing_mandatory = [m for m in mandatory_categories if m not in earned_lower]
            if missing_mandatory:
                penalty = (
                    bonus_rules.get("mandatory_penalty", policy.mandatory_missed_penalty)
                    if bonus_rules
                    else policy.mandatory_missed_penalty
                )
                score += penalty
                bonuses_applied.append(
                    f"Bonus requis manquant ({', '.join(missing_mandatory)}): {penalty:.0f}"
                )
                rule_violation = RuleViolation("mandatory", missing_mandatory, penalty)

        # Check preferred categories match (for reporting, bonus already applied above)
        if not rule_violation and preferred_categories:
            earned_lower = [c.lower() for c in bonus_categories_earned]
            matched_preferred = [p for p in preferred_categories if p in earned_lower]
            if matched_preferred:
                bonus = (
                    bonus_rules.get("preferred_bonus", policy.preferred_matched_bonus)
                    if bonus_rules
                    else policy.preferred_matched_bonus
                )
                rule_violation = RuleViolation("preferred", matched_preferred, bonus)

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
        mfp_policy = self.get_mfp_policy(profile, block)
        score, bonuses, bonus_categories_earned, rule_violation = self._calculate_with_bonuses(
            content, content_meta, profile, block, context, mfp_policy
        )
        weight = self.get_weight(profile)
        multiplier = self.get_multiplier(profile, block)
        weighted_score = score * weight / 100.0

        return CriterionResult(
            name=self.name,
            score=score,
            weight=weight,
            weighted_score=weighted_score,
            multiplier=multiplier,
            multiplied_weighted_score=weighted_score * multiplier,
            details={
                "bonuses_applied": bonuses,
                "bonus_categories_earned": bonus_categories_earned,
                "mfp_policy": {
                    "preferred_matched_bonus": mfp_policy.preferred_matched_bonus,
                    "mandatory_missed_penalty": mfp_policy.mandatory_missed_penalty,
                    "forbidden_detected_penalty": mfp_policy.forbidden_detected_penalty,
                },
            },
            rule_violation=rule_violation,
        )
