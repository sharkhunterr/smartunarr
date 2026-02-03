"""Schedule model for automated programming/scoring tasks."""

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Schedule(BaseModel):
    """Scheduled task for automatic programming/scoring execution."""

    __tablename__ = "schedules"

    # Basic info
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Schedule type: "programming" or "scoring"
    schedule_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Target references
    channel_id: Mapped[str] = mapped_column(String(100), nullable=False)
    profile_id: Mapped[str | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )

    # Scheduling configuration (stored as JSON)
    # Simple mode: {"mode": "simple", "frequency": "daily|weekly|specific_days", "days": [0,1,2...], "time": "HH:MM"}
    # Expert mode: {"mode": "cron", "expression": "0 6 * * *"}
    schedule_config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    # Programming/Scoring parameters (same as ProgrammingRequest/ScoringRequest)
    execution_params: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    # State
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_execution_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_execution_status: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # success/failed/running
    next_execution_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<Schedule(id={self.id}, name={self.name}, type={self.schedule_type}, enabled={self.enabled})>"
