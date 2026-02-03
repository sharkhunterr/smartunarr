"""History API routes for operation tracking."""

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.models.profile import Profile
from app.models.schedule import Schedule
from app.services.history_service import HistoryService
from app.services.service_config_service import ServiceConfigService
from app.services.tunarr_service import TunarrService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history", tags=["history"])


async def enrich_entry_with_names(
    entry_response: dict[str, Any],
    session: AsyncSession,
    channels_cache: dict[str, str],
) -> dict[str, Any]:
    """Enrich history entry with channel and profile names."""
    # Get channel name from Tunarr cache
    channel_id = entry_response.get("channel_id")
    if channel_id:
        if channel_id not in channels_cache:
            try:
                # Get Tunarr config from database
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
                logger.debug(f"Failed to fetch channels for history: {e}")
        entry_response["channel_name"] = channels_cache.get(channel_id, "Unknown")

    # Get profile name from database
    profile_id = entry_response.get("profile_id")
    if profile_id:
        profile = await session.get(Profile, profile_id)
        entry_response["profile_name"] = profile.name if profile else "Deleted"

    # Get schedule name from database
    schedule_id = entry_response.get("schedule_id")
    if schedule_id:
        schedule = await session.get(Schedule, schedule_id)
        entry_response["schedule_name"] = schedule.name if schedule else "Deleted"

    # Map API fields to frontend expected fields
    entry_response["created_at"] = entry_response.get("started_at")
    entry_response["duration_sec"] = entry_response.get("duration_seconds")
    entry_response["score"] = entry_response.get("best_score")
    entry_response["error"] = entry_response.get("error_message")

    # Extract result_id from result_summary if present
    result_summary = entry_response.get("result_summary")
    if result_summary and isinstance(result_summary, dict):
        entry_response["result_id"] = result_summary.get("result_id")

    return entry_response


@router.get("")
async def list_history(
    type: Literal["programming", "scoring", "ai_generation"] | None = Query(
        None, description="Filter by operation type"
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """
    List history entries with optional filters.

    Args:
        type: Filter by operation type
        limit: Maximum number of results
        offset: Offset for pagination

    Returns:
        List of history entries with resolved names
    """
    service = HistoryService(session)
    entries = await service.list_history(
        type_filter=type,
        limit=limit,
        offset=offset,
    )

    # Build responses with enriched names
    channels_cache: dict[str, str] = {}
    results = []
    for entry in entries:
        response = service.entry_to_response(entry)
        enriched = await enrich_entry_with_names(response, session, channels_cache)
        results.append(enriched)

    return results


@router.get("/{entry_id}")
async def get_history_entry(
    entry_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Get a specific history entry by ID.

    Args:
        entry_id: Entry ID

    Returns:
        History entry details with resolved names
    """
    service = HistoryService(session)
    entry = await service.get_history_entry(entry_id)

    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")

    response = service.entry_to_response(entry)
    channels_cache: dict[str, str] = {}
    return await enrich_entry_with_names(response, session, channels_cache)


@router.delete("/{entry_id}", status_code=204)
async def delete_history_entry(
    entry_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """
    Delete a specific history entry.

    Args:
        entry_id: Entry ID to delete
    """
    service = HistoryService(session)
    entry = await service.get_history_entry(entry_id)

    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")

    await session.delete(entry)
    await session.commit()


@router.delete("")
async def clear_history(
    type: Literal["programming", "scoring", "ai_generation"] | None = Query(
        None, description="Clear only entries of this type"
    ),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Clear history entries.

    Args:
        type: If provided, only clear entries of this type

    Returns:
        Count of deleted entries
    """
    service = HistoryService(session)
    entries = await service.list_history(type_filter=type, limit=1000)

    count = 0
    for entry in entries:
        await session.delete(entry)
        count += 1

    await session.commit()

    return {"deleted": count}


@router.get("/stats/summary")
async def get_history_stats(
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Get summary statistics for history.

    Returns:
        Summary statistics
    """
    service = HistoryService(session)

    # Get recent entries
    all_entries = await service.list_history(limit=1000)

    # Calculate stats
    total = len(all_entries)
    by_type = {}
    by_status = {}
    successful = 0
    failed = 0
    total_duration = 0.0

    for entry in all_entries:
        # Count by type
        entry_type = entry.type or "unknown"
        by_type[entry_type] = by_type.get(entry_type, 0) + 1

        # Count by status
        status = entry.status or "unknown"
        by_status[status] = by_status.get(status, 0) + 1

        if status == "success":
            successful += 1
        elif status == "failed":
            failed += 1

        # Sum durations
        if entry.completed_at and entry.started_at:
            duration = (entry.completed_at - entry.started_at).total_seconds()
            total_duration += duration

    avg_duration = total_duration / successful if successful > 0 else 0

    return {
        "total_entries": total,
        "by_type": by_type,
        "by_status": by_status,
        "successful": successful,
        "failed": failed,
        "success_rate": successful / total if total > 0 else 0,
        "average_duration_seconds": avg_duration,
    }
