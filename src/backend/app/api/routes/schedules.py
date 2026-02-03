"""Schedules API routes for managing scheduled tasks."""

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.scheduler import get_scheduler_manager
from app.db.database import get_session
from app.models.profile import Profile
from app.services.schedule_service import ScheduleService
from app.services.service_config_service import ServiceConfigService
from app.services.tunarr_service import TunarrService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/schedules", tags=["schedules"])


class ScheduleCreate(BaseModel):
    """Request to create a schedule."""

    name: str
    description: str | None = None
    schedule_type: Literal["programming", "scoring"]
    channel_id: str
    profile_id: str
    schedule_config: dict[str, Any]
    execution_params: dict[str, Any]
    enabled: bool = True


class ScheduleUpdate(BaseModel):
    """Request to update a schedule."""

    name: str | None = None
    description: str | None = None
    channel_id: str | None = None
    profile_id: str | None = None
    schedule_config: dict[str, Any] | None = None
    execution_params: dict[str, Any] | None = None
    enabled: bool | None = None


class ScheduleToggle(BaseModel):
    """Request to toggle schedule enabled status."""

    enabled: bool


async def enrich_schedule_with_names(
    schedule_response: dict[str, Any],
    session: AsyncSession,
    channels_cache: dict[str, str],
) -> dict[str, Any]:
    """Enrich schedule with channel and profile names."""
    # Get channel name from Tunarr cache
    channel_id = schedule_response.get("channel_id")
    if channel_id:
        if channel_id not in channels_cache:
            try:
                config_service = ServiceConfigService(session)
                config = await config_service.get_service("tunarr")
                if config and config.url:
                    creds = config_service.get_decrypted_credentials(config)
                    tunarr = TunarrService(
                        config.url,
                        config.username,
                        creds.get("password") if creds else None,
                    )
                    channels = await tunarr.get_channels()
                    await tunarr.close()
                    for ch in channels:
                        channels_cache[ch.get("id", "")] = ch.get("name", "Unknown")
            except Exception as e:
                logger.debug(f"Failed to fetch channels for schedules: {e}")
        schedule_response["channel_name"] = channels_cache.get(channel_id, "Unknown")

    # Get profile name from database
    profile_id = schedule_response.get("profile_id")
    if profile_id:
        profile = await session.get(Profile, profile_id)
        schedule_response["profile_name"] = profile.name if profile else "Deleted"

    return schedule_response


@router.get("")
async def list_schedules(
    schedule_type: Literal["programming", "scoring"] | None = Query(
        None, description="Filter by schedule type"
    ),
    channel_id: str | None = Query(None, description="Filter by channel"),
    enabled: bool | None = Query(None, description="Filter by enabled status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """
    List all schedules with optional filters.

    Args:
        schedule_type: Filter by type (programming/scoring)
        channel_id: Filter by channel
        enabled: Filter by enabled status
        limit: Maximum number of results
        offset: Offset for pagination

    Returns:
        List of schedules with resolved names
    """
    service = ScheduleService(session)
    schedules = await service.list_schedules(
        schedule_type=schedule_type,
        channel_id=channel_id,
        enabled=enabled,
        limit=limit,
        offset=offset,
    )

    channels_cache: dict[str, str] = {}
    results = []
    for schedule in schedules:
        response = service.schedule_to_response(schedule)
        enriched = await enrich_schedule_with_names(response, session, channels_cache)
        results.append(enriched)

    return results


@router.get("/{schedule_id}")
async def get_schedule(
    schedule_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Get a specific schedule by ID.

    Args:
        schedule_id: Schedule ID

    Returns:
        Schedule details with resolved names
    """
    service = ScheduleService(session)
    schedule = await service.get_schedule(schedule_id)

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    response = service.schedule_to_response(schedule)
    channels_cache: dict[str, str] = {}
    return await enrich_schedule_with_names(response, session, channels_cache)


@router.post("")
async def create_schedule(
    data: ScheduleCreate,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Create a new schedule.

    Args:
        data: Schedule creation data

    Returns:
        Created schedule with resolved names
    """
    service = ScheduleService(session)

    schedule = await service.create_schedule(
        name=data.name,
        description=data.description,
        schedule_type=data.schedule_type,
        channel_id=data.channel_id,
        profile_id=data.profile_id,
        schedule_config=data.schedule_config,
        execution_params=data.execution_params,
        enabled=data.enabled,
    )

    # Register with scheduler
    scheduler = get_scheduler_manager()
    await scheduler.add_schedule(schedule)

    response = service.schedule_to_response(schedule)
    channels_cache: dict[str, str] = {}
    return await enrich_schedule_with_names(response, session, channels_cache)


@router.put("/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    data: ScheduleUpdate,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Update an existing schedule.

    Args:
        schedule_id: Schedule ID
        data: Update data

    Returns:
        Updated schedule with resolved names
    """
    service = ScheduleService(session)

    schedule = await service.update_schedule(
        schedule_id=schedule_id,
        name=data.name,
        description=data.description,
        channel_id=data.channel_id,
        profile_id=data.profile_id,
        schedule_config=data.schedule_config,
        execution_params=data.execution_params,
        enabled=data.enabled,
    )

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Update in scheduler
    scheduler = get_scheduler_manager()
    await scheduler.add_schedule(schedule)

    response = service.schedule_to_response(schedule)
    channels_cache: dict[str, str] = {}
    return await enrich_schedule_with_names(response, session, channels_cache)


@router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """
    Delete a schedule.

    Args:
        schedule_id: Schedule ID to delete
    """
    service = ScheduleService(session)

    # Remove from scheduler first
    scheduler = get_scheduler_manager()
    await scheduler.remove_schedule(schedule_id)

    deleted = await service.delete_schedule(schedule_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Schedule not found")


@router.post("/{schedule_id}/toggle")
async def toggle_schedule(
    schedule_id: str,
    data: ScheduleToggle,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Toggle schedule enabled status.

    Args:
        schedule_id: Schedule ID
        data: Toggle data

    Returns:
        Updated schedule with resolved names
    """
    service = ScheduleService(session)

    schedule = await service.toggle_schedule(schedule_id, data.enabled)

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Update in scheduler
    scheduler = get_scheduler_manager()
    await scheduler.add_schedule(schedule)

    response = service.schedule_to_response(schedule)
    channels_cache: dict[str, str] = {}
    return await enrich_schedule_with_names(response, session, channels_cache)


@router.post("/{schedule_id}/run-now")
async def run_schedule_now(
    schedule_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Trigger immediate execution of a schedule.

    Args:
        schedule_id: Schedule ID

    Returns:
        Execution status
    """
    service = ScheduleService(session)

    schedule = await service.get_schedule(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    scheduler = get_scheduler_manager()
    await scheduler.run_schedule_now(schedule_id)

    return {
        "status": "triggered",
        "schedule_id": schedule_id,
        "message": f"Schedule '{schedule.name}' triggered for immediate execution",
    }
