"""History API routes for operation tracking."""

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.services.history_service import HistoryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history", tags=["history"])


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
        List of history entries
    """
    service = HistoryService(session)
    entries = await service.list_history(
        type_filter=type,
        limit=limit,
        offset=offset,
    )

    return [service.entry_to_response(entry) for entry in entries]


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
        History entry details
    """
    service = HistoryService(session)
    entry = await service.get_history_entry(entry_id)

    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")

    return service.entry_to_response(entry)


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
