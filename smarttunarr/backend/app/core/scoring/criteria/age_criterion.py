"""AgeCriterion - Age rating compliance scoring."""

import re
from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, RuleViolation, ScoringContext


class AgeCriterion(BaseCriterion):
    """Score based on age rating compliance."""

    name = "age"
    weight_key = "age"
    default_weight = 20.0

    # Age rating hierarchy (lower index = more restrictive)
    # Level 0: All ages (G, U, TP, Tous publics)
    # Level 1: Some guidance (PG, 10+)
    # Level 2: Teen (PG-13, 12+, 12)
    # Level 3: Restricted (R, 16+, 15, 16)
    # Level 4: Adults only (NC-17, 18+, 18)
    AGE_RATINGS = {
        # US/MPAA ratings
        "g": 0,
        "pg": 1,
        "pg-13": 2,
        "r": 3,
        "nc-17": 4,
        # US TV ratings
        "tv-g": 0,
        "tv-y": 0,
        "tv-y7": 0,
        "tv-pg": 1,
        "tv-14": 2,
        "tv-ma": 3,
        # French ratings (CSA)
        "tp": 0,
        "tous publics": 0,
        "u": 0,
        "-10": 1,
        "+10": 1,
        "10+": 1,
        "10": 1,
        "-12": 2,
        "+12": 2,
        "12+": 2,
        "12": 2,
        "-16": 3,
        "+16": 3,
        "16+": 3,
        "16": 3,
        "-18": 4,
        "+18": 4,
        "18+": 4,
        "18": 4,
        # UK ratings (BBFC)
        "uc": 0,
        "12a": 2,
        "15": 3,
        # German ratings (FSK)
        "fsk 0": 0,
        "fsk 6": 1,
        "fsk 12": 2,
        "fsk 16": 3,
        "fsk 18": 4,
        "fsk0": 0,
        "fsk6": 1,
        "fsk12": 2,
        "fsk16": 3,
        "fsk18": 4,
        # Common variations
        "nr": 2,  # Not Rated - default to teen
        "unrated": 2,
        "not rated": 2,
    }

    @classmethod
    def normalize_rating(cls, rating: str) -> str:
        """
        Normalize a rating string to match AGE_RATINGS keys.

        Handles formats like:
        - "fr/U" -> "u"
        - "us/PG-13" -> "pg-13"
        - "Tous publics" -> "tous publics"
        - "+16" -> "+16"
        """
        if not rating:
            return ""

        rating = rating.strip().lower()

        # Handle country-prefixed formats (e.g., "fr/u", "us/pg-13")
        if "/" in rating:
            parts = rating.split("/")
            # Take the last part (the actual rating)
            rating = parts[-1].strip()

        # Handle formats with ":" like "mpaa:pg-13"
        if ":" in rating:
            parts = rating.split(":")
            rating = parts[-1].strip()

        return rating

    @classmethod
    def get_rating_level(cls, rating: str) -> int:
        """
        Get the restriction level for a rating.

        Returns 2 (PG-13 equivalent) for unknown ratings as a safe middle ground.
        """
        normalized = cls.normalize_rating(rating)

        if normalized in cls.AGE_RATINGS:
            return cls.AGE_RATINGS[normalized]

        # Try to extract numeric age (e.g., "rated 16" -> 16)
        match = re.search(r'\b(\d{1,2})\b', normalized)
        if match:
            age = int(match.group(1))
            if age <= 6:
                return 0
            elif age <= 10:
                return 1
            elif age <= 13:
                return 2
            elif age <= 16:
                return 3
            else:
                return 4

        # Default to PG-13 equivalent for unknown
        return 2

    def calculate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> float:
        """
        Calculate age rating compliance score.

        - 100: Rating matches or below block's maximum
        - 0: Rating exceeds block's maximum
        """
        if not content_meta:
            return 75.0  # Neutral if no metadata

        content_rating = content_meta.get("age_rating") or ""
        if not content_rating:
            return 75.0  # Neutral if no rating

        # Get max rating from block or profile
        if block:
            block_criteria = block.get("criteria", {})
            max_rating = block_criteria.get("max_age_rating") or ""
        else:
            criteria = profile.get("mandatory_forbidden_criteria", {})
            max_rating = criteria.get("max_age_rating") or ""

        if not max_rating:
            return 80.0  # No restriction, acceptable

        # Get rating levels using normalized ratings
        content_level = self.get_rating_level(content_rating)
        max_level = self.get_rating_level(max_rating)

        if content_level <= max_level:
            # Within allowed range
            if content_level == max_level:
                return 90.0  # Exactly at limit
            return 100.0  # Below limit
        else:
            # Exceeds limit - major violation
            return 0.0

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

        rule_violation = None

        # Check if content exceeds max_age_rating (creates a forbidden violation)
        if content_meta:
            content_rating = content_meta.get("age_rating") or ""
            if content_rating:
                # Get max rating from block or profile
                max_rating = None
                if block:
                    block_criteria = block.get("criteria", {})
                    max_rating = block_criteria.get("max_age_rating") or ""
                if not max_rating:
                    criteria = profile.get("mandatory_forbidden_criteria", {})
                    max_rating = criteria.get("max_age_rating") or ""

                if max_rating:
                    content_level = self.get_rating_level(content_rating)
                    max_level = self.get_rating_level(max_rating)

                    if content_level > max_level:
                        # Content exceeds max rating - this is a forbidden violation
                        rule_violation = RuleViolation(
                            rule_type="forbidden",
                            values=[content_rating],
                            penalty_or_bonus=-200.0,
                        )
                        score = 0.0  # Ensure score is 0

        # Check for per-criterion rules (additional M/F/P rules)
        # For age, rules use age rating values: "G", "PG", "PG-13", "R", "NC-17", "TV-G", etc.
        # Rules can also use French ratings: "TP", "Tous publics", "+12", "+16", "+18"
        if block and content_meta and not rule_violation:
            block_criteria = block.get("criteria", {})
            age_rules = block_criteria.get("age_rules")
            if age_rules:
                content_rating = content_meta.get("age_rating", "")
                # Normalize the content rating for comparison
                normalized_rating = self.normalize_rating(content_rating)
                # Also include the original rating for flexible matching
                content_values = []
                if content_rating:
                    content_values.append(content_rating)
                if normalized_rating and normalized_rating != content_rating.lower():
                    content_values.append(normalized_rating)
                # Add the rating level as a string for level-based rules
                if content_values:
                    level = self.get_rating_level(content_rating)
                    level_names = {0: "G", 1: "PG", 2: "PG-13", 3: "R", 4: "NC-17"}
                    content_values.append(level_names.get(level, "PG-13"))

                adjustment, rule_violation = self.check_rules(content_values, age_rules)
                score += adjustment

        score = max(0.0, min(100.0, score))
        return CriterionResult(
            name=self.name,
            score=score,
            weight=weight,
            weighted_score=score * weight / 100.0,
            rule_violation=rule_violation,
        )
