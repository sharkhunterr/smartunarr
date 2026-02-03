"""Jobs API routes with SSE for real-time updates."""

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.job_manager import get_job_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])


class CancelJobResponse(BaseModel):
    """Response for job cancellation."""

    success: bool
    message: str


@router.get("/stream")
async def jobs_stream() -> StreamingResponse:
    """
    SSE endpoint for real-time job updates.

    Clients connect to this endpoint to receive Server-Sent Events about
    job status changes.

    Event types:
    - jobs_state: Initial state with all current jobs
    - job_created: A new job was created
    - job_started: A job started running
    - job_progress: Job progress update (progress %, current step, score)
    - job_completed: Job completed successfully
    - job_failed: Job failed with error
    - job_cancelled: Job was cancelled
    """
    manager = get_job_manager()
    queue = await manager.subscribe_sse()

    async def event_generator():
        try:
            while True:
                try:
                    # Wait for messages with timeout for keepalive
                    message = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield message
                except TimeoutError:
                    # Send keepalive comment
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await manager.unsubscribe_sse(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("")
async def list_jobs(limit: int = 20) -> list[dict[str, Any]]:
    """Get recent jobs."""
    manager = get_job_manager()
    jobs = await manager.get_recent_jobs(limit)
    return [job.to_dict() for job in jobs]


@router.get("/active")
async def list_active_jobs() -> list[dict[str, Any]]:
    """Get active (pending or running) jobs."""
    manager = get_job_manager()
    jobs = await manager.get_active_jobs()
    return [job.to_dict() for job in jobs]


@router.get("/{job_id}")
async def get_job(job_id: str) -> dict[str, Any]:
    """Get a specific job by ID."""
    manager = get_job_manager()
    job = await manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_dict()


@router.post("/{job_id}/cancel", response_model=CancelJobResponse)
async def cancel_job(job_id: str) -> CancelJobResponse:
    """Cancel a running or pending job."""
    manager = get_job_manager()
    success = await manager.cancel_job(job_id)

    if success:
        return CancelJobResponse(success=True, message="Job cancelled successfully")
    else:
        job = await manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return CancelJobResponse(
            success=False, message=f"Cannot cancel job in {job.status.value} status"
        )


@router.delete("/completed")
async def clear_completed_jobs() -> dict[str, int]:
    """Clear all completed, failed, or cancelled jobs from memory."""
    manager = get_job_manager()
    removed = await manager.clear_completed_jobs()
    return {"removed": removed}
