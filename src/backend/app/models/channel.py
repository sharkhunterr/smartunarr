"""Channel and Program models per data-model.md."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Channel(BaseModel):
    """Tunarr channel reference."""

    __tablename__ = "channels"

    tunarr_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    programs: Mapped[list["Program"]] = relationship(
        "Program", back_populates="channel", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Channel(id={self.id}, name={self.name}, number={self.number})>"


class Program(BaseModel):
    """Scheduled content in a channel's programming."""

    __tablename__ = "programs"

    channel_id: Mapped[str] = mapped_column(
        ForeignKey("channels.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content_id: Mapped[str] = mapped_column(
        ForeignKey("contents.id", ondelete="CASCADE"), nullable=False
    )
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    block_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Relationships
    channel: Mapped["Channel"] = relationship("Channel", back_populates="programs")
    content: Mapped["Content"] = relationship("Content", back_populates="programs")
    scoring_result: Mapped["ScoringResult | None"] = relationship(
        "ScoringResult", back_populates="program", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Program(id={self.id}, position={self.position}, start_time={self.start_time})>"


# Avoid circular import
from app.models.content import Content  # noqa: E402, F811
from app.models.scoring import ScoringResult  # noqa: E402
