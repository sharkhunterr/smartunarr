"""Profile v4 to v6 compatibility layer and migration."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class ProfileMigration:
    """Handles migration between profile versions."""

    CURRENT_VERSION = "6.0"

    @classmethod
    def migrate(cls, profile_data: dict[str, Any]) -> dict[str, Any]:
        """
        Migrate profile to current version.

        Args:
            profile_data: Profile data in any supported version

        Returns:
            Profile data migrated to current version
        """
        version = profile_data.get("version", "4.0")

        if version.startswith("6."):
            return profile_data  # Already v6

        if version.startswith("5."):
            return cls._migrate_v5_to_v6(profile_data)

        if version.startswith("4."):
            v5_data = cls._migrate_v4_to_v5(profile_data)
            return cls._migrate_v5_to_v6(v5_data)

        raise ValueError(f"Unsupported profile version: {version}")

    @classmethod
    def _migrate_v5_to_v6(cls, profile_data: dict[str, Any]) -> dict[str, Any]:
        """
        Migrate v5 profile to v6 format.

        Changes from v5 to v6:
        - Added enhanced_criteria section (keywords, collections, cast, temporal, etc.)
        - Added preferred section to mandatory_forbidden_criteria
        - Added new scoring_weights (keywords, collections, cast, temporal)
        - Added description field
        """
        logger.info(f"Migrating profile '{profile_data.get('name')}' from v5 to v6")

        # Copy existing data
        migrated = dict(profile_data)
        migrated["version"] = cls.CURRENT_VERSION

        # Add description if not present
        if "description" not in migrated:
            migrated["description"] = f"Profile: {migrated.get('name', 'Unknown')}"

        # Ensure mandatory_forbidden_criteria has preferred section
        mf_criteria = migrated.get("mandatory_forbidden_criteria", {})
        if "preferred" not in mf_criteria:
            mf_criteria["preferred"] = {
                "genres": [],
                "keywords": [],
                "collections": [],
                "studios": [],
                "actors": [],
                "directors": [],
                "countries": [],
                "languages": [],
            }
        migrated["mandatory_forbidden_criteria"] = mf_criteria

        # Add enhanced_criteria with defaults if not present
        if "enhanced_criteria" not in migrated:
            migrated["enhanced_criteria"] = cls._get_default_enhanced_criteria()

        # Add new scoring weights if not present
        weights = migrated.get("scoring_weights", {})
        if "keywords" not in weights:
            weights["keywords"] = 5
        if "collections" not in weights:
            weights["collections"] = 5
        if "cast" not in weights:
            weights["cast"] = 5
        if "temporal" not in weights:
            weights["temporal"] = 5
        migrated["scoring_weights"] = weights

        # Add new strategy options if not present
        strategies = migrated.get("strategies", {})
        if "avoid_repeats_days" not in strategies:
            strategies["avoid_repeats_days"] = 7
        bonuses = strategies.get("bonuses", {})
        if "popular_content_bonus" not in bonuses:
            bonuses["popular_content_bonus"] = False
        strategies["bonuses"] = bonuses
        migrated["strategies"] = strategies

        return migrated

    @classmethod
    def _get_default_enhanced_criteria(cls) -> dict[str, Any]:
        """Get default enhanced_criteria for v6."""
        return {
            "keywords_safety": {
                "enabled": False,
                "safe_keywords": [],
                "dangerous_keywords": [],
                "safe_bonus_points": 5,
                "dangerous_penalty_points": -100,
            },
            "collections_franchises": {
                "enabled": False,
                "preferred_collections": [],
                "preferred_franchises": [],
                "forbidden_collections": [],
                "collection_bonus_points": 10,
                "franchise_bonus_points": 5,
            },
            "cast_crew": {
                "enabled": False,
                "preferred_actors": [],
                "forbidden_actors": [],
                "preferred_directors": [],
                "min_actor_popularity": 10,
                "popular_actor_bonus": 3,
            },
            "temporal_intelligence": {
                "enabled": False,
                "recency_bonuses": {
                    "enabled": False,
                    "very_recent_days": 30,
                    "very_recent_bonus": 8,
                    "recent_months": 6,
                    "recent_bonus": 6,
                    "this_year_bonus": 4,
                    "max_age_years": None,
                    "old_content_penalty": 0,
                },
                "seasonal_bonuses": {
                    "enabled": False,
                    "christmas": {
                        "months": [11, 12],
                        "keywords": [],
                        "genres": [],
                        "bonus_points": 5,
                    },
                    "halloween": {"months": [10], "keywords": [], "genres": [], "bonus_points": 5},
                    "summer": {
                        "months": [6, 7, 8],
                        "keywords": [],
                        "genres": [],
                        "bonus_points": 3,
                    },
                },
                "prime_time_bonus": {
                    "enabled": False,
                    "prime_hours": ["20:00", "21:00", "22:00"],
                    "bonus_points": 10,
                },
            },
            "cultural_linguistic": {
                "enabled": False,
                "preferred_countries": [],
                "preferred_languages": [],
                "require_french_audio": False,
                "country_bonus_points": 5,
                "language_bonus_points": 5,
            },
            "quality_indicators": {
                "enabled": False,
                "vote_reliability": {
                    "enabled": False,
                    "excellent_votes": 10000,
                    "good_votes": 5000,
                    "acceptable_votes": 1000,
                    "minimum_votes": 100,
                },
                "multi_source_rating": {
                    "enabled": False,
                    "sources": ["tmdb"],
                    "aggregation_method": "average",
                },
                "technical_quality": {
                    "enabled": False,
                    "prefer_4k": False,
                    "prefer_hdr": False,
                    "quality_bonus_points": 3,
                },
            },
            "educational_value": {
                "enabled": False,
                "educational_keywords": [],
                "bonus_points": 5,
            },
        }

    @classmethod
    def _migrate_v4_to_v5(cls, profile_data: dict[str, Any]) -> dict[str, Any]:
        """
        Migrate v4 profile to v5 format.

        Changes from v4 to v5:
        - time_blocks criteria structure changed
        - mandatory_forbidden_criteria renamed and restructured
        - strategies section added
        - scoring_weights renamed from weights
        """
        logger.info(f"Migrating profile '{profile_data.get('name')}' from v4 to v5")

        migrated = {
            "name": profile_data.get("name", "Migrated Profile"),
            "version": cls.CURRENT_VERSION,
            "libraries": cls._migrate_libraries(profile_data.get("libraries", [])),
            "time_blocks": cls._migrate_time_blocks(profile_data.get("time_blocks", [])),
            "mandatory_forbidden_criteria": cls._migrate_criteria(profile_data),
            "strategies": cls._migrate_strategies(profile_data),
            "scoring_weights": cls._migrate_weights(profile_data),
            "default_iterations": profile_data.get(
                "iterations", profile_data.get("default_iterations", 10)
            ),
            "default_randomness": profile_data.get(
                "randomness", profile_data.get("default_randomness", 0.3)
            ),
            "labels": profile_data.get("labels", profile_data.get("tags", [])),
        }

        return migrated

    @classmethod
    def _migrate_libraries(cls, libraries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Migrate library configurations."""
        migrated = []
        for lib in libraries:
            migrated.append(
                {
                    "id": str(lib.get("id", lib.get("library_id", ""))),
                    "name": lib.get("name", lib.get("library_name", "Unknown")),
                    "type": lib.get("type", lib.get("content_type")),
                    "weight": lib.get("weight", lib.get("selection_weight", 50)),
                }
            )
        return migrated

    @classmethod
    def _migrate_time_blocks(cls, time_blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Migrate time block configurations."""
        migrated = []
        for block in time_blocks:
            new_block = {
                "name": block.get("name", "Unknown Block"),
                "start_time": block.get("start_time", block.get("start", "00:00")),
                "end_time": block.get("end_time", block.get("end", "23:59")),
                "criteria": {},
            }

            # Migrate block criteria
            criteria = block.get("criteria", block.get("rules", {}))
            if criteria:
                new_block["criteria"] = {
                    "preferred_types": criteria.get("preferred_types", criteria.get("types", [])),
                    "allowed_types": criteria.get("allowed_types", []),
                    "excluded_types": criteria.get(
                        "excluded_types", criteria.get("exclude_types", [])
                    ),
                    "preferred_genres": criteria.get(
                        "preferred_genres", criteria.get("genres", [])
                    ),
                    "allowed_genres": criteria.get("allowed_genres", []),
                    "forbidden_genres": criteria.get(
                        "forbidden_genres", criteria.get("exclude_genres", [])
                    ),
                    "min_duration_min": criteria.get(
                        "min_duration_min", criteria.get("min_duration")
                    ),
                    "max_duration_min": criteria.get(
                        "max_duration_min", criteria.get("max_duration")
                    ),
                    "max_age_rating": criteria.get("max_age_rating", criteria.get("max_rating")),
                    "min_tmdb_rating": criteria.get("min_tmdb_rating", criteria.get("min_score")),
                    "preferred_tmdb_rating": criteria.get(
                        "preferred_tmdb_rating", criteria.get("preferred_score")
                    ),
                }

            migrated.append(new_block)

        return migrated

    @classmethod
    def _migrate_criteria(cls, profile_data: dict[str, Any]) -> dict[str, Any]:
        """Migrate mandatory/forbidden criteria."""
        # v4 had separate mandatory and forbidden sections
        mandatory = profile_data.get("mandatory", profile_data.get("required", {}))
        forbidden = profile_data.get("forbidden", profile_data.get("excluded", {}))

        # Also check for combined criteria in v4
        combined = profile_data.get("mandatory_forbidden_criteria", {})
        if combined:
            mandatory = combined.get("mandatory", mandatory)
            forbidden = combined.get("forbidden", forbidden)

        return {
            "mandatory": {
                "content_ids": mandatory.get("content_ids", mandatory.get("required_content", [])),
                "min_duration_min": mandatory.get(
                    "min_duration_min", mandatory.get("min_duration")
                ),
                "min_tmdb_rating": mandatory.get("min_tmdb_rating", mandatory.get("min_rating")),
                "required_genres": mandatory.get("required_genres", mandatory.get("genres", [])),
            },
            "forbidden": {
                "content_ids": forbidden.get("content_ids", forbidden.get("excluded_content", [])),
                "types": forbidden.get("types", forbidden.get("excluded_types", [])),
                "keywords": forbidden.get("keywords", forbidden.get("excluded_keywords", [])),
                "genres": forbidden.get("genres", forbidden.get("excluded_genres", [])),
            },
        }

    @classmethod
    def _migrate_strategies(cls, profile_data: dict[str, Any]) -> dict[str, Any]:
        """Migrate or create strategies section."""
        strategies = profile_data.get("strategies", profile_data.get("options", {}))

        return {
            "maintain_sequence": strategies.get(
                "maintain_sequence", strategies.get("keep_order", False)
            ),
            "maximize_variety": strategies.get(
                "maximize_variety", strategies.get("variety", False)
            ),
            "marathon_mode": strategies.get("marathon_mode", strategies.get("marathon", False)),
            "filler_insertion": {
                "enabled": strategies.get("filler_insertion", {}).get(
                    "enabled", strategies.get("use_filler", False)
                ),
                "types": strategies.get("filler_insertion", {}).get(
                    "types", strategies.get("filler_types", ["trailer"])
                ),
                "max_duration_min": strategies.get("filler_insertion", {}).get("max_duration_min"),
            },
            "bonuses": {
                "holiday_bonus": strategies.get("bonuses", {}).get(
                    "holiday_bonus", strategies.get("holiday_mode", False)
                ),
                "recent_release_bonus": strategies.get("bonuses", {}).get(
                    "recent_release_bonus", False
                ),
            },
        }

    @classmethod
    def _migrate_weights(cls, profile_data: dict[str, Any]) -> dict[str, float]:
        """Migrate scoring weights."""
        weights = profile_data.get(
            "scoring_weights", profile_data.get("weights", profile_data.get("scoring", {}))
        )

        return {
            "type": weights.get("type", weights.get("content_type", 15)),
            "duration": weights.get("duration", weights.get("length", 20)),
            "genre": weights.get("genre", 15),
            "timing": weights.get("timing", weights.get("time", 10)),
            "strategy": weights.get("strategy", weights.get("rules", 10)),
            "age": weights.get("age", weights.get("rating_age", 15)),
            "rating": weights.get("rating", weights.get("score", 10)),
            "filter": weights.get("filter", weights.get("keywords", 10)),
            "bonus": weights.get("bonus", 5),
        }

    @classmethod
    def validate_version(cls, version: str) -> bool:
        """Check if version is supported."""
        if not version:
            return False
        return version.startswith("4.") or version.startswith("5.") or version.startswith("6.")

    @classmethod
    def detect_version(cls, profile_data: dict[str, Any]) -> str:
        """Detect profile version from structure."""
        # If version is explicitly set
        version = profile_data.get("version")
        if version:
            return version

        # Heuristics for v4 detection
        if "mandatory" in profile_data or "forbidden" in profile_data:
            return "4.0"

        if "weights" in profile_data and "scoring_weights" not in profile_data:
            return "4.0"

        if "iterations" in profile_data and "default_iterations" not in profile_data:
            return "4.0"

        # Default to current version
        return cls.CURRENT_VERSION
