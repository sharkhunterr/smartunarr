"""Content and ContentMeta models per data-model.md."""

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Content(BaseModel):
    """Media item from Plex library."""

    __tablename__ = "contents"

    plex_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # movie/episode/trailer
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    library_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Relationships
    meta: Mapped["ContentMeta | None"] = relationship(
        "ContentMeta", back_populates="content", uselist=False, cascade="all, delete-orphan"
    )
    programs: Mapped[list["Program"]] = relationship("Program", back_populates="content")

    def __repr__(self) -> str:
        return f"<Content(id={self.id}, title={self.title}, type={self.type})>"


class ContentMeta(BaseModel):
    """TMDB-enriched metadata for Content."""

    __tablename__ = "content_meta"

    content_id: Mapped[str] = mapped_column(
        ForeignKey("contents.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    genres: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    keywords: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    age_rating: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tmdb_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    vote_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    budget: Mapped[int | None] = mapped_column(Integer, nullable=True)
    revenue: Mapped[int | None] = mapped_column(Integer, nullable=True)
    studios: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    collections: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    enriched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    content: Mapped["Content"] = relationship("Content", back_populates="meta")

    def __repr__(self) -> str:
        return f"<ContentMeta(id={self.id}, tmdb_id={self.tmdb_id})>"


# Avoid circular import
from app.models.channel import Program  # noqa: E402
