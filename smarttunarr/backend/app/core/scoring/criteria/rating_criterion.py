"""RatingCriterion - TMDB rating thresholds scoring."""

from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, RuleViolation, ScoringContext


class RatingCriterion(BaseCriterion):
    """Score based on TMDB rating thresholds."""

    name = "rating"
    weight_key = "rating"
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
        Calculate TMDB rating score.

        - 100: Rating above preferred threshold
        - 50: Rating above minimum threshold
        - Proportional score based on rating value
        """
        if not content_meta:
            return 50.0  # Neutral if no metadata

        tmdb_rating = content_meta.get("tmdb_rating")
        if tmdb_rating is None:
            return 50.0  # Neutral if no rating

        # Ensure tmdb_rating is a float (Tunarr may send string)
        try:
            tmdb_rating = float(tmdb_rating)
        except (TypeError, ValueError):
            return 50.0  # Neutral if invalid rating

        vote_count = content_meta.get("vote_count") or 0

        # Get thresholds from block or profile
        if block:
            block_criteria = block.get("criteria", {})
            min_rating = block_criteria.get("min_tmdb_rating") or 0.0
            preferred_rating = block_criteria.get("preferred_tmdb_rating") or 7.0
            min_votes = block_criteria.get("min_vote_count") or 0
        else:
            criteria = profile.get("mandatory_forbidden_criteria", {})
            min_rating = criteria.get("min_tmdb_rating") or 0.0
            preferred_rating = criteria.get("preferred_tmdb_rating") or 7.0
            min_votes = criteria.get("min_vote_count") or 0

        # Check vote count threshold
        if min_votes and min_votes > 0 and vote_count < min_votes:
            # Reduce confidence in rating
            confidence_penalty = min(30.0, (min_votes - vote_count) / min_votes * 30)
        else:
            confidence_penalty = 0.0

        # Check rating thresholds
        if tmdb_rating < min_rating:
            # Below minimum - low score
            ratio = tmdb_rating / max(min_rating, 1.0)
            return max(0.0, ratio * 40.0 - confidence_penalty)

        if tmdb_rating >= preferred_rating:
            # Above preferred - excellent
            return max(70.0, 100.0 - confidence_penalty)

        # Between min and preferred - proportional
        range_size = preferred_rating - min_rating
        if range_size > 0:
            position = (tmdb_rating - min_rating) / range_size
            return max(0.0, 50.0 + (position * 40.0) - confidence_penalty)

        return 60.0 - confidence_penalty

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
        # For rating, rules use categories: "excellent", "good", "average", "poor"
        # Logic: content has ONE category, mandatory means "must be one of these"
        rule_violation = None
        if block and content_meta:
            block_criteria = block.get("criteria", {})
            rating_rules = block_criteria.get("rating_rules")
            if rating_rules:
                tmdb_rating = content_meta.get("tmdb_rating")
                rating_category = None
                if tmdb_rating is not None:
                    try:
                        tmdb_rating = float(tmdb_rating)
                    except (TypeError, ValueError):
                        tmdb_rating = None
                if tmdb_rating is not None:
                    if tmdb_rating >= 8.0:
                        rating_category = "excellent"
                    elif tmdb_rating >= 7.0:
                        rating_category = "good"
                    elif tmdb_rating >= 5.0:
                        rating_category = "average"
                    else:
                        rating_category = "poor"

                if rating_category:
                    # Custom M/F/P logic for rating (single category vs list of allowed/forbidden)
                    forbidden = [v.lower() for v in (rating_rules.get("forbidden_values") or [])]
                    mandatory = [v.lower() for v in (rating_rules.get("mandatory_values") or [])]
                    preferred = [v.lower() for v in (rating_rules.get("preferred_values") or [])]

                    # Check forbidden first (highest priority)
                    if rating_category.lower() in forbidden:
                        penalty = rating_rules.get("forbidden_penalty", mfp_policy.forbidden_detected_penalty)
                        rule_violation = RuleViolation("forbidden", [rating_category], penalty)
                        score += penalty
                    # Check mandatory (content category must be IN the mandatory list)
                    elif mandatory and rating_category.lower() not in mandatory:
                        penalty = rating_rules.get("mandatory_penalty", mfp_policy.mandatory_missed_penalty)
                        rule_violation = RuleViolation("mandatory", mandatory, penalty)
                        score += penalty
                    # Check preferred (bonus if in preferred list)
                    elif rating_category.lower() in preferred:
                        bonus = rating_rules.get("preferred_bonus", mfp_policy.preferred_matched_bonus)
                        rule_violation = RuleViolation("preferred", [rating_category], bonus)
                        score += bonus
                    # If mandatory is defined and category matches, give bonus
                    elif mandatory and rating_category.lower() in mandatory:
                        bonus = mfp_policy.mandatory_matched_bonus
                        rule_violation = RuleViolation("mandatory", [rating_category], bonus)
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
