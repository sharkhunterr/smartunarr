"""ScoringResult model per data-model.md."""

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class ScoringResult(BaseModel):
    """Detailed scoring breakdown for a program."""

    __tablename__ = "scoring_results"

    program_id: Mapped[str] = mapped_column(
        ForeignKey("programs.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    profile_id: Mapped[str] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )

    # Scores (0.0-100.0)
    total_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    type_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    duration_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    genre_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    timing_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    strategy_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    age_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    rating_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    filter_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bonus_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Violations and penalties
    forbidden_violations: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )
    mandatory_penalties: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )

    scored_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)

    # Relationships
    program: Mapped["Program"] = relationship("Program", back_populates="scoring_result")

    def __repr__(self) -> str:
        return f"<ScoringResult(id={self.id}, total_score={self.total_score})>"


# Avoid circular import
from app.models.channel import Program  # noqa: E402
