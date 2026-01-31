"""Logs API routes for viewing application logs."""

import logging
from collections import deque
from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Query

router = APIRouter(prefix="/logs", tags=["logs"])

# In-memory log storage (ring buffer)
MAX_LOGS = 1000
_log_entries: deque[dict[str, Any]] = deque(maxlen=MAX_LOGS)


class InMemoryLogHandler(logging.Handler):
    """Custom log handler that stores logs in memory."""

    def emit(self, record: logging.LogRecord) -> None:
        """Store log record in memory."""
        try:
            # Map logging levels to our level names
            level_map = {
                logging.DEBUG: "debug",
                logging.INFO: "info",
                logging.WARNING: "warning",
                logging.ERROR: "error",
                logging.CRITICAL: "error",
            }

            entry = {
                "id": str(uuid4()),
                "timestamp": datetime.fromtimestamp(record.created).isoformat(),
                "level": level_map.get(record.levelno, "info"),
                "message": record.getMessage(),
                "source": record.name.replace("app.", "").split(".")[0] if record.name.startswith("app.") else record.name,
            }

            # Add exception info if present
            if record.exc_info:
                import traceback
                entry["message"] += "\n" + "".join(traceback.format_exception(*record.exc_info))

            _log_entries.append(entry)
        except Exception:
            pass  # Don't let logging errors crash the app


def setup_log_handler() -> None:
    """Setup the in-memory log handler on the root logger."""
    handler = InMemoryLogHandler()
    handler.setLevel(logging.DEBUG)

    # Add to root logger to capture all logs
    root_logger = logging.getLogger()
    root_logger.addHandler(handler)

    # Also add to uvicorn loggers
    for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
        uvicorn_logger = logging.getLogger(logger_name)
        uvicorn_logger.addHandler(handler)


# Setup handler on module load
setup_log_handler()


@router.get("")
async def get_logs(
    level: str | None = Query(None, description="Filter by level"),
    source: str | None = Query(None, description="Filter by source"),
    search: str | None = Query(None, description="Search in message"),
    limit: int = Query(100, ge=1, le=1000, description="Max entries"),
    offset: int = Query(0, ge=0, description="Skip entries"),
) -> dict[str, Any]:
    """
    Get application logs.

    Returns recent log entries with optional filtering.
    """
    # Convert deque to list for slicing
    logs = list(_log_entries)

    # Apply filters
    if level and level != "all":
        logs = [log for log in logs if log["level"] == level]

    if source:
        logs = [log for log in logs if source.lower() in (log.get("source") or "").lower()]

    if search:
        search_lower = search.lower()
        logs = [log for log in logs if search_lower in log["message"].lower()]

    # Sort by timestamp descending (newest first)
    logs.sort(key=lambda x: x["timestamp"], reverse=True)

    # Apply pagination
    total = len(logs)
    logs = logs[offset:offset + limit]

    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.delete("")
async def clear_logs() -> dict[str, str]:
    """Clear all logs from memory."""
    _log_entries.clear()
    return {"status": "ok", "message": "Logs cleared"}


@router.delete("/cleanup")
async def cleanup_logs(
    retention_days: int = Query(30, ge=1, le=365, description="Delete logs older than this many days"),
) -> dict[str, Any]:
    """Clean up logs older than the specified retention period."""
    from datetime import timedelta

    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    cutoff_iso = cutoff.isoformat()

    # Count logs before cleanup
    total_before = len(_log_entries)

    # Keep only logs newer than cutoff
    global _log_entries
    new_entries = deque(
        (entry for entry in _log_entries if entry["timestamp"] >= cutoff_iso),
        maxlen=MAX_LOGS
    )

    deleted_count = total_before - len(new_entries)
    _log_entries = new_entries

    return {
        "status": "ok",
        "deleted": deleted_count,
        "remaining": len(_log_entries),
        "retention_days": retention_days,
    }


@router.get("/export")
async def export_logs(
    level: str | None = Query(None),
) -> dict[str, Any]:
    """Export all logs as JSON."""
    logs = list(_log_entries)

    if level and level != "all":
        logs = [log for log in logs if log["level"] == level]

    logs.sort(key=lambda x: x["timestamp"], reverse=True)

    return {"logs": logs, "exported_at": datetime.utcnow().isoformat()}
