"""TimingCriterion - Time block overflow, late start, and timing scoring."""

from datetime import datetime, timedelta
from typing import Any

from app.core.scoring.base_criterion import BaseCriterion, CriterionResult, RuleViolation, ScoringContext


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
        - Late start score (how late after block start)
        - Time-of-day appropriateness
        """
        # Use _calculate_timing_details for consistent logic
        details = self._calculate_timing_details(content, block, context)
        return details.get("final_score", 50.0)

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
        Fallback when no timing_rules defined.

        More aggressive scoring:
        - 0 min = 100 points
        - 15 min = ~75 points
        - 30 min = ~50 points
        - 60 min = ~25 points
        - 90+ min = ~5 points
        """
        if offset_minutes <= 0:
            return 100.0
        elif offset_minutes <= 15:
            # 100 -> 75 over 15 min (1.67 pts/min)
            return 100.0 - (offset_minutes * 1.67)
        elif offset_minutes <= 30:
            # 75 -> 50 over 15 min (1.67 pts/min)
            return 75.0 - ((offset_minutes - 15) * 1.67)
        elif offset_minutes <= 60:
            # 50 -> 25 over 30 min (0.83 pts/min)
            return 50.0 - ((offset_minutes - 30) * 0.83)
        elif offset_minutes <= 90:
            # 25 -> 5 over 30 min (0.67 pts/min)
            return 25.0 - ((offset_minutes - 60) * 0.67)
        else:
            return 5.0

    def _calculate_adaptive_timing_score(
        self,
        offset_minutes: float,
        preferred_max: float | None,
        mandatory_max: float | None,
        forbidden_max: float | None,
    ) -> float:
        """
        Calculate adaptive timing score based on P/M/F thresholds.

        Creates a smooth curve between the thresholds:
        - 0 min → 100 pts (perfect timing)
        - 0 to P → 100 → 85 pts (within preferred, small decrease)
        - P to M → 85 → 50 pts (within mandatory, moderate decrease)
        - M to F → 50 → 5 pts (beyond mandatory, steep decrease)
        - > F → 0 pts (forbidden zone)

        The M/F/P bonuses/penalties are applied separately in evaluate().
        """
        if offset_minutes <= 0:
            return 100.0

        # Default thresholds if not defined
        p_max = preferred_max if preferred_max is not None else 5.0
        m_max = mandatory_max if mandatory_max is not None else 15.0
        f_max = forbidden_max if forbidden_max is not None else 60.0

        # Ensure logical ordering: P <= M <= F
        p_max = min(p_max, m_max, f_max)
        m_max = max(p_max, min(m_max, f_max))
        f_max = max(m_max, f_max)

        # Anchor points for the curve
        score_at_0 = 100.0
        score_at_p = 85.0   # End of preferred zone
        score_at_m = 50.0   # End of mandatory zone
        score_at_f = 5.0    # Just before forbidden
        score_beyond_f = 0.0

        # Zone 1: 0 to P (preferred zone) - small decrease
        if offset_minutes <= p_max:
            if p_max > 0:
                # Linear interpolation from 100 to 85
                ratio = offset_minutes / p_max
                return score_at_0 - (score_at_0 - score_at_p) * ratio
            return score_at_0

        # Zone 2: P to M (mandatory zone) - moderate decrease
        if offset_minutes <= m_max:
            if m_max > p_max:
                # Linear interpolation from 85 to 50
                ratio = (offset_minutes - p_max) / (m_max - p_max)
                return score_at_p - (score_at_p - score_at_m) * ratio
            return score_at_p

        # Zone 3: M to F (post-mandatory zone) - steep decrease
        if offset_minutes <= f_max:
            if f_max > m_max:
                # Linear interpolation from 50 to 5
                ratio = (offset_minutes - m_max) / (f_max - m_max)
                return score_at_m - (score_at_m - score_at_f) * ratio
            return score_at_m

        # Zone 4: Beyond F (forbidden zone)
        return score_beyond_f

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
        weight = self.get_weight(profile)
        multiplier = self.get_multiplier(profile, block)
        mfp_policy = self.get_mfp_policy(profile, block)

        # For middle programs, timing criterion is skipped (not applicable)
        if details.get("skipped", False):
            return CriterionResult(
                name=self.name,
                score=0.0,  # No score
                weight=0.0,  # Zero weight so it doesn't count in total
                weighted_score=0.0,
                multiplier=multiplier,
                multiplied_weighted_score=0.0,
                details=details,
                rule_violation=None,
                skipped=True,
            )

        # Check for per-criterion rules (minute-based M/F/P with adaptive curve)
        # timing_rules uses minute thresholds: preferred_max_minutes, mandatory_max_minutes, forbidden_max_minutes
        # For first-in-block: checks late_start_minutes
        # For last-in-block: checks overflow_minutes
        rule_violation = None
        score = details.get("final_score", 50.0)  # Default fallback

        if block:
            block_criteria = block.get("criteria", {})
            timing_rules = block_criteria.get("timing_rules")

            # Get the relevant offset in minutes based on position in block
            is_first = details.get("is_first_in_block", False)
            is_last = details.get("is_last_in_block", False)

            # Determine the offset to check
            offset_minutes = 0.0
            offset_type = None
            if is_first and is_last:
                # Single program: use the worse of late start or overflow
                late = details.get("late_start_minutes") or 0.0
                overflow = details.get("overflow_minutes") or 0.0
                if late >= overflow:
                    offset_minutes = late
                    offset_type = "late_start"
                else:
                    offset_minutes = overflow
                    offset_type = "overflow"
            elif is_first:
                offset_minutes = details.get("late_start_minutes") or 0.0
                offset_type = "late_start"
            elif is_last:
                offset_minutes = details.get("overflow_minutes") or 0.0
                offset_type = "overflow"

            if timing_rules and offset_type:
                # Get thresholds
                forbidden_max = timing_rules.get("forbidden_max_minutes")
                mandatory_max = timing_rules.get("mandatory_max_minutes")
                preferred_max = timing_rules.get("preferred_max_minutes")

                # Calculate base score using adaptive curve (0→100, P→85, M→50, F→5, >F→0)
                score = self._calculate_adaptive_timing_score(
                    offset_minutes,
                    preferred_max,
                    mandatory_max,
                    forbidden_max,
                )

                # Apply M/F/P bonuses/penalties on top of the curve score
                # Zone 1: Within preferred (offset <= P) → +preferred_bonus
                if preferred_max is not None and offset_minutes <= preferred_max:
                    bonus = timing_rules.get("preferred_bonus", mfp_policy.preferred_matched_bonus)
                    rule_violation = RuleViolation(
                        "preferred",
                        [f"{offset_type}:{offset_minutes:.0f}min ≤ {preferred_max:.0f}min"],
                        bonus
                    )
                    score += bonus

                # Zone 2: Within mandatory but beyond preferred (P < offset <= M) → small bonus
                elif mandatory_max is not None and offset_minutes <= mandatory_max:
                    bonus = mfp_policy.mandatory_matched_bonus
                    rule_violation = RuleViolation(
                        "mandatory",
                        [f"{offset_type}:{offset_minutes:.0f}min ≤ {mandatory_max:.0f}min"],
                        bonus
                    )
                    score += bonus

                # Zone 3: Beyond mandatory but within forbidden (M < offset <= F) → penalty
                elif forbidden_max is not None and mandatory_max is not None and offset_minutes <= forbidden_max:
                    penalty = timing_rules.get("mandatory_penalty", mfp_policy.mandatory_missed_penalty)
                    rule_violation = RuleViolation(
                        "mandatory",
                        [f"{offset_type}:{offset_minutes:.0f}min > {mandatory_max:.0f}min"],
                        penalty
                    )
                    score += penalty

                # Zone 4: Beyond forbidden (offset > F) → heavy penalty + exclusion
                elif forbidden_max is not None and offset_minutes > forbidden_max:
                    penalty = timing_rules.get("forbidden_penalty", mfp_policy.forbidden_detected_penalty)
                    rule_violation = RuleViolation(
                        "forbidden",
                        [f"{offset_type}:{offset_minutes:.0f}min > {forbidden_max:.0f}min"],
                        penalty
                    )
                    score += penalty

                # Store adaptive score details for frontend
                details["adaptive_score"] = {
                    "offset_minutes": offset_minutes,
                    "offset_type": offset_type,
                    "base_curve_score": self._calculate_adaptive_timing_score(
                        offset_minutes, preferred_max, mandatory_max, forbidden_max
                    ),
                    "mfp_adjustment": rule_violation.penalty_or_bonus if rule_violation else 0,
                    "final_score": score,
                }

        score = max(0.0, min(100.0, score))

        # For timing, the multiplier amplifies the PENALTY (deficit from 100)
        # This makes multiplier > 1.0 increase the negative impact of late/overflow
        # Example: score 50 with multiplier 1.2 → deficit 50 * 1.2 = 60 → adjusted score 40
        deficit = 100.0 - score
        amplified_deficit = deficit * multiplier
        adjusted_score = max(0.0, min(100.0, 100.0 - amplified_deficit))

        weighted_score = adjusted_score * weight / 100.0
        return CriterionResult(
            name=self.name,
            score=adjusted_score,  # Use adjusted score (with multiplier applied to penalty)
            weight=weight,
            weighted_score=weighted_score,
            multiplier=multiplier,
            multiplied_weighted_score=weighted_score,  # Already includes multiplier effect
            details=details,
            rule_violation=rule_violation,
        )

    def _parse_content_datetime(self, dt_str: str | None) -> datetime | None:
        """Parse ISO datetime string from content."""
        if not dt_str:
            return None
        try:
            # Handle various ISO formats
            dt_str = dt_str.replace("Z", "+00:00")
            return datetime.fromisoformat(dt_str)
        except (ValueError, TypeError):
            return None

    def _build_block_datetime(self, time_str: str, reference_dt: datetime) -> datetime | None:
        """Build a full datetime from block time string (HH:MM) using reference date."""
        if not time_str:
            return None
        try:
            parts = time_str.split(":")
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
            return reference_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
        except (ValueError, IndexError, TypeError):
            return None

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
            "skipped": False,  # True for middle programs (not first, not last)
        }

        # Try to get timing from context first, then from content
        current_time = None
        content_end_time = None
        block_start = None
        block_end = None
        is_first = False
        is_last = False

        if context:
            current_time = self._normalize_tz(context.current_time)
            block_start = self._normalize_tz(context.block_start_time)
            block_end = self._normalize_tz(context.block_end_time)
            is_first = context.is_first_in_block
            is_last = context.is_last_in_block

        # If context doesn't have timing, try to get from content
        if not current_time:
            current_time = self._normalize_tz(self._parse_content_datetime(content.get("start_time")))

        if not content_end_time:
            content_end_time = self._normalize_tz(self._parse_content_datetime(content.get("end_time")))

        # Calculate content end from duration if not available
        if current_time and not content_end_time:
            duration_ms = content.get("duration_ms", 0)
            if duration_ms > 0:
                content_end_time = current_time + timedelta(milliseconds=duration_ms)

        # Build block times from block HH:MM strings if not in context
        if block and current_time:
            block_start_str = block.get("start_time", "00:00")
            block_end_str = block.get("end_time", "00:00")

            try:
                block_start_h, block_start_m = map(int, block_start_str.split(":"))
                block_end_h, block_end_m = map(int, block_end_str.split(":"))
            except (ValueError, TypeError):
                block_start_h, block_start_m = 0, 0
                block_end_h, block_end_m = 0, 0

            prog_time_minutes = current_time.hour * 60 + current_time.minute
            block_start_minutes = block_start_h * 60 + block_start_m
            block_end_minutes = block_end_h * 60 + block_end_m

            # Determine if this is an overnight block (end < start in 24h clock)
            is_overnight_block = block_end_minutes < block_start_minutes

            if not block_start or not block_end:
                if is_overnight_block:
                    # For overnight blocks, determine if program is in "before midnight"
                    # or "after midnight" part
                    if prog_time_minutes >= block_start_minutes:
                        # Program is in "before midnight" part (e.g., 23:30 in 23:00-07:00)
                        block_start = self._build_block_datetime(block_start_str, current_time)
                        block_end = self._build_block_datetime(block_end_str, current_time)
                        if block_end:
                            block_end = block_end + timedelta(days=1)
                    else:
                        # Program is in "after midnight" part (e.g., 05:47 in 23:00-07:00)
                        block_start = self._build_block_datetime(block_start_str, current_time)
                        if block_start:
                            block_start = block_start - timedelta(days=1)
                        block_end = self._build_block_datetime(block_end_str, current_time)
                else:
                    # Normal daytime block
                    if not block_start:
                        block_start = self._build_block_datetime(block_start_str, current_time)
                    if not block_end:
                        block_end = self._build_block_datetime(block_end_str, current_time)

        # If we still don't have timing info, use time-of-day score only
        if not current_time or not block:
            details["final_score"] = self._time_of_day_score(content, block)
            return details

        details["is_first_in_block"] = is_first
        details["is_last_in_block"] = is_last

        # For middle programs (not first, not last): timing criterion is not applicable
        # Only first and last programs are affected by late start / overflow
        if not is_first and not is_last:
            details["skipped"] = True
            details["final_score"] = None  # No score for middle programs
            return details

        # Time-of-day score (only for first/last programs)
        time_of_day_score = self._time_of_day_score(content, block)

        # Get timing rules for adaptive scoring
        timing_rules = None
        if block:
            block_criteria = block.get("criteria", {})
            timing_rules = block_criteria.get("timing_rules")

        # Calculate late start ONLY for first-in-block
        late_start_offset = 0.0
        late_start_score = 100.0
        if is_first and block_start:
            start_offset_minutes = self._calculate_offset_minutes(current_time, block_start)
            if start_offset_minutes > 2:  # More than 2 min late
                late_start_offset = start_offset_minutes
                details["late_start_minutes"] = round(start_offset_minutes, 1)
                if timing_rules:
                    # Use adaptive curve
                    late_start_score = self._calculate_adaptive_timing_score(
                        start_offset_minutes,
                        timing_rules.get("preferred_max_minutes"),
                        timing_rules.get("mandatory_max_minutes"),
                        timing_rules.get("forbidden_max_minutes"),
                    )
                else:
                    late_start_score = self._calculate_penalty_score(start_offset_minutes)
            elif start_offset_minutes < -2:  # More than 2 min early
                details["early_start_minutes"] = round(abs(start_offset_minutes), 1)

        # Calculate overflow ONLY for last-in-block
        overflow_offset = 0.0
        overflow_score = 100.0
        if is_last and content_end_time and block_end:
            overflow_minutes = self._calculate_offset_minutes(content_end_time, block_end)
            if overflow_minutes > 2:  # More than 2 min overflow
                overflow_offset = overflow_minutes
                details["overflow_minutes"] = round(overflow_minutes, 1)
                if timing_rules:
                    # Use adaptive curve
                    overflow_score = self._calculate_adaptive_timing_score(
                        overflow_minutes,
                        timing_rules.get("preferred_max_minutes"),
                        timing_rules.get("mandatory_max_minutes"),
                        timing_rules.get("forbidden_max_minutes"),
                    )
                else:
                    overflow_score = self._calculate_penalty_score(overflow_minutes)

        # Combine scores based on position in block
        if is_first and is_last:
            # Single program in block: both late start and overflow matter equally
            # Weight: 45% late start + 45% overflow + 10% time-of-day
            final_score = (
                (late_start_score * 0.45) +
                (overflow_score * 0.45) +
                (time_of_day_score * 0.10)
            )
        elif is_first:
            # First in block: only late start matters for timing
            # Weight: 80% late start + 20% time-of-day
            final_score = (
                (late_start_score * 0.80) +
                (time_of_day_score * 0.20)
            )
        else:  # is_last
            # Last in block: only overflow matters for timing
            # Weight: 80% overflow + 20% time-of-day
            final_score = (
                (overflow_score * 0.80) +
                (time_of_day_score * 0.20)
            )

        details["final_score"] = max(0.0, min(100.0, final_score))

        # Add timing rules thresholds to details for frontend display
        if block:
            block_criteria = block.get("criteria", {})
            timing_rules = block_criteria.get("timing_rules")
            if timing_rules:
                details["timing_rules"] = {
                    "preferred_max_minutes": timing_rules.get("preferred_max_minutes"),
                    "mandatory_max_minutes": timing_rules.get("mandatory_max_minutes"),
                    "forbidden_max_minutes": timing_rules.get("forbidden_max_minutes"),
                }

        return details
