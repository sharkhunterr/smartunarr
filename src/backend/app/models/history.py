"""HistoryEntry model per data-model.md."""

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class HistoryEntry(BaseModel):
    """Audit log for operations."""

    __tablename__ = "history_entries"

    type: Mapped[str] = mapped_column(String(20), nullable=False)  # programming/scoring
    # channel_id is the Tunarr channel ID (external), not a local FK
    channel_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    profile_id: Mapped[str | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    # Reference to schedule if triggered by scheduler
    schedule_id: Mapped[str | None] = mapped_column(
        ForeignKey("schedules.id", ondelete="SET NULL"), nullable=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="running"
    )  # running/success/failed
    iterations: Mapped[int | None] = mapped_column(Integer, nullable=True)
    best_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    result_summary: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<HistoryEntry(id={self.id}, type={self.type}, status={self.status})>"
