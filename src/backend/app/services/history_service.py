"""HistoryService with filter support."""

import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.history import HistoryEntry

logger = logging.getLogger(__name__)


class HistoryService:
    """Service for managing operation history."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize history service."""
        self.session = session

    async def list_history(
        self,
        type_filter: str | None = None,
        channel_id: str | None = None,
        profile_id: str | None = None,
        status: str | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[HistoryEntry]:
        """
        List history entries with filters.

        Args:
            type_filter: Filter by type (programming/scoring)
            channel_id: Filter by channel
            profile_id: Filter by profile
            status: Filter by status (running/success/failed)
            from_date: Filter from date
            to_date: Filter to date
            limit: Maximum results
            offset: Results offset

        Returns:
            List of history entries
        """
        query = select(HistoryEntry)

        conditions = []

        if type_filter:
            conditions.append(HistoryEntry.type == type_filter)

        if channel_id:
            conditions.append(HistoryEntry.channel_id == channel_id)

        if profile_id:
            conditions.append(HistoryEntry.profile_id == profile_id)

        if status:
            conditions.append(HistoryEntry.status == status)

        if from_date:
            conditions.append(HistoryEntry.started_at >= from_date)

        if to_date:
            conditions.append(HistoryEntry.started_at <= to_date)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(HistoryEntry.started_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_history_entry(self, entry_id: str) -> HistoryEntry | None:
        """
        Get a specific history entry.

        Args:
            entry_id: Entry ID

        Returns:
            History entry or None
        """
        return await self.session.get(HistoryEntry, entry_id)

    async def create_entry(
        self,
        entry_type: str,
        channel_id: str | None = None,
        profile_id: str | None = None,
        iterations: int | None = None,
    ) -> HistoryEntry:
        """
        Create a new history entry.

        Args:
            entry_type: Type (programming/scoring)
            channel_id: Optional channel ID
            profile_id: Optional profile ID
            iterations: Optional iteration count

        Returns:
            Created entry
        """
        entry = HistoryEntry(
            type=entry_type,
            channel_id=channel_id,
            profile_id=profile_id,
            started_at=datetime.utcnow(),
            status="running",
            iterations=iterations,
        )

        self.session.add(entry)
        await self.session.commit()
        await self.session.refresh(entry)

        return entry

    async def update_entry(
        self,
        entry_id: str,
        status: str | None = None,
        best_score: float | None = None,
        result_summary: dict[str, Any] | None = None,
        error_message: str | None = None,
    ) -> HistoryEntry | None:
        """
        Update a history entry.

        Args:
            entry_id: Entry ID
            status: New status
            best_score: Best achieved score
            result_summary: Result summary data
            error_message: Error message if failed

        Returns:
            Updated entry or None
        """
        entry = await self.get_history_entry(entry_id)
        if not entry:
            return None

        if status:
            entry.status = status
            if status in ["success", "failed"]:
                entry.completed_at = datetime.utcnow()

        if best_score is not None:
            entry.best_score = best_score

        if result_summary is not None:
            entry.result_summary = result_summary

        if error_message is not None:
            entry.error_message = error_message

        await self.session.commit()
        await self.session.refresh(entry)

        return entry

    async def mark_success(
        self,
        entry_id: str,
        best_score: float,
        result_summary: dict[str, Any] | None = None,
    ) -> HistoryEntry | None:
        """
        Mark an entry as successful.

        Args:
            entry_id: Entry ID
            best_score: Best achieved score
            result_summary: Optional result summary

        Returns:
            Updated entry or None
        """
        return await self.update_entry(
            entry_id,
            status="success",
            best_score=best_score,
            result_summary=result_summary,
        )

    async def mark_failed(
        self,
        entry_id: str,
        error_message: str,
    ) -> HistoryEntry | None:
        """
        Mark an entry as failed.

        Args:
            entry_id: Entry ID
            error_message: Error description

        Returns:
            Updated entry or None
        """
        return await self.update_entry(
            entry_id,
            status="failed",
            error_message=error_message,
        )

    async def get_recent_for_channel(
        self,
        channel_id: str,
        limit: int = 10,
    ) -> list[HistoryEntry]:
        """
        Get recent history for a channel.

        Args:
            channel_id: Channel ID
            limit: Maximum results

        Returns:
            List of recent entries
        """
        return await self.list_history(
            channel_id=channel_id,
            limit=limit,
        )

    async def get_running_entries(self) -> list[HistoryEntry]:
        """
        Get all running entries.

        Returns:
            List of running entries
        """
        return await self.list_history(status="running")

    async def cleanup_old_entries(
        self,
        days: int = 30,
    ) -> int:
        """
        Delete entries older than specified days.

        Args:
            days: Delete entries older than this

        Returns:
            Number of deleted entries
        """
        from datetime import timedelta

        cutoff = datetime.utcnow() - timedelta(days=days)

        query = select(HistoryEntry).where(
            HistoryEntry.started_at < cutoff
        )
        result = await self.session.execute(query)
        entries = result.scalars().all()

        count = len(entries)
        for entry in entries:
            await self.session.delete(entry)

        await self.session.commit()

        logger.info(f"Deleted {count} history entries older than {days} days")
        return count

    def entry_to_response(self, entry: HistoryEntry) -> dict[str, Any]:
        """
        Convert entry to API response.

        Args:
            entry: History entry

        Returns:
            Response dictionary
        """
        return {
            "id": entry.id,
            "type": entry.type,
            "channel_id": entry.channel_id,
            "profile_id": entry.profile_id,
            "started_at": entry.started_at.isoformat(),
            "completed_at": entry.completed_at.isoformat() if entry.completed_at else None,
            "status": entry.status,
            "iterations": entry.iterations,
            "best_score": entry.best_score,
            "result_summary": entry.result_summary,
            "error_message": entry.error_message,
            "duration_seconds": (
                (entry.completed_at - entry.started_at).total_seconds()
                if entry.completed_at else None
            ),
        }
