"""APScheduler integration for scheduled programming/scoring tasks."""

import asyncio
import logging
import threading
from datetime import datetime
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


class SchedulerManager:
    """Manages APScheduler for scheduled programming/scoring jobs."""

    def __init__(self) -> None:
        self._scheduler: AsyncIOScheduler | None = None
        self._started = False

    async def start(self) -> None:
        """Initialize and start the scheduler."""
        if self._started:
            logger.warning("Scheduler already started")
            return

        self._scheduler = AsyncIOScheduler()
        self._scheduler.start()
        self._started = True
        logger.info("APScheduler started")

        # Sync schedules from database
        await self._sync_schedules_from_db()

    async def stop(self) -> None:
        """Stop the scheduler gracefully."""
        if self._scheduler and self._started:
            self._scheduler.shutdown(wait=True)
            self._started = False
            logger.info("APScheduler stopped")

    async def _sync_schedules_from_db(self) -> None:
        """Load all enabled schedules from database and register them."""
        from app.db.database import async_session_maker
        from app.services.schedule_service import ScheduleService

        try:
            async with async_session_maker() as session:
                service = ScheduleService(session)
                schedules = await service.list_schedules(enabled=True)

                for schedule in schedules:
                    await self._register_schedule(schedule)
                    logger.info(f"Registered schedule: {schedule.name} ({schedule.id})")

                logger.info(f"Synced {len(schedules)} schedules from database")
        except Exception as e:
            logger.error(f"Error syncing schedules: {e}")

    async def _register_schedule(self, schedule: Any) -> None:
        """Register a schedule with APScheduler."""
        if not self._scheduler:
            return

        trigger = self._build_trigger(schedule.schedule_config)
        if not trigger:
            logger.warning(f"Could not build trigger for schedule {schedule.id}")
            return

        # Remove existing job if any
        job_id = f"schedule_{schedule.id}"
        try:
            self._scheduler.remove_job(job_id)
        except Exception:
            pass

        # Add new job
        self._scheduler.add_job(
            self._execute_schedule,
            trigger=trigger,
            id=job_id,
            args=[schedule.id],
            name=schedule.name,
            replace_existing=True,
        )

        # Update next_execution_at
        job = self._scheduler.get_job(job_id)
        if job and job.next_run_time:
            await self._update_next_execution(schedule.id, job.next_run_time)

    def _build_trigger(self, schedule_config: dict) -> CronTrigger | None:
        """Convert schedule config to APScheduler CronTrigger."""
        mode = schedule_config.get("mode", "simple")

        if mode == "cron":
            expression = schedule_config.get("expression", "")
            if not expression:
                return None
            try:
                # Parse cron expression: minute hour day month day_of_week
                parts = expression.split()
                if len(parts) == 5:
                    return CronTrigger(
                        minute=parts[0],
                        hour=parts[1],
                        day=parts[2],
                        month=parts[3],
                        day_of_week=parts[4],
                    )
            except Exception as e:
                logger.error(f"Invalid cron expression '{expression}': {e}")
                return None

        elif mode == "simple":
            time_str = schedule_config.get("time", "06:00")
            frequency = schedule_config.get("frequency", "daily")
            days = schedule_config.get("days", [])

            try:
                hour, minute = time_str.split(":")
                hour = int(hour)
                minute = int(minute)

                if frequency == "daily":
                    return CronTrigger(hour=hour, minute=minute)
                elif frequency == "weekly":
                    # days is list of day indices (0=Monday, 6=Sunday)
                    if days:
                        day_of_week = ",".join(str(d) for d in days)
                        return CronTrigger(
                            hour=hour, minute=minute, day_of_week=day_of_week
                        )
                    else:
                        # Default to Monday
                        return CronTrigger(hour=hour, minute=minute, day_of_week="0")
                elif frequency == "specific_days":
                    if days:
                        day_of_week = ",".join(str(d) for d in days)
                        return CronTrigger(
                            hour=hour, minute=minute, day_of_week=day_of_week
                        )
            except Exception as e:
                logger.error(f"Invalid simple schedule config: {e}")
                return None

        return None

    async def _execute_schedule(self, schedule_id: str) -> None:
        """Execute a scheduled task (programming or scoring)."""
        logger.info(f"Executing schedule: {schedule_id}")

        from app.db.database import async_session_maker
        from app.services.schedule_service import ScheduleService

        try:
            async with async_session_maker() as session:
                service = ScheduleService(session)
                schedule = await service.get_schedule(schedule_id)

                if not schedule:
                    logger.error(f"Schedule not found: {schedule_id}")
                    return

                if not schedule.enabled:
                    logger.info(f"Schedule {schedule_id} is disabled, skipping")
                    return

                # Update status to running
                await service.update_execution_status(
                    schedule_id, "running", None
                )
                await session.commit()

            # Execute based on type
            if schedule.schedule_type == "programming":
                await self._execute_programming(schedule)
            elif schedule.schedule_type == "scoring":
                await self._execute_scoring(schedule)
            else:
                logger.error(f"Unknown schedule type: {schedule.schedule_type}")

        except Exception as e:
            logger.error(f"Error executing schedule {schedule_id}: {e}")
            # Update status to failed
            try:
                async with async_session_maker() as session:
                    service = ScheduleService(session)
                    job = self._scheduler.get_job(f"schedule_{schedule_id}") if self._scheduler else None
                    next_run = job.next_run_time if job else None
                    await service.update_execution_status(
                        schedule_id, "failed", next_run
                    )
                    await session.commit()
            except Exception:
                pass

    async def _execute_programming(self, schedule: Any) -> None:
        """Execute a programming schedule."""
        from app.api.routes.programming import ProgrammingRequest, _run_programming
        from app.core.job_manager import JobType, get_job_manager
        from app.db.database import async_session_maker
        from app.services.schedule_service import ScheduleService

        params = schedule.execution_params or {}

        # Build ProgrammingRequest from stored params
        request = ProgrammingRequest(
            channel_id=schedule.channel_id,
            profile_id=schedule.profile_id or params.get("profile_id", ""),
            iterations=params.get("iterations", 10),
            randomness=params.get("randomness", 0.3),
            cache_mode=params.get("cache_mode", "full"),
            preview_only=False,  # Scheduled tasks should always apply
            replace_forbidden=params.get("replace_forbidden", False),
            improve_best=params.get("improve_best", False),
            duration_days=params.get("duration_days", 1),
            start_datetime=params.get("start_datetime"),
            ai_improve=params.get("ai_improve", False),
            ai_prompt=params.get("ai_prompt"),
            ai_model=params.get("ai_model"),
        )

        job_manager = get_job_manager()

        # Create job
        job_id = await job_manager.create_job(
            job_type=JobType.PROGRAMMING,
            title=f"Scheduled: {schedule.name}",
            channel_id=request.channel_id,
            profile_id=request.profile_id,
            total_iterations=request.iterations,
        )

        # Run programming in thread
        def run_in_thread() -> None:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(
                    _run_programming(job_id, request, schedule_id=schedule.id)
                )
            finally:
                loop.close()

        thread = threading.Thread(target=run_in_thread, daemon=True)
        thread.start()

        # Wait for completion (with timeout)
        thread.join(timeout=3600)  # 1 hour timeout

        # Update schedule status
        job = await job_manager.get_job(job_id)
        status = "success" if job and job.status.value == "completed" else "failed"

        async with async_session_maker() as session:
            service = ScheduleService(session)
            scheduler_job = self._scheduler.get_job(f"schedule_{schedule.id}") if self._scheduler else None
            next_run = scheduler_job.next_run_time if scheduler_job else None
            await service.update_execution_status(schedule.id, status, next_run)
            await session.commit()

    async def _execute_scoring(self, schedule: Any) -> None:
        """Execute a scoring schedule."""
        from app.api.routes.scoring import ScoringRequest, _run_scoring
        from app.core.job_manager import JobType, get_job_manager
        from app.db.database import async_session_maker
        from app.services.schedule_service import ScheduleService

        params = schedule.execution_params or {}

        # Build ScoringRequest from stored params
        request = ScoringRequest(
            channel_id=schedule.channel_id,
            profile_id=schedule.profile_id or params.get("profile_id", ""),
            cache_mode=params.get("cache_mode", "full"),
        )

        job_manager = get_job_manager()

        # Create job
        job_id = await job_manager.create_job(
            job_type=JobType.SCORING,
            title=f"Scheduled scoring: {schedule.name}",
            channel_id=request.channel_id,
            profile_id=request.profile_id,
        )

        # Run scoring in thread
        def run_in_thread() -> None:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(
                    _run_scoring(job_id, request, schedule_id=schedule.id)
                )
            finally:
                loop.close()

        thread = threading.Thread(target=run_in_thread, daemon=True)
        thread.start()

        # Wait for completion (with timeout)
        thread.join(timeout=1800)  # 30 min timeout

        # Update schedule status
        job = await job_manager.get_job(job_id)
        status = "success" if job and job.status.value == "completed" else "failed"

        async with async_session_maker() as session:
            service = ScheduleService(session)
            scheduler_job = self._scheduler.get_job(f"schedule_{schedule.id}") if self._scheduler else None
            next_run = scheduler_job.next_run_time if scheduler_job else None
            await service.update_execution_status(schedule.id, status, next_run)
            await session.commit()

    async def _update_next_execution(
        self, schedule_id: str, next_run: datetime
    ) -> None:
        """Update schedule's next_execution_at in database."""
        from app.db.database import async_session_maker
        from app.services.schedule_service import ScheduleService

        try:
            async with async_session_maker() as session:
                service = ScheduleService(session)
                schedule = await service.get_schedule(schedule_id)
                if schedule:
                    schedule.next_execution_at = next_run
                    await session.commit()
        except Exception as e:
            logger.error(f"Error updating next_execution: {e}")

    async def add_schedule(self, schedule: Any) -> None:
        """Add or update a schedule in APScheduler."""
        if schedule.enabled:
            await self._register_schedule(schedule)
        else:
            await self.remove_schedule(schedule.id)

    async def remove_schedule(self, schedule_id: str) -> None:
        """Remove a schedule from APScheduler."""
        if not self._scheduler:
            return

        job_id = f"schedule_{schedule_id}"
        try:
            self._scheduler.remove_job(job_id)
            logger.info(f"Removed schedule job: {job_id}")
        except Exception:
            pass

    async def run_schedule_now(self, schedule_id: str) -> str:
        """Trigger immediate execution of a schedule. Returns job_id."""
        from app.db.database import async_session_maker
        from app.services.schedule_service import ScheduleService

        async with async_session_maker() as session:
            service = ScheduleService(session)
            schedule = await service.get_schedule(schedule_id)

            if not schedule:
                raise ValueError(f"Schedule not found: {schedule_id}")

        # Execute in background
        asyncio.create_task(self._execute_schedule(schedule_id))

        return schedule_id


# Global singleton
_scheduler_manager: SchedulerManager | None = None


def get_scheduler_manager() -> SchedulerManager:
    """Get the global scheduler manager instance."""
    global _scheduler_manager
    if _scheduler_manager is None:
        _scheduler_manager = SchedulerManager()
    return _scheduler_manager
