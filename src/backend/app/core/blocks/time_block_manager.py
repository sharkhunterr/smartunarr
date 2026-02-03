"""TimeBlockManager with midnight spanning support."""

from dataclasses import dataclass, field
from datetime import datetime, time, timedelta, timezone
from typing import Any


# Get local timezone offset
def _get_local_timezone() -> timezone:
    """Get the local timezone based on current DST status."""
    import time as time_module
    # Check if DST is currently in effect (not just if system recognizes DST)
    is_dst_now = time_module.localtime().tm_isdst > 0
    if is_dst_now:
        # Summer time (DST active)
        utc_offset = -time_module.altzone
    else:
        # Winter time (standard time)
        utc_offset = -time_module.timezone
    return timezone(timedelta(seconds=utc_offset))


@dataclass
class TimeBlock:
    """Represents a time block for programming."""

    name: str
    start_time: time
    end_time: time
    criteria: dict[str, Any] = field(default_factory=dict)

    @property
    def spans_midnight(self) -> bool:
        """Check if block spans midnight (end < start)."""
        return self.end_time < self.start_time

    @property
    def duration_minutes(self) -> int:
        """Get block duration in minutes."""
        start_minutes = self.start_time.hour * 60 + self.start_time.minute
        end_minutes = self.end_time.hour * 60 + self.end_time.minute

        if self.spans_midnight:
            # Block spans midnight: e.g., 22:00 to 02:00
            return (24 * 60 - start_minutes) + end_minutes
        else:
            return end_minutes - start_minutes

    def contains_time(self, t: time) -> bool:
        """Check if a time falls within this block."""
        if self.spans_midnight:
            # Block spans midnight: e.g., 22:00 to 02:00
            return t >= self.start_time or t < self.end_time
        else:
            return self.start_time <= t < self.end_time

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "start_time": self.start_time.strftime("%H:%M"),
            "end_time": self.end_time.strftime("%H:%M"),
            "criteria": self.criteria,
            "duration_minutes": self.duration_minutes,
            "spans_midnight": self.spans_midnight,
        }


