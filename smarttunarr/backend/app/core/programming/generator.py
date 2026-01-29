"""ProgrammingGenerator with N iterations and best-score selection."""

import logging
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Callable

from app.core.blocks.time_block_manager import TimeBlock, TimeBlockManager
from app.core.scoring.base_criterion import ScoringContext
from app.core.scoring.engine import ScoringEngine, ScoringResult as ScoreResult

logger = logging.getLogger(__name__)


@dataclass
class ScheduledProgram:
    """A scheduled content item in the programming."""

    content: dict[str, Any]
    content_meta: dict[str, Any] | None
    start_time: datetime
    end_time: datetime
    block_name: str
    position: int
    score: ScoreResult

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "content_id": self.content.get("id"),
            "content_plex_key": self.content.get("plex_key"),
            "title": self.content.get("title"),
            "type": self.content.get("type"),
            "duration_ms": self.content.get("duration_ms"),
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "block_name": self.block_name,
            "position": self.position,
            "score": self.score.to_dict(),
        }


@dataclass
class ProgrammingResult:
    """Result of a programming generation."""

    programs: list[ScheduledProgram]
    total_score: float
    average_score: float
    iteration: int
    forbidden_count: int
    seed: int
    all_iterations: list["ProgrammingResult"] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "programs": [p.to_dict() for p in self.programs],
            "total_score": self.total_score,
            "average_score": self.average_score,
            "iteration": self.iteration,
            "forbidden_count": self.forbidden_count,
            "seed": self.seed,
            "program_count": len(self.programs),
        }


