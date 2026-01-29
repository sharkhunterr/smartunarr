"""Job manager for background tasks with SSE support."""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any
from uuid import uuid4

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
class ProgressStep:
    """A progress step for display."""
    id: str
    label: str
    status: str  # pending, running, completed, failed
    detail: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "status": self.status,
            "detail": self.detail,
        }


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
    # Granular progress fields
    library_name: str | None = None
    libraries_fetched: int | None = None
    total_libraries: int | None = None
    total_content: int | None = None
    programs_count: int | None = None
    best_iteration: int | None = None
    phase: str | None = None
    # Progress steps list
    steps: list[ProgressStep] = field(default_factory=list)
    # Job metadata
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
            # Granular progress fields
            "libraryName": self.library_name,
            "librariesFetched": self.libraries_fetched,
            "totalLibraries": self.total_libraries,
            "totalContent": self.total_content,
            "programsCount": self.programs_count,
            "bestIteration": self.best_iteration,
            "phase": self.phase,
            # Progress steps
            "steps": [s.to_dict() for s in self.steps],
            # Metadata
            "channelId": self.channel_id,
            "profileId": self.profile_id,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "errorMessage": self.error_message,
            "result": self.result,
        }


class JobManager:
    """Manages background jobs and broadcasts updates via SSE."""

    def __init__(self) -> None:
        """Initialize the job manager."""
        self._jobs: dict[str, Job] = {}
        self._sse_clients: list[asyncio.Queue[str]] = []
        self._lock = asyncio.Lock()

    async def subscribe_sse(self) -> asyncio.Queue[str]:
        """Subscribe a new SSE client and return their queue."""
        queue: asyncio.Queue[str] = asyncio.Queue()
        async with self._lock:
            self._sse_clients.append(queue)
        logger.info(f"SSE client subscribed. Total clients: {len(self._sse_clients)}")

        # Send current state
        jobs_data = {
            "type": "jobs_state",
            "jobs": [job.to_dict() for job in self._jobs.values()],
        }
        await queue.put(f"data: {json.dumps(jobs_data)}\n\n")

        return queue

    async def unsubscribe_sse(self, queue: asyncio.Queue[str]) -> None:
        """Unsubscribe an SSE client."""
        async with self._lock:
            if queue in self._sse_clients:
                self._sse_clients.remove(queue)
        logger.info(f"SSE client unsubscribed. Total clients: {len(self._sse_clients)}")

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Broadcast data to all SSE clients."""
        message = f"data: {json.dumps(data)}\n\n"

        async with self._lock:
            clients = list(self._sse_clients)

        for queue in clients:
            try:
                await queue.put(message)
            except Exception as e:
                logger.error(f"Error broadcasting to SSE client: {e}")

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

        await self.broadcast({
            "type": "job_created",
            "job": job.to_dict(),
        })

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
            await self.broadcast({
                "type": "job_started",
                "job": job.to_dict(),
            })
            logger.info(f"Started job {job_id}")

    async def update_job_progress(
        self,
        job_id: str,
        progress: float,
        current_step: str = "",
        best_score: float | None = None,
        current_iteration: int | None = None,
        **kwargs: Any,
    ) -> None:
        """Update job progress and broadcast the update.

        Args:
            job_id: The job ID
            progress: Progress percentage (0-100)
            current_step: Current step description
            best_score: Best score achieved so far
            current_iteration: Current iteration number
            **kwargs: Additional progress fields:
                - library_name: Name of library being fetched
                - libraries_fetched: Number of libraries fetched
                - total_libraries: Total number of libraries
                - total_content: Total content items found
                - programs_count: Number of programs generated
                - best_iteration: Best iteration number
                - phase: Current phase name
        """
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
                # Handle additional kwargs
                if "library_name" in kwargs:
                    job.library_name = kwargs["library_name"]
                if "libraries_fetched" in kwargs:
                    job.libraries_fetched = kwargs["libraries_fetched"]
                if "total_libraries" in kwargs:
                    job.total_libraries = kwargs["total_libraries"]
                if "total_content" in kwargs:
                    job.total_content = kwargs["total_content"]
                if "programs_count" in kwargs:
                    job.programs_count = kwargs["programs_count"]
                if "best_iteration" in kwargs:
                    job.best_iteration = kwargs["best_iteration"]
                if "phase" in kwargs:
                    job.phase = kwargs["phase"]
                if "total_iterations" in kwargs:
                    job.total_iterations = kwargs["total_iterations"]
                if "steps" in kwargs:
                    job.steps = kwargs["steps"]

        if job:
            await self.broadcast({
                "type": "job_progress",
                "job": job.to_dict(),
            })

    async def set_job_steps(self, job_id: str, steps: list[ProgressStep]) -> None:
        """Set the progress steps for a job."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.steps = steps

        if job:
            await self.broadcast({
                "type": "job_progress",
                "job": job.to_dict(),
            })

    async def update_step_status(
        self,
        job_id: str,
        step_id: str,
        status: str,
        detail: str | None = None,
    ) -> None:
        """Update a specific step's status."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                for step in job.steps:
                    if step.id == step_id:
                        step.status = status
                        if detail is not None:
                            step.detail = detail
                        break

        if job:
            await self.broadcast({
                "type": "job_progress",
                "job": job.to_dict(),
            })

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
            await self.broadcast({
                "type": "job_completed",
                "job": job.to_dict(),
            })
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
            await self.broadcast({
                "type": "job_failed",
                "job": job.to_dict(),
            })
            logger.error(f"Failed job {job_id}: {error_message}")

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if job and job.status in [JobStatus.PENDING, JobStatus.RUNNING]:
                job.status = JobStatus.CANCELLED
                job.completed_at = datetime.utcnow()

                await self.broadcast({
                    "type": "job_cancelled",
                    "job": job.to_dict(),
                })
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
                job for job in self._jobs.values()
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
        cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
        removed = 0

        async with self._lock:
            jobs_to_remove = [
                job_id for job_id, job in self._jobs.items()
                if job.completed_at and job.completed_at < cutoff
            ]
            for job_id in jobs_to_remove:
                del self._jobs[job_id]
                removed += 1

        if removed > 0:
            logger.info(f"Cleaned up {removed} old jobs")

        return removed

    async def clear_completed_jobs(self) -> int:
        """Remove all completed, failed, or cancelled jobs and broadcast update."""
        removed = 0
        terminal_statuses = [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]

        async with self._lock:
            jobs_to_remove = [
                job_id for job_id, job in self._jobs.items()
                if job.status in terminal_statuses
            ]
            for job_id in jobs_to_remove:
                del self._jobs[job_id]
                removed += 1

        if removed > 0:
            logger.info(f"Cleared {removed} completed jobs")

        # Broadcast updated state to all clients
        async with self._lock:
            remaining_jobs = [job.to_dict() for job in self._jobs.values()]
        await self.broadcast({
            "type": "jobs_state",
            "jobs": remaining_jobs,
        })

        return removed

    def get_client_count(self) -> int:
        """Get the number of active SSE clients."""
        return len(self._sse_clients)


# Global instance
_manager: JobManager | None = None


def get_job_manager() -> JobManager:
    """Get the global job manager instance."""
    global _manager
    if _manager is None:
        _manager = JobManager()
    return _manager