class TimeBlockManager:
    """Manages time blocks for programming with midnight spanning support."""

    def __init__(self, profile: dict[str, Any]) -> None:
        """
        Initialize from profile configuration.

        Args:
            profile: Profile containing time_blocks configuration
        """
        self.blocks: list[TimeBlock] = []
        self._parse_blocks(profile.get("time_blocks", []))

    def _parse_blocks(self, block_configs: list[dict[str, Any]]) -> None:
        """Parse block configurations into TimeBlock objects."""
        for config in block_configs:
            start_str = config.get("start_time", "00:00")
            end_str = config.get("end_time", "23:59")

            start_time = self._parse_time(start_str)
            end_time = self._parse_time(end_str)

            block = TimeBlock(
                name=config.get("name", "Unnamed"),
                start_time=start_time,
                end_time=end_time,
                criteria=config.get("criteria", {}),
            )
            self.blocks.append(block)

    def _parse_time(self, time_str: str) -> time:
        """Parse time string (HH:MM) to time object."""
        try:
            parts = time_str.split(":")
            return time(int(parts[0]), int(parts[1]))
        except (ValueError, IndexError):
            return time(0, 0)

    def get_block_for_time(self, t: time) -> TimeBlock | None:
        """Get the block that contains the given time."""
        for block in self.blocks:
            if block.contains_time(t):
                return block
        return None

    def get_block_for_datetime(self, dt: datetime) -> TimeBlock | None:
        """Get the block that contains the given datetime.

        Note: Block times are defined in local time, so we convert
        the datetime to local time before checking which block it falls in.
        """
        # Convert to local time if datetime has timezone info
        if dt.tzinfo is not None:
            local_tz = _get_local_timezone()
            local_dt = dt.astimezone(local_tz)
            return self.get_block_for_time(local_dt.time())
        else:
            # Naive datetime, assume it's already in local time
            return self.get_block_for_time(dt.time())

    def get_blocks_in_range(
        self, start_dt: datetime, end_dt: datetime
    ) -> list[tuple[TimeBlock, datetime, datetime]]:
        """
        Get all blocks that fall within a datetime range.

        Returns:
            List of (block, actual_start, actual_end) tuples
        """
        results = []
        current = start_dt

        while current < end_dt:
            block = self.get_block_for_datetime(current)
            if block:
                # Calculate when this block ends
                block_end = self.get_block_end_datetime(current, block)
                actual_end = min(block_end, end_dt)
                results.append((block, current, actual_end))
                current = actual_end
            else:
                # Move to next minute if no block found
                current += timedelta(minutes=1)

        return results

    def get_block_end_datetime(self, current: datetime, block: TimeBlock) -> datetime:
        """Calculate when a block ends given current datetime."""
        current_date = current.date()

        if block.spans_midnight:
            # Block ends after midnight
            if current.time() >= block.start_time:
                # We're before midnight, block ends tomorrow
                end_date = current_date + timedelta(days=1)
            else:
                # We're after midnight, block ends today
                end_date = current_date
        else:
            end_date = current_date

        return datetime.combine(end_date, block.end_time)

    def get_block_start_datetime(self, current: datetime, block: TimeBlock) -> datetime:
        """Calculate when a block starts given current datetime."""
        current_date = current.date()

        if block.spans_midnight:
            # Block starts before midnight
            if current.time() >= block.start_time:
                # We're after block start, block started today
                start_date = current_date
            else:
                # We're after midnight, block started yesterday
                start_date = current_date - timedelta(days=1)
        else:
            start_date = current_date

        return datetime.combine(start_date, block.start_time)

    def generate_schedule_slots(
        self, start_dt: datetime, duration_hours: int = 24
    ) -> list[dict[str, Any]]:
        """
        Generate programming slots for a duration.

        Args:
            start_dt: Start datetime
            duration_hours: How many hours to generate slots for

        Returns:
            List of slot dictionaries with block info and times
        """
        end_dt = start_dt + timedelta(hours=duration_hours)
        slots = []

        for block, slot_start, slot_end in self.get_blocks_in_range(start_dt, end_dt):
            slots.append({
                "block": block.to_dict(),
                "start": slot_start.isoformat(),
                "end": slot_end.isoformat(),
                "duration_minutes": int((slot_end - slot_start).total_seconds() / 60),
            })

        return slots

    def validate_coverage(self) -> tuple[bool, list[str]]:
        """
        Validate that blocks cover the full 24 hours without gaps.

        Returns:
            (is_valid, list of gap descriptions)
        """
        if not self.blocks:
            return False, ["No blocks defined"]

        # Check all 1440 minutes of the day
        covered = [False] * 1440
        for block in self.blocks:
            start_min = block.start_time.hour * 60 + block.start_time.minute
            end_min = block.end_time.hour * 60 + block.end_time.minute

            if block.spans_midnight:
                # Cover from start to midnight
                for i in range(start_min, 1440):
                    covered[i] = True
                # Cover from midnight to end
                for i in range(0, end_min):
                    covered[i] = True
            else:
                for i in range(start_min, end_min):
                    covered[i] = True

        # Find gaps
        gaps = []
        gap_start = None
        for i, is_covered in enumerate(covered):
            if not is_covered and gap_start is None:
                gap_start = i
            elif is_covered and gap_start is not None:
                gap_end = i
                start_time = f"{gap_start // 60:02d}:{gap_start % 60:02d}"
                end_time = f"{gap_end // 60:02d}:{gap_end % 60:02d}"
                gaps.append(f"Gap from {start_time} to {end_time}")
                gap_start = None

        # Check if last gap extends to end of day
        if gap_start is not None:
            start_time = f"{gap_start // 60:02d}:{gap_start % 60:02d}"
            gaps.append(f"Gap from {start_time} to 24:00")

        return len(gaps) == 0, gaps
