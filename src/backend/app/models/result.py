"""Result model for storing programming and scoring results."""

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Result(BaseModel):
    """Stored result for programming or scoring operations."""

    __tablename__ = "results"

    type: Mapped[str] = mapped_column(String(20), nullable=False)  # programming/scoring
    history_entry_id: Mapped[str | None] = mapped_column(
        ForeignKey("history_entries.id", ondelete="CASCADE"), nullable=True
    )
    channel_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    profile_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    def __repr__(self) -> str:
        return f"<Result(id={self.id}, type={self.type})>"
