"""WebSocket connection manager for real-time progress updates."""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class JobType(str, Enum):
    """Types of background jobs."""

    PROGRAMMING = "programming"
    SCORING = "scoring"
    SYNC = "sync"
    AI_GENERATION = "ai_generation"
    PREVIEW = "preview"


class JobStatus(str, Enum):
    """Job status values."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Job:
    """Represents a background job."""

    id: str
    type: JobType
    status: JobStatus
    title: str
    progress: float = 0.0
    current_step: str = ""
    best_score: float | None = None
    current_iteration: int | None = None
    total_iterations: int | None = None
    channel_id: str | None = None
    profile_id: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None
    result: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert job to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "type": self.type.value,
            "status": self.status.value,
            "title": self.title,
            "progress": self.progress,
            "currentStep": self.current_step,
            "bestScore": self.best_score,
            "currentIteration": self.current_iteration,
            "totalIterations": self.total_iterations,
            "channelId": self.channel_id,
            "profileId": self.profile_id,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "errorMessage": self.error_message,
            "result": self.result,
        }


class WebSocketManager:
    """Manages WebSocket connections and broadcasts job updates."""

    def __init__(self) -> None:
        """Initialize the WebSocket manager."""
        self._connections: list[WebSocket] = []
        self._jobs: dict[str, Job] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self._connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self._connections)}")

        # Send current jobs state
        await self._send_to_client(
            websocket,
            {
                "type": "jobs_state",
                "jobs": [job.to_dict() for job in self._jobs.values()],
            },
        )

    async def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        async with self._lock:
            if websocket in self._connections:
                self._connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self._connections)}")

    async def _send_to_client(self, websocket: WebSocket, data: dict[str, Any]) -> None:
        """Send data to a specific client."""
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.error(f"Error sending to WebSocket: {e}")
            await self.disconnect(websocket)

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Broadcast data to all connected clients."""
        async with self._lock:
            connections = list(self._connections)

        for websocket in connections:
            await self._send_to_client(websocket, data)

    async def create_job(
        self,
        job_type: JobType,
        title: str,
        channel_id: str | None = None,
        profile_id: str | None = None,
        total_iterations: int | None = None,
    ) -> str:
        """Create a new job and broadcast its creation."""
        job_id = str(uuid4())
        job = Job(
            id=job_id,
            type=job_type,
            status=JobStatus.PENDING,
            title=title,
            channel_id=channel_id,
            profile_id=profile_id,
            total_iterations=total_iterations,
        )

        async with self._lock:
            self._jobs[job_id] = job

        await self.broadcast(
            {
                "type": "job_created",
                "job": job.to_dict(),
            }
        )

        logger.info(f"Created job {job_id}: {title}")
        return job_id

    async def start_job(self, job_id: str) -> None:
        """Mark a job as started."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.status = JobStatus.RUNNING
                job.started_at = datetime.utcnow()

        if job:
            await self.broadcast(
                {
                    "type": "job_started",
                    "job": job.to_dict(),
                }
            )
            logger.info(f"Started job {job_id}")

    async def update_job_progress(
        self,
        job_id: str,
        progress: float,
        current_step: str = "",
        best_score: float | None = None,
        current_iteration: int | None = None,
    ) -> None:
        """Update job progress and broadcast the update."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.progress = progress
                if current_step:
                    job.current_step = current_step
                if best_score is not None:
                    job.best_score = best_score
                if current_iteration is not None:
                    job.current_iteration = current_iteration

        if job:
            await self.broadcast(
                {
                    "type": "job_progress",
                    "job": job.to_dict(),
                }
            )

    async def complete_job(
        self,
        job_id: str,
        result: dict[str, Any] | None = None,
        best_score: float | None = None,
    ) -> None:
        """Mark a job as completed."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.status = JobStatus.COMPLETED
                job.progress = 100.0
                job.completed_at = datetime.utcnow()
                if result:
                    job.result = result
                if best_score is not None:
                    job.best_score = best_score

        if job:
            await self.broadcast(
                {
                    "type": "job_completed",
                    "job": job.to_dict(),
                }
            )
            logger.info(f"Completed job {job_id}")

    async def fail_job(self, job_id: str, error_message: str) -> None:
        """Mark a job as failed."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.status = JobStatus.FAILED
                job.completed_at = datetime.utcnow()
                job.error_message = error_message

        if job:
            await self.broadcast(
                {
                    "type": "job_failed",
                    "job": job.to_dict(),
                }
            )
            logger.error(f"Failed job {job_id}: {error_message}")

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if job and job.status in [JobStatus.PENDING, JobStatus.RUNNING]:
                job.status = JobStatus.CANCELLED
                job.completed_at = datetime.utcnow()

                await self.broadcast(
                    {
                        "type": "job_cancelled",
                        "job": job.to_dict(),
                    }
                )
                logger.info(f"Cancelled job {job_id}")
                return True

        return False

    async def get_job(self, job_id: str) -> Job | None:
        """Get a job by ID."""
        async with self._lock:
            return self._jobs.get(job_id)

    async def get_active_jobs(self) -> list[Job]:
        """Get all active (pending or running) jobs."""
        async with self._lock:
            return [
                job
                for job in self._jobs.values()
                if job.status in [JobStatus.PENDING, JobStatus.RUNNING]
            ]

    async def get_recent_jobs(self, limit: int = 10) -> list[Job]:
        """Get recent jobs."""
        async with self._lock:
            jobs = sorted(
                self._jobs.values(),
                key=lambda j: j.created_at,
                reverse=True,
            )
            return jobs[:limit]

    async def cleanup_old_jobs(self, max_age_hours: int = 24) -> int:
        """Remove jobs older than specified hours."""
        from datetime import timedelta

        cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
        removed = 0

        async with self._lock:
            jobs_to_remove = [
                job_id
                for job_id, job in self._jobs.items()
                if job.completed_at and job.completed_at < cutoff
            ]
            for job_id in jobs_to_remove:
                del self._jobs[job_id]
                removed += 1

        if removed > 0:
            logger.info(f"Cleaned up {removed} old jobs")

        return removed

    def get_connection_count(self) -> int:
        """Get the number of active connections."""
        return len(self._connections)


# Global instance
_manager: WebSocketManager | None = None


def get_websocket_manager() -> WebSocketManager:
    """Get the global WebSocket manager instance."""
    global _manager
    if _manager is None:
        _manager = WebSocketManager()
    return _manager
