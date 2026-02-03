"""ScheduleService for managing scheduled tasks."""

import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schedule import Schedule

logger = logging.getLogger(__name__)


class ScheduleService:
    """Service for CRUD operations on schedules."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize schedule service."""
        self.session = session

    async def list_schedules(
        self,
        schedule_type: str | None = None,
        channel_id: str | None = None,
        profile_id: str | None = None,
        enabled: bool | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Schedule]:
        """
        List schedules with optional filters.

        Args:
            schedule_type: Filter by type (programming/scoring)
            channel_id: Filter by channel
            profile_id: Filter by profile
            enabled: Filter by enabled status
            limit: Maximum results
            offset: Results offset

        Returns:
            List of schedules
        """
        query = select(Schedule)

        conditions = []

        if schedule_type:
            conditions.append(Schedule.schedule_type == schedule_type)

        if channel_id:
            conditions.append(Schedule.channel_id == channel_id)

        if profile_id:
            conditions.append(Schedule.profile_id == profile_id)

        if enabled is not None:
            conditions.append(Schedule.enabled == enabled)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(Schedule.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_schedule(self, schedule_id: str) -> Schedule | None:
        """
        Get a specific schedule.

        Args:
            schedule_id: Schedule ID

        Returns:
            Schedule or None
        """
        return await self.session.get(Schedule, schedule_id)

    async def create_schedule(
        self,
        name: str,
        schedule_type: str,
        channel_id: str,
        profile_id: str | None,
        schedule_config: dict[str, Any],
        execution_params: dict[str, Any],
        description: str | None = None,
        enabled: bool = True,
    ) -> Schedule:
        """
        Create a new schedule.

        Args:
            name: Schedule name
            schedule_type: Type (programming/scoring)
            channel_id: Target channel ID
            profile_id: Profile ID
            schedule_config: Scheduling configuration
            execution_params: Execution parameters
            description: Optional description
            enabled: Whether enabled

        Returns:
            Created schedule
        """
        schedule = Schedule(
            name=name,
            description=description,
            schedule_type=schedule_type,
            channel_id=channel_id,
            profile_id=profile_id,
            schedule_config=schedule_config,
            execution_params=execution_params,
            enabled=enabled,
        )

        self.session.add(schedule)
        await self.session.commit()
        await self.session.refresh(schedule)

        logger.info(f"Created schedule: {schedule.name} ({schedule.id})")
        return schedule

    async def update_schedule(
        self,
        schedule_id: str,
        name: str | None = None,
        description: str | None = None,
        schedule_config: dict[str, Any] | None = None,
        execution_params: dict[str, Any] | None = None,
        enabled: bool | None = None,
        channel_id: str | None = None,
        profile_id: str | None = None,
    ) -> Schedule | None:
        """
        Update a schedule.

        Args:
            schedule_id: Schedule ID
            name: New name
            description: New description
            schedule_config: New scheduling configuration
            execution_params: New execution parameters
            enabled: New enabled status
            channel_id: New channel ID
            profile_id: New profile ID

        Returns:
            Updated schedule or None
        """
        schedule = await self.get_schedule(schedule_id)
        if not schedule:
            return None

        if name is not None:
            schedule.name = name

        if description is not None:
            schedule.description = description

        if schedule_config is not None:
            schedule.schedule_config = schedule_config

        if execution_params is not None:
            schedule.execution_params = execution_params

        if enabled is not None:
            schedule.enabled = enabled

        if channel_id is not None:
            schedule.channel_id = channel_id

        if profile_id is not None:
            schedule.profile_id = profile_id

        await self.session.commit()
        await self.session.refresh(schedule)

        logger.info(f"Updated schedule: {schedule.name} ({schedule.id})")
        return schedule

    async def delete_schedule(self, schedule_id: str) -> bool:
        """
        Delete a schedule.

        Args:
            schedule_id: Schedule ID

        Returns:
            True if deleted, False if not found
        """
        schedule = await self.get_schedule(schedule_id)
        if not schedule:
            return False

        await self.session.delete(schedule)
        await self.session.commit()

        logger.info(f"Deleted schedule: {schedule.name} ({schedule_id})")
        return True

    async def toggle_schedule(
        self, schedule_id: str, enabled: bool
    ) -> Schedule | None:
        """
        Toggle schedule enabled status.

        Args:
            schedule_id: Schedule ID
            enabled: New enabled status

        Returns:
            Updated schedule or None
        """
        return await self.update_schedule(schedule_id, enabled=enabled)

    async def update_execution_status(
        self,
        schedule_id: str,
        status: str,
        next_execution_at: datetime | None,
    ) -> Schedule | None:
        """
        Update execution status after a run.

        Args:
            schedule_id: Schedule ID
            status: Execution status (success/failed/running)
            next_execution_at: Next scheduled execution time

        Returns:
            Updated schedule or None
        """
        schedule = await self.get_schedule(schedule_id)
        if not schedule:
            return None

        schedule.last_execution_at = datetime.utcnow()
        schedule.last_execution_status = status

        if next_execution_at:
            schedule.next_execution_at = next_execution_at

        await self.session.commit()
        await self.session.refresh(schedule)

        return schedule

    def schedule_to_response(self, schedule: Schedule) -> dict[str, Any]:
        """
        Convert schedule to API response.

        Args:
            schedule: Schedule object

        Returns:
            Response dictionary
        """
        return {
            "id": schedule.id,
            "name": schedule.name,
            "description": schedule.description,
            "schedule_type": schedule.schedule_type,
            "channel_id": schedule.channel_id,
            "profile_id": schedule.profile_id,
            "schedule_config": schedule.schedule_config,
            "execution_params": schedule.execution_params,
            "enabled": schedule.enabled,
            "last_execution_at": (
                schedule.last_execution_at.isoformat()
                if schedule.last_execution_at
                else None
            ),
            "last_execution_status": schedule.last_execution_status,
            "next_execution_at": (
                schedule.next_execution_at.isoformat()
                if schedule.next_execution_at
                else None
            ),
            "created_at": schedule.created_at.isoformat(),
            "updated_at": schedule.updated_at.isoformat(),
        }
