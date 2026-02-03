"""ProgrammingGenerator with N iterations and best-score selection."""

import logging
import random
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from app.core.blocks.time_block_manager import TimeBlockManager
from app.core.scoring.base_criterion import ScoringContext
from app.core.scoring.engine import ScoringEngine
from app.core.scoring.engine import ScoringResult as ScoreResult

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
    is_replacement: bool = False  # True if this program replaced another
    replacement_reason: str | None = None  # "forbidden" | "improved" | None
    replaced_title: str | None = None  # Title of the program that was replaced

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
            "is_replacement": self.is_replacement,
            "replacement_reason": self.replacement_reason,
            "replaced_title": self.replaced_title,
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
    is_optimized: bool = False  # True if this is the forbidden-replacement optimized iteration
    is_improved: bool = False  # True if this is the improved iteration (better programs from other iterations)
    original_best_iteration: int = 0  # The original best iteration number (before optimization/improvement)
    original_best_score: float = 0.0  # The original best score (before optimization/improvement)
    replaced_count: int = 0  # Number of programs replaced during optimization
    improved_count: int = 0  # Number of programs improved during improvement

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
            "is_optimized": self.is_optimized,
            "is_improved": self.is_improved,
            "original_best_iteration": self.original_best_iteration,
            "original_best_score": self.original_best_score,
            "replaced_count": self.replaced_count,
            "improved_count": self.improved_count,
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
        replace_forbidden: bool = False,
        improve_best: bool = False,
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

        # Filter forbidden content (profile-level)
        filtered_contents = self._filter_forbidden(contents, profile)
        logger.info(
            f"Filtered {len(contents) - len(filtered_contents)} forbidden items (profile-level), "
            f"{len(filtered_contents)} remaining"
        )

        # Log some stats about content for debugging
        if filtered_contents:
            age_ratings: dict[str, int] = {}
            no_rating_count = 0
            for _content, meta in filtered_contents[:100]:  # Sample first 100
                rating = (meta or {}).get("age_rating", "") or (meta or {}).get("content_rating", "")
                if rating:
                    age_ratings[rating] = age_ratings.get(rating, 0) + 1
                else:
                    no_rating_count += 1
            logger.info(
                f"Content sample age ratings: {age_ratings}, no_rating: {no_rating_count}"
            )
            # Log block max_age_rating if any
            time_blocks = profile.get("time_blocks", [])
            for tb in time_blocks:
                criteria = tb.get("criteria", {})
                max_age = criteria.get("max_age_rating")
                if max_age:
                    logger.info(f"Block '{tb.get('name', 'unnamed')}' has max_age_rating: {max_age}")

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

        # Store original best info before any optimization/improvement
        original_best_iteration = best_result.iteration if best_result else 0
        original_best_score = best_result.average_score if best_result else 0.0

        # Improve best iteration with better programs from other iterations
        if improve_best and best_result and len(all_results) > 1:
            improved_result = self._improve_best_programs(
                best_result,
                all_results,
                randomness,
                profile,
                iteration_number=iterations + 1,
            )
            if improved_result.is_improved:
                improved_result.original_best_iteration = original_best_iteration
                improved_result.original_best_score = original_best_score
                all_results.insert(0, improved_result)
                best_result = improved_result
                best_result.all_iterations = all_results

        # Replace forbidden content if requested
        if replace_forbidden and best_result and len(all_results) > 0:
            # Use next iteration number
            next_iter = iterations + 2 if improve_best and best_result.is_improved else iterations + 1
            optimized_result = self._replace_forbidden_programs(
                best_result,
                all_results,
                filtered_contents,
                profile,
                iteration_number=next_iter,
            )
            # If optimization was successful (programs were replaced), add as first iteration
            if optimized_result.is_optimized:
                optimized_result.original_best_iteration = original_best_iteration
                optimized_result.original_best_score = original_best_score
                # Insert optimized result at the beginning of all_iterations
                all_results.insert(0, optimized_result)
                best_result = optimized_result
                best_result.all_iterations = all_results

        # Set original best info on final result
        if best_result and (best_result.is_optimized or best_result.is_improved):
            best_result.original_best_iteration = original_best_iteration
            best_result.original_best_score = original_best_score

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

        # Base available content pool (excluding used)
        base_available = [
            (c, m)
            for c, m in contents
            if c.get("plex_key", c.get("id", "")) not in used_content_ids
        ]

        # Track current block name to detect block changes
        current_block_name: str | None = None
        # Pre-filtered content for current block (re-computed on block change)
        block_filtered: list[tuple[dict[str, Any], dict[str, Any] | None]] = []

        while current_time < end_time and base_available:
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
                    # Pre-filter content for this new block
                    block_filtered = self._prefilter_for_block(base_available, block_dict)
                    if not block_filtered:
                        logger.warning(
                            f"No content passes pre-filter for block '{block.name}', "
                            f"using all available content"
                        )
                        block_filtered = base_available.copy()

            # Create scoring context with timing information
            scoring_context = ScoringContext(
                current_time=current_time,
                block_start_time=block_start_time,
                block_end_time=block_end_time,
                is_first_in_block=is_first_in_block,
                is_schedule_start=(position == 0),  # First program of entire schedule
            )

            # Use pre-filtered content for this block (falls back to base if empty)
            available = block_filtered if block_filtered else base_available

            # Score available content for current position
            # Note: We include ALL content, even those with forbidden violations
            # The UI will highlight forbidden content, but we don't exclude them here
            scored_content = []
            forbidden_count = 0
            for content, meta in available:
                score = self.scoring_engine.score(content, meta, profile, block_dict, scoring_context)
                scored_content.append((content, meta, score))
                if score.forbidden_violations:
                    forbidden_count += 1

            if not scored_content:
                logger.warning(f"No content available at position {position}")
                break

            if forbidden_count > 0:
                logger.info(
                    f"Position {position} (block: {block.name if block else 'None'}): "
                    f"{forbidden_count}/{len(scored_content)} items have forbidden violations"
                )

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

            # Log if selected program has forbidden violations
            if score.forbidden_violations:
                logger.warning(
                    f"[FORBIDDEN SELECTED] Position {position}: '{content.get('title')}' "
                    f"(block: {block.name if block else 'None'}) - "
                    f"Violations: {score.forbidden_violations}"
                )

            # Update state
            current_time = program_end
            position += 1
            used_content_ids.add(content_id)
            # Remove used content from both pools
            base_available = [
                (c, m)
                for c, m in base_available
                if c.get("plex_key", c.get("id", "")) != content_id
            ]
            block_filtered = [
                (c, m)
                for c, m in block_filtered
                if c.get("plex_key", c.get("id", "")) != content_id
            ]

        # Post-process: First recalculate block names based on actual start times
        # This is needed because during scheduling, the assigned block may differ
        # from the actual block if previous programs pushed the start time
        self._recalculate_block_names(programs, profile)

        # Then recalculate timing scores for first/last programs in each block
        # This is needed because during scheduling we don't know which program will be last
        self._recalculate_timing_scores(programs, profile)

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

    def _recalculate_timing_scores(
        self,
        programs: list[ScheduledProgram],
        profile: dict[str, Any],
    ) -> None:
        """
        Recalculate timing scores for first/last programs in each block.

        During scheduling, we don't know which program will be last in a block.
        This post-processing step identifies first/last programs and recalculates
        their timing criterion with proper is_first_in_block/is_last_in_block flags.

        Note: For multi-day programming, the same block name appears multiple times
        (e.g., "morning_" on day 1 and "morning_" on day 2). We need to identify
        block transitions by looking at the actual start times, not just block names.
        """
        if not programs:
            return

        # Import timing criterion
        from app.core.scoring.criteria.timing_criterion import TimingCriterion
        timing_criterion = TimingCriterion()

        # Get time blocks from profile
        time_blocks = profile.get("time_blocks", [])
        time_block_map = {tb.get("name", ""): tb for tb in time_blocks}

        # Group programs by block_name AND block instance (for multi-day support)
        # A new block instance starts when the block_name changes OR when the
        # program's start time is earlier than the previous program (new day)
        block_programs: dict[str, list[int]] = {}  # block_key -> list of program indices
        current_block_key = None
        block_instance = 0

        for idx, prog in enumerate(programs):
            block_name = prog.block_name

            # Detect block transition:
            # 1. Block name changed
            # 2. Same block name but time went backwards (new day/new block instance)
            is_new_block = False
            if current_block_key is None:
                is_new_block = True
            else:
                prev_block_name = current_block_key.rsplit('_', 1)[0] if '_' in current_block_key else current_block_key
                if block_name != prev_block_name:
                    is_new_block = True
                elif idx > 0:
                    # Check if this is a new instance of the same block (time went backwards)
                    prev_prog = programs[idx - 1]
                    if prog.start_time < prev_prog.end_time - timedelta(hours=1):
                        # Significant time gap backwards = new block instance
                        is_new_block = True

            if is_new_block:
                block_instance += 1
                current_block_key = f"{block_name}_{block_instance}"
                block_programs[current_block_key] = []

            block_programs[current_block_key].append(idx)

        # Process each program that is first or last in its block
        for block_key, indices in block_programs.items():
            if not indices:
                continue

            first_idx = indices[0]
            last_idx = indices[-1]
            # Extract original block name (remove instance suffix)
            block_name = block_key.rsplit('_', 1)[0] if block_key.count('_') > 0 else block_key
            # Get the actual block name from the first program in this block instance
            actual_block_name = programs[first_idx].block_name
            block_dict = time_block_map.get(actual_block_name, {})

            # Get block times from the block definition (by name, not by datetime!)
            # This ensures we use the ASSIGNED block, not whatever block happens to contain the time
            block_start_str = block_dict.get("start_time", "00:00")
            block_end_str = block_dict.get("end_time", "23:59")

            def build_block_datetime(time_str: str, reference_dt: datetime, is_end: bool = False) -> datetime:
                """Build a full datetime from block time string (HH:MM) using reference date.

                Block times are defined in LOCAL time, so we:
                1. Convert reference_dt to local time
                2. Replace hour/minute to get the block time in local
                3. Return as naive datetime (for consistent local time comparisons)
                """
                from app.core.blocks.time_block_manager import _get_local_timezone

                try:
                    parts = time_str.split(":")
                    hour = int(parts[0])
                    minute = int(parts[1]) if len(parts) > 1 else 0
                except (ValueError, IndexError):
                    hour, minute = 0, 0

                # Convert reference to local time first (block times are in local time)
                if reference_dt.tzinfo is not None:
                    local_tz = _get_local_timezone()
                    local_ref = reference_dt.astimezone(local_tz)
                else:
                    local_ref = reference_dt

                # Build result as local time (naive - no timezone)
                result = local_ref.replace(hour=hour, minute=minute, second=0, microsecond=0, tzinfo=None)
                ref_hour = local_ref.hour

                # Handle overnight blocks (end < start)
                try:
                    start_h = int(block_start_str.split(":")[0])
                    end_h = int(block_end_str.split(":")[0])
                except (ValueError, IndexError):
                    start_h, end_h = 0, 0

                is_overnight = end_h < start_h

                if is_overnight:
                    if is_end:
                        # End time is after midnight
                        if ref_hour >= start_h:
                            # Program is before midnight, block ends tomorrow
                            result = result + timedelta(days=1)
                    else:
                        # Start time is before midnight
                        if ref_hour < start_h:
                            # Program is after midnight, block started yesterday
                            result = result - timedelta(days=1)

                return result

            # Recalculate timing for first program
            first_prog = programs[first_idx]
            if block_dict:
                block_start_time = build_block_datetime(block_start_str, first_prog.start_time, is_end=False)
                block_end_time = build_block_datetime(block_end_str, first_prog.start_time, is_end=True)

                is_also_last = (first_idx == last_idx)
                context = ScoringContext(
                    current_time=first_prog.start_time,
                    block_start_time=block_start_time,
                    block_end_time=block_end_time,
                    is_first_in_block=True,
                    is_last_in_block=is_also_last,
                    is_schedule_start=(first_idx == 0),  # First program of entire schedule
                )

                # Recalculate timing criterion
                timing_result = timing_criterion.evaluate(
                    first_prog.content,
                    first_prog.content_meta,
                    profile,
                    block_dict,
                    context,
                )

                # Update the program's score with new timing result
                self._update_program_timing_score(first_prog, timing_result)

            # Recalculate timing for last program (if different from first)
            if last_idx != first_idx:
                last_prog = programs[last_idx]
                if block_dict:
                    block_start_time = build_block_datetime(block_start_str, last_prog.start_time, is_end=False)
                    block_end_time = build_block_datetime(block_end_str, last_prog.start_time, is_end=True)

                    context = ScoringContext(
                        current_time=last_prog.start_time,
                        block_start_time=block_start_time,
                        block_end_time=block_end_time,
                        is_first_in_block=False,
                        is_last_in_block=True,
                    )

                    # Recalculate timing criterion
                    timing_result = timing_criterion.evaluate(
                        last_prog.content,
                        last_prog.content_meta,
                        profile,
                        block_dict,
                        context,
                    )

                    # Update the program's score with new timing result
                    self._update_program_timing_score(last_prog, timing_result)

            # Middle programs: mark timing as skipped
            for idx in indices[1:-1]:  # Skip first and last
                prog = programs[idx]
                # Create a skipped timing result
                from app.core.scoring.base_criterion import CriterionResult
                timing_result = CriterionResult(
                    name="timing",
                    score=0.0,
                    weight=0.0,
                    weighted_score=0.0,
                    multiplier=1.0,
                    multiplied_weighted_score=0.0,
                    details={
                        "is_first_in_block": False,
                        "is_last_in_block": False,
                        "skipped": True,
                        "final_score": None,
                    },
                    skipped=True,
                )
                self._update_program_timing_score(prog, timing_result)

    def _update_program_timing_score(
        self,
        prog: ScheduledProgram,
        timing_result,
    ) -> None:
        """Update program's score with new timing criterion result."""

        # Update criterion results with new timing
        prog.score.criterion_results["timing"] = timing_result

        # Recalculate weighted_total properly from all criterion results
        # This mirrors the logic in ScoringEngine.score():
        # weighted_total = (multiplied_weighted_sum / total_weight) * 100
        total_weight = 0.0
        multiplied_weighted_sum = 0.0

        for criterion_result in prog.score.criterion_results.values():
            effective_weight = criterion_result.weight * criterion_result.multiplier
            total_weight += effective_weight
            multiplied_weighted_sum += criterion_result.multiplied_weighted_score

        if total_weight > 0:
            prog.score.weighted_total = (multiplied_weighted_sum / total_weight) * 100
        else:
            prog.score.weighted_total = 50.0

        # Calculate total_score from weighted_total, applying mandatory penalties
        # This mirrors the logic in ScoringEngine.score()
        if prog.score.forbidden_violations:
            prog.score.total_score = 0.0
        else:
            adjusted_score = prog.score.weighted_total
            for penalty in prog.score.mandatory_penalties:
                adjusted_score -= penalty.get("penalty", 10.0)
            # Apply keyword multiplier if present
            if prog.score.keyword_multiplier != 1.0:
                adjusted_score *= prog.score.keyword_multiplier
            prog.score.total_score = max(0.0, min(100.0, adjusted_score))

    def _recalculate_consecutive_timings(
        self,
        programs: list[ScheduledProgram],
    ) -> None:
        """
        Recalculate start/end times for consecutive programs after replacements.

        When a program is replaced with one of a different duration, subsequent
        programs' start times need to be adjusted to avoid overlaps or gaps.

        This method ensures all programs are consecutive with no overlaps:
        - First program keeps its original start_time
        - Each subsequent program starts when the previous one ends
        - End times are calculated from start_time + duration
        """
        if not programs:
            return

        for idx in range(len(programs)):
            prog = programs[idx]
            duration_ms = prog.content.get("duration_ms", 0)

            if idx == 0:
                # First program: keep original start, recalculate end
                prog.end_time = prog.start_time + timedelta(milliseconds=duration_ms)
            else:
                # Subsequent programs: start when previous ends
                prev_prog = programs[idx - 1]
                prog.start_time = prev_prog.end_time
                prog.end_time = prog.start_time + timedelta(milliseconds=duration_ms)

    def _recalculate_block_names(
        self,
        programs: list[ScheduledProgram],
        profile: dict[str, Any],
    ) -> None:
        """
        Recalculate block_name for all programs based on their current start_time.

        After timing recalculation (due to program replacements with different durations),
        programs may have shifted to different time blocks. This method updates each
        program's block_name to reflect the block that contains its actual start_time.

        Args:
            programs: List of scheduled programs to update
            profile: Profile containing time_blocks configuration
        """
        if not programs:
            return

        from app.core.blocks.time_block_manager import TimeBlockManager
        block_manager = TimeBlockManager(profile)

        changes_made = 0
        for prog in programs:
            old_block_name = prog.block_name
            block = block_manager.get_block_for_datetime(prog.start_time)
            if block:
                prog.block_name = block.name
                if old_block_name != block.name:
                    changes_made += 1
                    logger.info(
                        f"Block name change: '{prog.content.get('title')}' at {prog.start_time.strftime('%H:%M')} "
                        f"changed from '{old_block_name}' to '{block.name}'"
                    )
            else:
                prog.block_name = "Unknown"
                if old_block_name != "Unknown":
                    changes_made += 1
                    logger.warning(
                        f"No block found for '{prog.content.get('title')}' at {prog.start_time.strftime('%H:%M')}"
                    )

        logger.info(f"_recalculate_block_names: {changes_made} block name changes made")

    def _recalculate_full_scores(
        self,
        programs: list[ScheduledProgram],
        profile: dict[str, Any],
    ) -> None:
        """
        Recalculate full scores for programs after block changes.

        After block name recalculation, programs may be in different blocks with
        different criteria. This method recalculates the complete score for each
        program using the criteria of its current block.
        """
        if not programs:
            return

        time_blocks = profile.get("time_blocks", [])
        time_block_map = {tb.get("name", ""): tb for tb in time_blocks}

        recalculated_count = 0
        from app.core.blocks.time_block_manager import _get_local_timezone
        from app.core.scoring.base_criterion import ScoringContext

        def build_block_datetime_for_recalc(time_str: str, reference_dt: datetime) -> datetime | None:
            """Build a full datetime from block time string (HH:MM) using reference date."""
            if not time_str:
                return None
            try:
                parts = time_str.split(":")
                hour = int(parts[0])
                minute = int(parts[1]) if len(parts) > 1 else 0
            except (ValueError, IndexError):
                return None

            # Convert reference to local time first (block times are in local time)
            if reference_dt.tzinfo is not None:
                local_tz = _get_local_timezone()
                local_ref = reference_dt.astimezone(local_tz)
            else:
                local_ref = reference_dt

            return local_ref.replace(hour=hour, minute=minute, second=0, microsecond=0, tzinfo=None)

        for prog_idx, prog in enumerate(programs):
            block_dict = time_block_map.get(prog.block_name, {})

            # Build proper timing context using program's actual start time
            block_start_time = None
            block_end_time = None
            if block_dict and prog.start_time:
                block_start_str = block_dict.get("start_time", "00:00")
                block_end_str = block_dict.get("end_time", "00:00")
                block_start_time = build_block_datetime_for_recalc(block_start_str, prog.start_time)
                block_end_time = build_block_datetime_for_recalc(block_end_str, prog.start_time)

            # Build scoring context with proper timing info
            scoring_context = ScoringContext(
                current_time=prog.start_time,
                block_start_time=block_start_time,
                block_end_time=block_end_time,
                is_first_in_block=prog.position == 0,
                is_last_in_block=False,  # Will be updated in timing recalculation
                is_schedule_start=(prog_idx == 0),  # First program of entire schedule
            )

            # Recalculate full score with new block criteria
            new_score = self.scoring_engine.score(
                prog.content,
                prog.content_meta,
                profile,
                block_dict,
                scoring_context,
            )

            # Check if forbidden status changed
            old_forbidden = len(prog.score.forbidden_violations) > 0 if prog.score else False
            new_forbidden = len(new_score.forbidden_violations) > 0

            if new_forbidden != old_forbidden:
                logger.info(
                    f"Forbidden status changed for '{prog.content.get('title')}': "
                    f"{old_forbidden} -> {new_forbidden} (block: {prog.block_name})"
                )

            prog.score = new_score
            recalculated_count += 1

        logger.info(f"_recalculate_full_scores: recalculated {recalculated_count} programs")

    def _filter_forbidden(
        self,
        contents: list[tuple[dict[str, Any], dict[str, Any] | None]],
        profile: dict[str, Any],
    ) -> list[tuple[dict[str, Any], dict[str, Any] | None]]:
        """Filter out forbidden content."""
        criteria = profile.get("mandatory_forbidden_criteria", {})
        forbidden = criteria.get("forbidden", {})

        forbidden_ids = set(forbidden.get("content_ids", []))
        forbidden_types = {t.lower() for t in forbidden.get("types", [])}
        forbidden_keywords = [k.lower() for k in forbidden.get("keywords", [])]
        forbidden_genres = {g.lower() for g in forbidden.get("genres", [])}

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
                content_genres = {g.lower() for g in meta.get("genres", [])}
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

    def _prefilter_for_block(
        self,
        contents: list[tuple[dict[str, Any], dict[str, Any] | None]],
        block: dict[str, Any],
    ) -> list[tuple[dict[str, Any], dict[str, Any] | None]]:
        """
        Smart pre-selection for a specific block based on M/F/P rules.

        This method analyzes all *_rules in the block criteria and creates
        a tiered selection:
        - Tier 1: Content matching maximum Preferred criteria
        - Tier 2: Content with Mandatory respected
        - Tier 3: Content without Forbidden violations
        - Tier 4: Fallback (all other content)

        Returns a pool sorted by preselection score (best first).
        """

        criteria = block.get("criteria", {}) if block else {}
        if not criteria:
            return contents

        # Extract all rules from criteria
        rules_config = self._extract_mfp_rules(criteria)

        # Score each content for preselection
        scored_contents: list[tuple[dict[str, Any], dict[str, Any] | None, dict[str, Any]]] = []

        for content, meta in contents:
            preselect_result = self._evaluate_preselection(content, meta, criteria, rules_config)
            scored_contents.append((content, meta, preselect_result))

        # Log preselection stats
        tier_counts = {1: 0, 2: 0, 3: 0, 4: 0}
        for _, _, result in scored_contents:
            tier_counts[result["tier"]] += 1

        block_name = block.get("name", "unnamed") if block else "unknown"
        logger.info(
            f"Block '{block_name}' preselection: "
            f"Tier1(preferred)={tier_counts[1]}, Tier2(mandatory)={tier_counts[2]}, "
            f"Tier3(no_forbidden)={tier_counts[3]}, Tier4(fallback)={tier_counts[4]}"
        )

        # Sort by: tier (ascending), then preselect_score (descending)
        scored_contents.sort(key=lambda x: (x[2]["tier"], -x[2]["preselect_score"]))

        # Return only content, meta (without the score dict)
        return [(c, m) for c, m, _ in scored_contents]

    def _extract_mfp_rules(self, criteria: dict[str, Any]) -> dict[str, dict[str, Any]]:
        """
        Extract all M/F/P rules from block criteria.

        Returns a dict with rule configurations for each criterion type.
        """
        rules = {}

        # Genre rules
        genre_rules = criteria.get("genre_rules", {})
        if genre_rules:
            rules["genre"] = {
                "preferred": [v.lower() for v in genre_rules.get("preferred_values", []) or []],
                "mandatory": [v.lower() for v in genre_rules.get("mandatory_values", []) or []],
                "forbidden": [v.lower() for v in genre_rules.get("forbidden_values", []) or []],
            }
        # Also check legacy fields
        preferred_genres = criteria.get("preferred_genres", [])
        forbidden_genres = criteria.get("forbidden_genres", [])
        if preferred_genres or forbidden_genres:
            if "genre" not in rules:
                rules["genre"] = {"preferred": [], "mandatory": [], "forbidden": []}
            rules["genre"]["preferred"].extend([g.lower() for g in preferred_genres])
            rules["genre"]["forbidden"].extend([g.lower() for g in forbidden_genres])

        # Bonus rules (blockbuster, popular, collection, recent)
        bonus_rules = criteria.get("bonus_rules", {})
        if bonus_rules:
            rules["bonus"] = {
                "preferred": [v.lower() for v in bonus_rules.get("preferred_values", []) or []],
                "mandatory": [v.lower() for v in bonus_rules.get("mandatory_values", []) or []],
                "forbidden": [v.lower() for v in bonus_rules.get("forbidden_values", []) or []],
            }

        # Rating rules (excellent, good, average, poor)
        rating_rules = criteria.get("rating_rules", {})
        if rating_rules:
            rules["rating"] = {
                "preferred": [v.lower() for v in rating_rules.get("preferred_values", []) or []],
                "mandatory": [v.lower() for v in rating_rules.get("mandatory_values", []) or []],
                "forbidden": [v.lower() for v in rating_rules.get("forbidden_values", []) or []],
            }

        # Filter rules (keywords, studios like marvel, disney, etc.)
        filter_rules = criteria.get("filter_rules", {})
        if filter_rules:
            rules["filter"] = {
                "preferred": [v.lower() for v in filter_rules.get("preferred_values", []) or []],
                "mandatory": [v.lower() for v in filter_rules.get("mandatory_values", []) or []],
                "forbidden": [v.lower() for v in filter_rules.get("forbidden_values", []) or []],
            }

        # Age rules
        age_rules = criteria.get("age_rules", {})
        if age_rules:
            rules["age"] = {
                "preferred": [v.lower() for v in age_rules.get("preferred_values", []) or []],
                "mandatory": [v.lower() for v in age_rules.get("mandatory_values", []) or []],
                "forbidden": [v.lower() for v in age_rules.get("forbidden_values", []) or []],
            }

        # Type rules
        type_rules = criteria.get("type_rules", {})
        if type_rules:
            rules["type"] = {
                "preferred": [v.lower() for v in type_rules.get("preferred_values", []) or []],
                "mandatory": [v.lower() for v in type_rules.get("mandatory_values", []) or []],
                "forbidden": [v.lower() for v in type_rules.get("forbidden_values", []) or []],
            }

        # Duration rules (short, standard, long, very_long, epic)
        duration_rules = criteria.get("duration_rules", {})
        if duration_rules:
            rules["duration"] = {
                "preferred": [v.lower() for v in duration_rules.get("preferred_values", []) or []],
                "mandatory": [v.lower() for v in duration_rules.get("mandatory_values", []) or []],
                "forbidden": [v.lower() for v in duration_rules.get("forbidden_values", []) or []],
            }

        return rules

    def _evaluate_preselection(
        self,
        content: dict[str, Any],
        meta: dict[str, Any] | None,
        criteria: dict[str, Any],
        rules_config: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Evaluate content against M/F/P rules and return preselection result.

        Returns:
            dict with keys:
            - tier: 1 (best) to 4 (fallback)
            - preselect_score: numeric score within tier
            - preferred_matches: list of matched preferred criteria
            - mandatory_matches: list of matched mandatory criteria
            - forbidden_violations: list of violated forbidden criteria
        """
        from app.core.scoring.criteria.age_criterion import AgeCriterion

        preferred_matches: list[str] = []
        mandatory_matches: list[str] = []
        mandatory_misses: list[str] = []
        forbidden_violations: list[str] = []

        meta = meta or {}

        # === GENRE EVALUATION ===
        if "genre" in rules_config:
            content_genres = {g.lower() for g in meta.get("genres", [])}
            genre_rules = rules_config["genre"]

            # Preferred genres
            for pref in genre_rules["preferred"]:
                if pref in content_genres:
                    preferred_matches.append(f"genre:{pref}")

            # Mandatory genres
            for mand in genre_rules["mandatory"]:
                if mand in content_genres:
                    mandatory_matches.append(f"genre:{mand}")
                else:
                    mandatory_misses.append(f"genre:{mand}")

            # Forbidden genres
            for forb in genre_rules["forbidden"]:
                if forb in content_genres:
                    forbidden_violations.append(f"genre:{forb}")

        # === BONUS EVALUATION (blockbuster, popular, collection, recent) ===
        if "bonus" in rules_config:
            bonus_rules = rules_config["bonus"]
            content_bonuses = self._get_content_bonus_categories(content, meta)

            for pref in bonus_rules["preferred"]:
                if pref in content_bonuses:
                    preferred_matches.append(f"bonus:{pref}")

            for mand in bonus_rules["mandatory"]:
                if mand in content_bonuses:
                    mandatory_matches.append(f"bonus:{mand}")
                else:
                    mandatory_misses.append(f"bonus:{mand}")

            for forb in bonus_rules["forbidden"]:
                if forb in content_bonuses:
                    forbidden_violations.append(f"bonus:{forb}")

        # === RATING EVALUATION (excellent, good, average, poor) ===
        if "rating" in rules_config:
            rating_rules = rules_config["rating"]
            rating_category = self._get_rating_category(meta.get("tmdb_rating"))

            if rating_category:
                if rating_category in rating_rules["preferred"]:
                    preferred_matches.append(f"rating:{rating_category}")
                if rating_category in rating_rules["mandatory"]:
                    mandatory_matches.append(f"rating:{rating_category}")
                if rating_category in rating_rules["forbidden"]:
                    forbidden_violations.append(f"rating:{rating_category}")

            # Check mandatory miss
            if rating_rules["mandatory"] and rating_category not in rating_rules["mandatory"]:
                mandatory_misses.append("rating:required")

        # === FILTER EVALUATION (keywords, studios) ===
        if "filter" in rules_config:
            filter_rules = rules_config["filter"]
            content_keywords = self._get_content_keywords(content, meta)

            for pref in filter_rules["preferred"]:
                if pref in content_keywords:
                    preferred_matches.append(f"filter:{pref}")

            for mand in filter_rules["mandatory"]:
                if mand in content_keywords:
                    mandatory_matches.append(f"filter:{mand}")
                else:
                    mandatory_misses.append(f"filter:{mand}")

            for forb in filter_rules["forbidden"]:
                if forb in content_keywords:
                    forbidden_violations.append(f"filter:{forb}")

        # === AGE EVALUATION ===
        if "age" in rules_config:
            age_rules = rules_config["age"]
            raw_rating = meta.get("age_rating") or meta.get("content_rating") or ""
            content_rating = raw_rating.lower() if raw_rating else ""

            if content_rating:
                if content_rating in age_rules["preferred"]:
                    preferred_matches.append(f"age:{content_rating}")
                if content_rating in age_rules["forbidden"]:
                    forbidden_violations.append(f"age:{content_rating}")

        # Also check max_age_rating constraint
        max_age_rating = criteria.get("max_age_rating")
        if max_age_rating:
            content_rating = meta.get("age_rating") or meta.get("content_rating") or ""
            if content_rating:
                max_level = AgeCriterion.get_rating_level(max_age_rating)
                content_level = AgeCriterion.get_rating_level(content_rating)
                if content_level > max_level:
                    forbidden_violations.append(f"age:exceeds_max({content_rating}>{max_age_rating})")

        # === TYPE EVALUATION ===
        if "type" in rules_config:
            type_rules = rules_config["type"]
            content_type = content.get("type", "").lower()

            if content_type:
                if content_type in type_rules["preferred"]:
                    preferred_matches.append(f"type:{content_type}")
                if content_type in type_rules["mandatory"]:
                    mandatory_matches.append(f"type:{content_type}")
                if content_type in type_rules["forbidden"]:
                    forbidden_violations.append(f"type:{content_type}")

            if type_rules["mandatory"] and content_type not in type_rules["mandatory"]:
                mandatory_misses.append("type:required")

        # === DURATION EVALUATION ===
        if "duration" in rules_config:
            duration_rules = rules_config["duration"]
            duration_category = self._get_duration_category(content.get("duration_ms", 0))

            if duration_category:
                if duration_category in duration_rules["preferred"]:
                    preferred_matches.append(f"duration:{duration_category}")
                if duration_category in duration_rules["mandatory"]:
                    mandatory_matches.append(f"duration:{duration_category}")
                if duration_category in duration_rules["forbidden"]:
                    forbidden_violations.append(f"duration:{duration_category}")

        # Also check min/max duration constraints
        min_duration = criteria.get("min_duration_min")
        max_duration = criteria.get("max_duration_min")
        duration_ms = content.get("duration_ms", 0)
        duration_min = duration_ms / 60000 if duration_ms else 0

        if min_duration and duration_min < min_duration:
            forbidden_violations.append(f"duration:below_min({duration_min:.0f}<{min_duration})")
        if max_duration and duration_min > max_duration:
            forbidden_violations.append(f"duration:above_max({duration_min:.0f}>{max_duration})")

        # === DETERMINE TIER ===
        # Tier 1: Has preferred matches AND no forbidden violations
        # Tier 2: No preferred but mandatory OK AND no forbidden
        # Tier 3: No forbidden violations
        # Tier 4: Fallback (has forbidden)

        has_forbidden = len(forbidden_violations) > 0
        has_preferred = len(preferred_matches) > 0
        has_mandatory_miss = len(mandatory_misses) > 0

        if has_forbidden:
            tier = 4
        elif has_preferred and not has_mandatory_miss:
            tier = 1
        elif not has_mandatory_miss:
            tier = 2
        else:
            tier = 3

        # Calculate preselect score within tier
        # More preferred matches = higher score
        preselect_score = len(preferred_matches) * 10 + len(mandatory_matches) * 5 - len(mandatory_misses) * 3

        return {
            "tier": tier,
            "preselect_score": preselect_score,
            "preferred_matches": preferred_matches,
            "mandatory_matches": mandatory_matches,
            "mandatory_misses": mandatory_misses,
            "forbidden_violations": forbidden_violations,
        }

    def _get_content_bonus_categories(
        self, content: dict[str, Any], meta: dict[str, Any]
    ) -> set[str]:
        """
        Determine which bonus categories a content matches.

        Categories: blockbuster, popular, collection, recent, old, classic, vintage
        """
        from datetime import datetime

        categories: set[str] = set()

        # Blockbuster: revenue > budget * 2
        budget = meta.get("budget", 0) or 0
        revenue = meta.get("revenue", 0) or 0
        if budget > 0 and revenue > budget * 2:
            categories.add("blockbuster")
        if budget > 0 and revenue > budget * 3:
            categories.add("blockbuster")  # Already added, but emphasize

        # Popular: high vote count
        vote_count = meta.get("vote_count", 0) or 0
        if vote_count >= 5000:
            categories.add("popular")

        # Collection: part of a collection
        collection = meta.get("collection") or meta.get("belongs_to_collection")
        if collection:
            categories.add("collection")

        # Recent: released in last 2 years
        release_date = meta.get("release_date", "") or ""
        if release_date:
            try:
                release_year = int(release_date[:4])
                current_year = datetime.now().year
                age = current_year - release_year

                if age <= 2:
                    categories.add("recent")
                    categories.add("recency")
                if age <= 5:
                    categories.add("recent")
                if age >= 20:
                    categories.add("old")
                    categories.add("classic")
                    categories.add("vintage")
            except (ValueError, IndexError):
                pass

        return categories

    def _get_rating_category(self, rating: float | None) -> str | None:
        """Convert TMDB rating to category."""
        if rating is None:
            return None

        if rating >= 8.0:
            return "excellent"
        elif rating >= 7.0:
            return "good"
        elif rating >= 5.0:
            return "average"
        else:
            return "poor"

    def _get_content_keywords(
        self, content: dict[str, Any], meta: dict[str, Any]
    ) -> set[str]:
        """
        Extract searchable keywords from content metadata.

        Includes: TMDB keywords, studios, collections, title keywords
        """
        keywords: set[str] = set()

        # TMDB keywords
        tmdb_keywords = meta.get("keywords", []) or []
        for kw in tmdb_keywords:
            if isinstance(kw, dict):
                keywords.add(kw.get("name", "").lower())
            else:
                keywords.add(str(kw).lower())

        # Studios/production companies
        studios = meta.get("production_companies", []) or []
        for studio in studios:
            if isinstance(studio, dict):
                studio_name = studio.get("name", "").lower()
                keywords.add(studio_name)
                # Add common aliases
                if "marvel" in studio_name:
                    keywords.add("marvel")
                if "disney" in studio_name:
                    keywords.add("disney")
                if "pixar" in studio_name:
                    keywords.add("pixar")
                if "warner" in studio_name:
                    keywords.add("dc")
                if "dreamworks" in studio_name:
                    keywords.add("dreamworks")
                if "blumhouse" in studio_name:
                    keywords.add("blumhouse")
                if "a24" in studio_name:
                    keywords.add("a24")

        # Collection name
        collection = meta.get("collection") or meta.get("belongs_to_collection")
        if collection:
            if isinstance(collection, dict):
                coll_name = collection.get("name", "").lower()
                keywords.add(coll_name)
                keywords.add("franchise")
                keywords.add("sequel")
                # Extract collection keywords
                if "marvel" in coll_name:
                    keywords.add("marvel")
                    keywords.add("superhero")
                if "dc" in coll_name or "batman" in coll_name or "superman" in coll_name:
                    keywords.add("dc")
                    keywords.add("superhero")
                if "star wars" in coll_name:
                    keywords.add("star wars")
                if "harry potter" in coll_name:
                    keywords.add("harry potter")
                if "fast" in coll_name and "furious" in coll_name:
                    keywords.add("fast & furious")
                if "john wick" in coll_name:
                    keywords.add("john wick")
                if "conjuring" in coll_name or "halloween" in coll_name or "scream" in coll_name:
                    keywords.add("horror")
            else:
                keywords.add(str(collection).lower())

        # Title keywords
        title = content.get("title", "").lower()
        # Add individual words from title (for matching like "nolan", "cameron")
        for word in title.split():
            if len(word) > 3:
                keywords.add(word)

        return keywords

    def _get_duration_category(self, duration_ms: int) -> str | None:
        """Convert duration to category."""
        if not duration_ms:
            return None

        duration_min = duration_ms / 60000

        if duration_min < 60:
            return "short"
        elif duration_min < 120:
            return "standard"
        elif duration_min < 180:
            return "long"
        elif duration_min < 240:
            return "very_long"
        else:
            return "epic"

    def _replace_forbidden_programs(
        self,
        best_result: ProgrammingResult,
        all_results: list[ProgrammingResult],
        filtered_contents: list[tuple[dict[str, Any], dict[str, Any] | None]],
        profile: dict[str, Any],
        iteration_number: int = 0,
    ) -> ProgrammingResult:
        """
        Replace forbidden programs in the best iteration with non-forbidden alternatives.

        Strategy:
        1. For each forbidden program in best iteration:
           a. First try to find replacement from other iterations (same block, not forbidden, best score)
           b. If not found, use pre-filtered pool (Tier 1-3 content)
        2. Recalculate total scores after replacements

        Args:
            best_result: The best programming result to modify
            all_results: All iteration results (for finding alternatives)
            filtered_contents: Pre-filtered content pool
            profile: Profile configuration
            iteration_number: Iteration number for the optimized result

        Returns:
            Modified ProgrammingResult with forbidden content replaced and is_optimized=True
        """
        # Find programs with forbidden violations
        forbidden_programs: list[tuple[int, ScheduledProgram]] = []
        for idx, prog in enumerate(best_result.programs):
            if prog.score.forbidden_violations:
                forbidden_programs.append((idx, prog))

        if not forbidden_programs:
            logger.info("No forbidden programs to replace")
            # Return original without is_optimized flag
            return best_result

        logger.info(f"Found {len(forbidden_programs)} forbidden programs to replace")

        # Track used content IDs to avoid duplicates
        used_content_ids: set[str] = set()
        for prog in best_result.programs:
            content_id = prog.content.get("plex_key", prog.content.get("id", ""))
            if content_id:
                used_content_ids.add(content_id)

        # Build a map of block_name -> programs from other iterations
        # Only include programs that are NOT forbidden
        other_iterations_map: dict[str, list[tuple[ScheduledProgram, ProgrammingResult]]] = {}
        for result in all_results:
            if result.iteration == best_result.iteration:
                continue  # Skip the best result itself
            for prog in result.programs:
                if not prog.score.forbidden_violations:
                    block_name = prog.block_name
                    if block_name not in other_iterations_map:
                        other_iterations_map[block_name] = []
                    other_iterations_map[block_name].append((prog, result))

        # Sort each block's alternatives by score descending
        for block_name in other_iterations_map:
            other_iterations_map[block_name].sort(
                key=lambda x: x[0].score.total_score or 0.0, reverse=True
            )

        # Get time blocks for pre-filtering
        time_blocks = profile.get("time_blocks", [])
        time_block_map = {tb.get("name", ""): tb for tb in time_blocks}

        # Process each forbidden program
        replaced_count = 0
        new_programs = list(best_result.programs)

        for prog_idx, forbidden_prog in forbidden_programs:
            block_name = forbidden_prog.block_name
            forbidden_id = forbidden_prog.content.get("plex_key", forbidden_prog.content.get("id", ""))

            replacement: ScheduledProgram | None = None

            # Strategy 1: Find replacement from other iterations
            if block_name in other_iterations_map:
                for alt_prog, _ in other_iterations_map[block_name]:
                    alt_id = alt_prog.content.get("plex_key", alt_prog.content.get("id", ""))
                    if alt_id and alt_id not in used_content_ids:
                        # Found a valid replacement from another iteration
                        # Create a new ScheduledProgram with adjusted times
                        replacement = ScheduledProgram(
                            content=alt_prog.content,
                            content_meta=alt_prog.content_meta,
                            start_time=forbidden_prog.start_time,
                            end_time=forbidden_prog.start_time + timedelta(
                                milliseconds=alt_prog.content.get("duration_ms", 0)
                            ),
                            block_name=block_name,
                            position=forbidden_prog.position,
                            score=alt_prog.score,  # Keep original score
                            is_replacement=True,
                            replacement_reason="forbidden",
                            replaced_title=forbidden_prog.content.get("title"),
                        )
                        used_content_ids.add(alt_id)
                        logger.info(
                            f"Replaced forbidden '{forbidden_prog.content.get('title')}' "
                            f"with '{alt_prog.content.get('title')}' from iteration #{_.iteration}"
                        )
                        break

            # Strategy 2: Find replacement from pre-filtered pool
            if replacement is None:
                # Get block criteria for pre-filtering
                block_dict = time_block_map.get(block_name, {})
                block_filtered = self._prefilter_for_block(filtered_contents, block_dict)

                # Find best non-forbidden content not already used
                for content, meta in block_filtered:
                    content_id = content.get("plex_key", content.get("id", ""))
                    if content_id and content_id not in used_content_ids:
                        # Score this content for the current position
                        from app.core.blocks.time_block_manager import TimeBlockManager
                        block_manager = TimeBlockManager(profile)
                        block = block_manager.get_block_for_datetime(forbidden_prog.start_time)
                        block_dict_for_scoring = block.to_dict() if block else None

                        # Create scoring context with proper block timing
                        block_start_time = None
                        block_end_time = None
                        if block_dict_for_scoring:
                            from app.core.blocks.time_block_manager import _get_local_timezone
                            block_start_str = block_dict_for_scoring.get("start_time", "00:00")
                            block_end_str = block_dict_for_scoring.get("end_time", "00:00")
                            ref_dt = forbidden_prog.start_time
                            try:
                                parts = block_start_str.split(":")
                                hour, minute = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
                                if ref_dt.tzinfo is not None:
                                    local_tz = _get_local_timezone()
                                    local_ref = ref_dt.astimezone(local_tz)
                                else:
                                    local_ref = ref_dt
                                block_start_time = local_ref.replace(hour=hour, minute=minute, second=0, microsecond=0, tzinfo=None)
                            except (ValueError, IndexError):
                                pass
                            try:
                                parts = block_end_str.split(":")
                                hour, minute = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
                                if ref_dt.tzinfo is not None:
                                    local_tz = _get_local_timezone()
                                    local_ref = ref_dt.astimezone(local_tz)
                                else:
                                    local_ref = ref_dt
                                block_end_time = local_ref.replace(hour=hour, minute=minute, second=0, microsecond=0, tzinfo=None)
                            except (ValueError, IndexError):
                                pass

                        scoring_context = ScoringContext(
                            current_time=forbidden_prog.start_time,
                            block_start_time=block_start_time,
                            block_end_time=block_end_time,
                            is_first_in_block=(prog_idx == 0 or
                                new_programs[prog_idx - 1].block_name != block_name),
                            is_schedule_start=(prog_idx == 0),  # First program of entire schedule
                        )

                        score = self.scoring_engine.score(
                            content, meta, profile, block_dict_for_scoring, scoring_context
                        )

                        # Only use if not forbidden
                        if not score.forbidden_violations:
                            replacement = ScheduledProgram(
                                content=content,
                                content_meta=meta,
                                start_time=forbidden_prog.start_time,
                                end_time=forbidden_prog.start_time + timedelta(
                                    milliseconds=content.get("duration_ms", 0)
                                ),
                                block_name=block_name,
                                position=forbidden_prog.position,
                                score=score,
                                is_replacement=True,
                                replacement_reason="forbidden",
                                replaced_title=forbidden_prog.content.get("title"),
                            )
                            used_content_ids.add(content_id)
                            logger.info(
                                f"Replaced forbidden '{forbidden_prog.content.get('title')}' "
                                f"with '{content.get('title')}' from pre-filtered pool"
                            )
                            break

            # Apply replacement if found
            if replacement:
                new_programs[prog_idx] = replacement
                # Mark old content as available again (remove from used)
                if forbidden_id:
                    used_content_ids.discard(forbidden_id)
                replaced_count += 1
            else:
                logger.warning(
                    f"Could not find replacement for forbidden '{forbidden_prog.content.get('title')}' "
                    f"in block '{block_name}'"
                )

        logger.info(f"Replaced {replaced_count}/{len(forbidden_programs)} forbidden programs")

        # If no replacements were made, return original
        if replaced_count == 0:
            return best_result

        # Recalculate consecutive timings after replacements (programs may have different durations)
        self._recalculate_consecutive_timings(new_programs)

        # Recalculate block names based on new start times
        self._recalculate_block_names(new_programs, profile)

        # Recalculate full scores with new block criteria (important for forbidden detection)
        self._recalculate_full_scores(new_programs, profile)

        # Recalculate timing scores for the new program list
        self._recalculate_timing_scores(new_programs, profile)

        # Recalculate totals after timing recalculation
        # Also recount forbidden programs after full score recalculation
        forbidden_count = sum(1 for p in new_programs if p.score and len(p.score.forbidden_violations) > 0)
        total_score = sum((p.score.total_score or 0.0) for p in new_programs)
        avg_score = total_score / len(new_programs) if new_programs else 0.0

        # Create new optimized result with replaced programs
        return ProgrammingResult(
            programs=new_programs,
            total_score=total_score,
            average_score=avg_score,
            iteration=iteration_number,
            forbidden_count=forbidden_count,
            seed=best_result.seed,
            all_iterations=[],  # Will be set by caller
            is_optimized=True,  # Mark as optimized iteration
            replaced_count=replaced_count,
        )

    def _improve_best_programs(
        self,
        best_result: ProgrammingResult,
        all_results: list[ProgrammingResult],
        randomness: float,
        profile: dict[str, Any],
        iteration_number: int = 0,
    ) -> ProgrammingResult:
        """
        Improve programs in the best iteration by replacing with better ones from other iterations.

        For each program in the best iteration, find programs with higher scores in other iterations
        (same block) and use the randomness factor to select among the best candidates.

        Args:
            best_result: The best programming result to improve
            all_results: All iteration results
            randomness: Randomness factor for selection (0 = always best, 1 = random among candidates)
            profile: Profile configuration for timing recalculation
            iteration_number: Iteration number for the improved result

        Returns:
            Improved ProgrammingResult with is_improved=True if improvements were made
        """
        # Build a map of block_name -> programs from other iterations with their scores
        other_iterations_map: dict[str, list[tuple[ScheduledProgram, ProgrammingResult]]] = {}
        for result in all_results:
            if result.iteration == best_result.iteration:
                continue
            for prog in result.programs:
                block_name = prog.block_name
                if block_name not in other_iterations_map:
                    other_iterations_map[block_name] = []
                other_iterations_map[block_name].append((prog, result))

        # Sort each block's alternatives by score descending
        for block_name in other_iterations_map:
            other_iterations_map[block_name].sort(
                key=lambda x: x[0].score.total_score or 0.0, reverse=True
            )

        # Track used content IDs to avoid duplicates
        used_content_ids: set[str] = set()
        for prog in best_result.programs:
            content_id = prog.content.get("plex_key", prog.content.get("id", ""))
            if content_id:
                used_content_ids.add(content_id)

        # Process each program in the best result
        improved_count = 0
        new_programs = list(best_result.programs)

        for prog_idx, current_prog in enumerate(best_result.programs):
            block_name = current_prog.block_name
            current_score = current_prog.score.total_score or 0.0
            current_id = current_prog.content.get("plex_key", current_prog.content.get("id", ""))

            if block_name not in other_iterations_map:
                continue

            # Find candidates with higher scores that aren't already used and have no forbidden violations
            candidates: list[tuple[ScheduledProgram, ProgrammingResult]] = []
            for alt_prog, alt_result in other_iterations_map[block_name]:
                alt_id = alt_prog.content.get("plex_key", alt_prog.content.get("id", ""))
                alt_score = alt_prog.score.total_score or 0.0
                # Skip programs with forbidden violations
                has_forbidden = len(alt_prog.score.forbidden_violations) > 0 if alt_prog.score else False

                if alt_id and alt_id not in used_content_ids and alt_score > current_score and not has_forbidden:
                    candidates.append((alt_prog, alt_result))

            if not candidates:
                continue

            # Use randomness to select among candidates
            selected = self._select_improvement_with_randomness(candidates, randomness)
            if selected:
                alt_prog, alt_result = selected
                alt_id = alt_prog.content.get("plex_key", alt_prog.content.get("id", ""))

                # Create replacement program with adjusted times
                replacement = ScheduledProgram(
                    content=alt_prog.content,
                    content_meta=alt_prog.content_meta,
                    start_time=current_prog.start_time,
                    end_time=current_prog.start_time + timedelta(
                        milliseconds=alt_prog.content.get("duration_ms", 0)
                    ),
                    block_name=block_name,
                    position=current_prog.position,
                    score=alt_prog.score,
                    is_replacement=True,
                    replacement_reason="improved",
                    replaced_title=current_prog.content.get("title"),
                )

                new_programs[prog_idx] = replacement
                used_content_ids.add(alt_id)
                if current_id:
                    used_content_ids.discard(current_id)
                improved_count += 1

                logger.info(
                    f"Improved '{current_prog.content.get('title')}' (score: {current_score:.1f}) "
                    f"with '{alt_prog.content.get('title')}' (score: {alt_prog.score.total_score:.1f}) "
                    f"from iteration #{alt_result.iteration}"
                )

        if improved_count == 0:
            logger.info("No improvements possible")
            return best_result

        logger.info(f"Improved {improved_count} programs")

        # Recalculate consecutive timings after replacements (programs may have different durations)
        self._recalculate_consecutive_timings(new_programs)

        # Recalculate block names based on new start times
        self._recalculate_block_names(new_programs, profile)

        # Recalculate full scores with new block criteria (important for forbidden detection)
        self._recalculate_full_scores(new_programs, profile)

        # Recalculate timing scores for the new program list
        self._recalculate_timing_scores(new_programs, profile)

        # Recalculate totals after timing recalculation
        # Also count forbidden programs
        forbidden_count = sum(1 for p in new_programs if p.score and len(p.score.forbidden_violations) > 0)
        total_score = sum((p.score.total_score or 0.0) for p in new_programs)
        avg_score = total_score / len(new_programs) if new_programs else 0.0

        return ProgrammingResult(
            programs=new_programs,
            total_score=total_score,
            average_score=avg_score,
            iteration=iteration_number,
            forbidden_count=forbidden_count,
            seed=best_result.seed,
            all_iterations=[],
            is_improved=True,
            improved_count=improved_count,
        )

    def _select_improvement_with_randomness(
        self,
        candidates: list[tuple[ScheduledProgram, ProgrammingResult]],
        randomness: float,
    ) -> tuple[ScheduledProgram, ProgrammingResult] | None:
        """
        Select an improvement candidate using the randomness factor.

        randomness=0: Always pick the best candidate
        randomness=1: Random selection among all candidates
        """
        if not candidates:
            return None

        if randomness <= 0 or len(candidates) == 1:
            return candidates[0]

        # Calculate selection weights based on score and randomness
        max_score = candidates[0][0].score.total_score or 0.0
        weights = []
        for prog, _ in candidates:
            score_val = prog.score.total_score or 0.0
            base_weight = score_val / max(max_score, 1)
            adjusted = base_weight * (1 - randomness) + randomness
            weights.append(adjusted)

        # Normalize weights
        total_weight = sum(weights)
        if total_weight <= 0:
            return candidates[0]

        normalized = [w / total_weight for w in weights]

        # Weighted random selection
        r = random.random()
        cumulative = 0.0
        for i, weight in enumerate(normalized):
            cumulative += weight
            if r <= cumulative:
                return candidates[i]

        return candidates[0]
