"""ResultService for managing programming and scoring results in database."""

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.result import Result

logger = logging.getLogger(__name__)


class ResultService:
    """Service for managing operation results in database."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize result service."""
        self.session = session

    async def save_result(
        self,
        result_id: str,
        result_type: str,
        data: dict[str, Any],
        history_entry_id: str | None = None,
        channel_id: str | None = None,
        profile_id: str | None = None,
    ) -> Result:
        """Save a result to the database.

        Args:
            result_id: Unique result ID
            result_type: Type (programming/scoring)
            data: Full result data
            history_entry_id: Optional link to history entry
            channel_id: Optional channel ID
            profile_id: Optional profile ID

        Returns:
            Created Result object
        """
        result = Result(
            id=result_id,
            type=result_type,
            data=data,
            history_entry_id=history_entry_id,
            channel_id=channel_id,
            profile_id=profile_id,
            created_at=datetime.utcnow(),
        )
        self.session.add(result)
        await self.session.commit()
        await self.session.refresh(result)
        logger.debug(f"Saved {result_type} result {result_id}")
        return result

    async def get_result(self, result_id: str) -> Result | None:
        """Get a result by ID.

        Args:
            result_id: Result ID

        Returns:
            Result or None if not found
        """
        return await self.session.get(Result, result_id)

    async def get_result_data(self, result_id: str) -> dict[str, Any] | None:
        """Get result data by ID.

        Args:
            result_id: Result ID

        Returns:
            Result data dict or None if not found
        """
        result = await self.get_result(result_id)
        if result:
            return result.data
        return None

    async def get_by_history_entry(self, history_entry_id: str) -> Result | None:
        """Get result by history entry ID.

        Args:
            history_entry_id: History entry ID

        Returns:
            Result or None if not found
        """
        query = select(Result).where(Result.history_entry_id == history_entry_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def delete_result(self, result_id: str) -> bool:
        """Delete a result.

        Args:
            result_id: Result ID

        Returns:
            True if deleted
        """
        result = await self.get_result(result_id)
        if result:
            await self.session.delete(result)
            await self.session.commit()
            return True
        return False

    async def cleanup_old_results(self, days: int = 30) -> int:
        """Delete results older than specified days.

        Args:
            days: Delete results older than this

        Returns:
            Number of deleted results
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = delete(Result).where(Result.created_at < cutoff)
        result = await self.session.execute(query)
        await self.session.commit()
        count = result.rowcount
        if count > 0:
            logger.info(f"Deleted {count} results older than {days} days")
        return count
