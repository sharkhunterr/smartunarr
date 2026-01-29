"""TimingCriterion - Time block overflow, late start, and timing scoring."""

from datetime import datetime, timedelta
from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, ScoringContext


class TimingCriterion(BaseCriterion):
    """Score based on how well content fits in the current time block."""

    name = "timing"
    weight_key = "timing"
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
        Calculate timing score based on block overflow and late start.

        Scoring logic:
        - 100: Content fits perfectly within the block (no overflow, no late start)
        - Decreases proportionally as overflow or late start increases
        - 0: Overflow or late start exceeds maximum tolerance

        Combines:
        - Overflow score (how much content overflows block end)
        - Late start score (how late after block start, for first-in-block only)
        - Time-of-day appropriateness
        """
        if not context or not context.current_time:
            # No timing context, use time-of-day heuristics only
            return self._time_of_day_score(content, block)

        if not context.block_end_time:
            # No block end time, use time-of-day score
            return self._time_of_day_score(content, block)

        # Calculate content end time
        duration_ms = content.get("duration_ms", 0)
        if duration_ms <= 0:
            return 50.0  # No duration info, neutral score

        content_end_time = context.current_time + timedelta(milliseconds=duration_ms)

        # Normalize datetimes to timezone-naive for comparison
        current_time = self._normalize_tz(context.current_time)
        content_end_time = self._normalize_tz(content_end_time)
        block_end = self._normalize_tz(context.block_end_time)
        block_start = self._normalize_tz(context.block_start_time) if context.block_start_time else None

        # Calculate overflow (content end vs block end)
        overflow_minutes = self._calculate_offset_minutes(content_end_time, block_end)
        overflow_score = self._calculate_penalty_score(max(0, overflow_minutes))

        # Calculate late start (only for first program in block)
        late_start_score = 100.0
        if context.is_first_in_block and block_start:
            late_start_minutes = self._calculate_offset_minutes(current_time, block_start)
            # Only penalize if late (positive offset)
            if late_start_minutes > 0:
                late_start_score = self._calculate_penalty_score(late_start_minutes)

        # Time-of-day score
        time_of_day_score = self._time_of_day_score(content, block)

        # Combine scores
        # For first-in-block: 40% overflow + 30% late start + 30% time-of-day
        # For others: 70% overflow + 30% time-of-day
        if context.is_first_in_block:
            final_score = (
                (overflow_score * 0.4) +
                (late_start_score * 0.3) +
                (time_of_day_score * 0.3)
            )
        else:
            final_score = (overflow_score * 0.7) + (time_of_day_score * 0.3)

        return max(0.0, min(100.0, final_score))

    def _normalize_tz(self, dt: datetime | None) -> datetime | None:
        """Normalize datetime to timezone-naive."""
        if dt is None:
            return None
        if hasattr(dt, 'tzinfo') and dt.tzinfo is not None:
            return dt.replace(tzinfo=None)
        return dt

    def _calculate_offset_minutes(self, time1: datetime, time2: datetime) -> float:
        """Calculate offset in minutes (time1 - time2). Positive = time1 is later."""
        delta = time1 - time2
        return delta.total_seconds() / 60

    def _calculate_penalty_score(self, offset_minutes: float) -> float:
        """
        Calculate penalty score based on offset (overflow or late start).

        Scoring:
        - 0 min = 100 points
        - 30 min = ~75 points
        - 60 min = ~50 points
        - 120 min = ~25 points
        - 180+ min = ~5 points
        """
        if offset_minutes <= 0:
            return 100.0
        elif offset_minutes <= 30:
            return 100.0 - (offset_minutes * 0.83)
        elif offset_minutes <= 60:
            return 75.0 - ((offset_minutes - 30) * 0.83)
        elif offset_minutes <= 120:
            return 50.0 - ((offset_minutes - 60) * 0.42)
        elif offset_minutes <= 180:
            return 25.0 - ((offset_minutes - 120) * 0.33)
        else:
            return 5.0

    def _time_of_day_score(
        self,
        content: dict[str, Any],
        block: dict[str, Any] | None = None,
    ) -> float:
        """Calculate time-of-day appropriateness score."""
        if not block:
            return 75.0  # No block context, neutral-positive

        content_type = content.get("type", "").lower()
        start_time_str = block.get("start_time", "00:00")

        # Parse time
        try:
            parts = start_time_str.split(":")
            start_hour = int(parts[0])
        except (ValueError, IndexError):
            return 75.0

        # Time-of-day scoring heuristics
        is_morning = 6 <= start_hour < 12
        is_afternoon = 12 <= start_hour < 18
        is_evening = 18 <= start_hour < 22
        is_night = start_hour >= 22 or start_hour < 6

        # Movies score better in evening/night
        if content_type == "movie":
            if is_evening:
                return 100.0
            if is_night:
                return 90.0
            if is_afternoon:
                return 70.0
            return 50.0  # Morning

        # Episodes score well in all blocks
        if content_type == "episode":
            if is_evening or is_afternoon:
                return 90.0
            return 75.0

        # Trailers/shorts are good fillers
        if content_type == "trailer":
            return 80.0

        return 75.0  # Default acceptable

    def evaluate(
        self,
        content: dict[str, Any],
        content_meta: dict[str, Any] | None,
        profile: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> CriterionResult:
        """Evaluate criterion with optional rules check."""
        # Calculate timing details for display
        details = self._calculate_timing_details(content, block, context)
        score = details.get("final_score", 50.0)
        weight = self.get_weight(profile)

        # Check for per-criterion rules
        # For timing, rules use time periods: "morning", "afternoon", "evening", "night"
        rule_violation = None
        if block:
            block_criteria = block.get("criteria", {})
            timing_rules = block_criteria.get("timing_rules")
            if timing_rules:
                start_time_str = block.get("start_time", "00:00")
                try:
                    parts = start_time_str.split(":")
                    start_hour = int(parts[0])
                except (ValueError, IndexError):
                    start_hour = 12

                # Categorize time of day
                timing_values = []
                if 6 <= start_hour < 12:
                    timing_values.append("morning")
                elif 12 <= start_hour < 18:
                    timing_values.append("afternoon")
                elif 18 <= start_hour < 22:
                    timing_values.append("evening")
                else:
                    timing_values.append("night")
                # Also add hour for precise matching
                timing_values.append(f"{start_hour}h")

                adjustment, rule_violation = self.check_rules(timing_values, timing_rules)
                score += adjustment

        score = max(0.0, min(100.0, score))
        return CriterionResult(
            name=self.name,
            score=score,
            weight=weight,
            weighted_score=score * weight / 100.0,
            details=details,
            rule_violation=rule_violation,
        )

    def _calculate_timing_details(
        self,
        content: dict[str, Any],
        block: dict[str, Any] | None = None,
        context: ScoringContext | None = None,
    ) -> dict[str, Any]:
        """Calculate timing details including overflow and late start for display."""
        details: dict[str, Any] = {
            "is_first_in_block": False,
            "is_last_in_block": False,
            "overflow_minutes": None,
            "late_start_minutes": None,
            "early_start_minutes": None,
            "final_score": 50.0,
        }

        if not context or not context.current_time:
            details["final_score"] = self._time_of_day_score(content, block)
            return details

        if not context.block_end_time:
            details["final_score"] = self._time_of_day_score(content, block)
            return details

        details["is_first_in_block"] = context.is_first_in_block
        details["is_last_in_block"] = context.is_last_in_block

        # Calculate content end time
        duration_ms = content.get("duration_ms", 0)
        if duration_ms <= 0:
            details["final_score"] = 50.0
            return details

        content_end_time = context.current_time + timedelta(milliseconds=duration_ms)

        # Normalize datetimes to timezone-naive for comparison
        current_time = self._normalize_tz(context.current_time)
        content_end_time = self._normalize_tz(content_end_time)
        block_end = self._normalize_tz(context.block_end_time)
        block_start = self._normalize_tz(context.block_start_time) if context.block_start_time else None

        # Calculate overflow for last-in-block (content end vs block end)
        if context.is_last_in_block:
            overflow_minutes = self._calculate_offset_minutes(content_end_time, block_end)
            details["overflow_minutes"] = round(overflow_minutes, 1)

        overflow_score = 100.0
        if context.is_last_in_block:
            overflow_minutes = self._calculate_offset_minutes(content_end_time, block_end)
            overflow_score = self._calculate_penalty_score(max(0, overflow_minutes))

        # Calculate late/early start for first-in-block
        late_start_score = 100.0
        if context.is_first_in_block and block_start:
            start_offset_minutes = self._calculate_offset_minutes(current_time, block_start)
            if start_offset_minutes > 0:
                # Late start (positive = content starts after block start)
                details["late_start_minutes"] = round(start_offset_minutes, 1)
                late_start_score = self._calculate_penalty_score(start_offset_minutes)
            elif start_offset_minutes < 0:
                # Early start (negative = content starts before block start)
                details["early_start_minutes"] = round(abs(start_offset_minutes), 1)

        # Time-of-day score
        time_of_day_score = self._time_of_day_score(content, block)

        # Combine scores
        if context.is_first_in_block:
            final_score = (
                (overflow_score * 0.4) +
                (late_start_score * 0.3) +
                (time_of_day_score * 0.3)
            )
        else:
            final_score = (overflow_score * 0.7) + (time_of_day_score * 0.3)

        details["final_score"] = max(0.0, min(100.0, final_score))
        return details
