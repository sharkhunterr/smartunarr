"""RatingCriterion - TMDB rating thresholds scoring."""

from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, ScoringContext


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
            min_rating = block_criteria.get("min_tmdb_rating", 0.0)
            preferred_rating = block_criteria.get("preferred_tmdb_rating", 7.0)
            min_votes = block_criteria.get("min_vote_count", 0)
        else:
            criteria = profile.get("mandatory_forbidden_criteria", {})
            min_rating = criteria.get("min_tmdb_rating", 0.0)
            preferred_rating = criteria.get("preferred_tmdb_rating", 7.0)
            min_votes = criteria.get("min_vote_count", 0)

        # Check vote count threshold
        if min_votes > 0 and vote_count < min_votes:
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

        # Check for per-criterion rules
        # For rating, rules use categories: "excellent", "good", "average", "poor"
        rule_violation = None
        if block and content_meta:
            block_criteria = block.get("criteria", {})
            rating_rules = block_criteria.get("rating_rules")
            if rating_rules:
                tmdb_rating = content_meta.get("tmdb_rating")
                rating_categories = []
                if tmdb_rating is not None:
                    try:
                        tmdb_rating = float(tmdb_rating)
                    except (TypeError, ValueError):
                        tmdb_rating = None
                if tmdb_rating is not None:
                    if tmdb_rating >= 8.0:
                        rating_categories.append("excellent")
                    elif tmdb_rating >= 7.0:
                        rating_categories.append("good")
                    elif tmdb_rating >= 5.0:
                        rating_categories.append("average")
                    else:
                        rating_categories.append("poor")
                    # Also add rounded rating for precise matching
                    rating_categories.append(f"{tmdb_rating:.1f}")
                adjustment, rule_violation = self.check_rules(rating_categories, rating_rules)
                score += adjustment

        score = max(0.0, min(100.0, score))
        return CriterionResult(
            name=self.name,
            score=score,
            weight=weight,
            weighted_score=score * weight / 100.0,
            rule_violation=rule_violation,
        )