class ProgrammingGenerator:
    """Generates optimized programming with N iterations."""

    def __init__(
        self,
        scoring_engine: ScoringEngine | None = None,
        on_progress: Callable[[int, int, float], None] | None = None,
    ) -> None:
        """
        Initialize generator.

        Args:
            scoring_engine: Scoring engine instance (creates new if None)
            on_progress: Callback for progress updates (iteration, total, best_score)
        """
        self.scoring_engine = scoring_engine or ScoringEngine()
        self.on_progress = on_progress

    def generate(
        self,
        contents: list[tuple[dict[str, Any], dict[str, Any] | None]],
        profile: dict[str, Any],
        start_datetime: datetime,
        duration_hours: int = 24,
        iterations: int = 10,
        randomness: float = 0.3,
        seed: int | None = None,
    ) -> ProgrammingResult:
        """
        Generate optimized programming.

        Args:
            contents: List of (content, metadata) tuples
            profile: Profile configuration
            start_datetime: Start time for programming
            duration_hours: Duration in hours
            iterations: Number of iterations to try
            randomness: Randomness factor (0.0-1.0)
            seed: Random seed for reproducibility

        Returns:
            Best ProgrammingResult across all iterations
        """
        if seed is None:
            seed = random.randint(0, 2**31)

        # Filter forbidden content
        filtered_contents = self._filter_forbidden(contents, profile)
        logger.info(
            f"Filtered {len(contents) - len(filtered_contents)} forbidden items, "
            f"{len(filtered_contents)} remaining"
        )

        # Enforce mandatory content
        mandatory_contents = self._get_mandatory(contents, profile)
        logger.info(f"Found {len(mandatory_contents)} mandatory items")

        all_results: list[ProgrammingResult] = []
        best_result: ProgrammingResult | None = None

        for i in range(iterations):
            # Use deterministic seed per iteration
            iter_seed = seed + i
            random.seed(iter_seed)

            result = self._generate_iteration(
                filtered_contents,
                mandatory_contents,
                profile,
                start_datetime,
                duration_hours,
                randomness,
                i + 1,
                iter_seed,
            )

            all_results.append(result)

            result_score = result.total_score or 0.0
            best_score = best_result.total_score or 0.0 if best_result else 0.0
            if best_result is None or result_score > best_score:
                best_result = result
                logger.info(
                    f"Iteration {i + 1}: New best score {result_score:.2f} "
                    f"(avg: {result.average_score or 0.0:.2f})"
                )

            if self.on_progress:
                self.on_progress(
                    i + 1,
                    iterations,
                    (best_result.total_score or 0.0) if best_result else 0.0,
                )

        # Sort all results by score descending
        all_results.sort(key=lambda r: r.total_score or 0.0, reverse=True)

        # Store all iterations in best_result for access
        if best_result:
            best_result.all_iterations = all_results

        return best_result or ProgrammingResult(
            programs=[],
            total_score=0.0,
            average_score=0.0,
            iteration=0,
            forbidden_count=len(contents) - len(filtered_contents),
            seed=seed,
        )

    def _generate_iteration(
        self,
        contents: list[tuple[dict[str, Any], dict[str, Any] | None]],
        mandatory_contents: list[tuple[dict[str, Any], dict[str, Any] | None]],
        profile: dict[str, Any],
        start_datetime: datetime,
        duration_hours: int,
        randomness: float,
        iteration: int,
        seed: int,
    ) -> ProgrammingResult:
        """Generate a single iteration of programming."""
        block_manager = TimeBlockManager(profile)
        programs: list[ScheduledProgram] = []

        current_time = start_datetime
        end_time = start_datetime + timedelta(hours=duration_hours)
        position = 0

        # Track used content to avoid duplicates
        used_content_ids: set[str] = set()

        # Pre-place mandatory content at strategic times
        for content, meta in mandatory_contents:
            content_id = content.get("plex_key", content.get("id", ""))
            if content_id:
                used_content_ids.add(content_id)

        # Available content pool
        available = [
            (c, m)
            for c, m in contents
            if c.get("plex_key", c.get("id", "")) not in used_content_ids
        ]

        # Track current block name to detect block changes
        current_block_name: str | None = None

        while current_time < end_time and available:
            # Get current block
            block = block_manager.get_block_for_datetime(current_time)
            block_dict = block.to_dict() if block else None

            # Calculate block start and end times
            block_start_time = None
            block_end_time = None
            is_first_in_block = False
            if block:
                block_end_time = block_manager.get_block_end_datetime(current_time, block)
                block_start_time = block_manager.get_block_start_datetime(current_time, block)
                # Detect if this is the first program in this block
                if block.name != current_block_name:
                    is_first_in_block = True
                    current_block_name = block.name

            # Create scoring context with timing information
            scoring_context = ScoringContext(
                current_time=current_time,
                block_start_time=block_start_time,
                block_end_time=block_end_time,
                is_first_in_block=is_first_in_block,
            )

            # Score all available content for current position
            scored_content = []
            for content, meta in available:
                score = self.scoring_engine.score(content, meta, profile, block_dict, scoring_context)
                if not score.forbidden_violations:  # Skip forbidden
                    scored_content.append((content, meta, score))

            if not scored_content:
                break

            # Select content with randomness
            selected = self._select_with_randomness(scored_content, randomness)
            if not selected:
                break

            content, meta, score = selected
            content_id = content.get("plex_key", content.get("id", ""))

            # Calculate end time
            duration_ms = content.get("duration_ms", 0)
            program_end = current_time + timedelta(milliseconds=duration_ms)

            # Create scheduled program
            program = ScheduledProgram(
                content=content,
                content_meta=meta,
                start_time=current_time,
                end_time=program_end,
                block_name=block.name if block else "Unknown",
                position=position,
                score=score,
            )
            programs.append(program)

            # Update state
            current_time = program_end
            position += 1
            used_content_ids.add(content_id)
            available = [
                (c, m)
                for c, m in available
                if c.get("plex_key", c.get("id", "")) != content_id
            ]

        # Calculate totals (handle potential None scores)
        total_score = sum((p.score.total_score or 0.0) for p in programs)
        avg_score = total_score / len(programs) if programs else 0.0

        return ProgrammingResult(
            programs=programs,
            total_score=total_score,
            average_score=avg_score,
            iteration=iteration,
            forbidden_count=0,
            seed=seed,
        )

    def _select_with_randomness(
        self,
        scored_content: list[tuple[dict[str, Any], dict[str, Any] | None, ScoreResult]],
        randomness: float,
    ) -> tuple[dict[str, Any], dict[str, Any] | None, ScoreResult] | None:
        """
        Select content with randomness factor.

        randomness=0: Always pick best score
        randomness=1: Completely random selection
        """
        if not scored_content:
            return None

        # Sort by score descending (handle potential None values)
        sorted_content = sorted(
            scored_content, key=lambda x: x[2].total_score if x[2].total_score is not None else 0.0, reverse=True
        )

        if randomness <= 0 or len(sorted_content) == 1:
            return sorted_content[0]

        # Calculate selection weights based on score and randomness
        max_score = sorted_content[0][2].total_score or 0.0
        weights = []
        for _, _, score in sorted_content:
            # Higher randomness = more weight to lower scores
            score_val = score.total_score if score.total_score is not None else 0.0
            base_weight = score_val / max(max_score, 1)
            adjusted = base_weight * (1 - randomness) + randomness
            weights.append(adjusted)

        # Normalize weights
        total_weight = sum(weights)
        if total_weight <= 0:
            return sorted_content[0]

        normalized = [w / total_weight for w in weights]

        # Weighted random selection
        r = random.random()
        cumulative = 0.0
        for i, weight in enumerate(normalized):
            cumulative += weight
            if r <= cumulative:
                return sorted_content[i]

        return sorted_content[0]

    def _filter_forbidden(
        self,
        contents: list[tuple[dict[str, Any], dict[str, Any] | None]],
        profile: dict[str, Any],
    ) -> list[tuple[dict[str, Any], dict[str, Any] | None]]:
        """Filter out forbidden content."""
        criteria = profile.get("mandatory_forbidden_criteria", {})
        forbidden = criteria.get("forbidden", {})

        forbidden_ids = set(forbidden.get("content_ids", []))
        forbidden_types = set(t.lower() for t in forbidden.get("types", []))
        forbidden_keywords = [k.lower() for k in forbidden.get("keywords", [])]
        forbidden_genres = set(g.lower() for g in forbidden.get("genres", []))

        filtered = []
        for content, meta in contents:
            # Check ID
            content_id = content.get("plex_key", "")
            if content_id in forbidden_ids:
                continue

            # Check type
            content_type = content.get("type", "").lower()
            if content_type in forbidden_types:
                continue

            # Check keywords in title
            title = content.get("title", "").lower()
            if any(kw in title for kw in forbidden_keywords):
                continue

            # Check genres
            if meta:
                content_genres = set(g.lower() for g in meta.get("genres", []))
                if content_genres & forbidden_genres:
                    continue

            filtered.append((content, meta))

        return filtered

    def _get_mandatory(
        self,
        contents: list[tuple[dict[str, Any], dict[str, Any] | None]],
        profile: dict[str, Any],
    ) -> list[tuple[dict[str, Any], dict[str, Any] | None]]:
        """Get mandatory content items."""
        criteria = profile.get("mandatory_forbidden_criteria", {})
        mandatory = criteria.get("mandatory", {})

        mandatory_ids = set(mandatory.get("content_ids", []))

        return [
            (content, meta)
            for content, meta in contents
            if content.get("plex_key", "") in mandatory_ids
        ]
