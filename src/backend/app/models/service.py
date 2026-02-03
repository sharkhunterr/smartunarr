"""Service model per data-model.md."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Service(BaseModel):
    """External service configuration."""

    __tablename__ = "services"

    type: Mapped[str] = mapped_column(
        String(20), nullable=False, unique=True
    )  # plex/tmdb/tunarr/ollama
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    api_key: Mapped[str | None] = mapped_column(String(500), nullable=True)  # Encrypted
    token: Mapped[str | None] = mapped_column(String(500), nullable=True)  # Encrypted
    username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    password: Mapped[str | None] = mapped_column(String(500), nullable=True)  # Encrypted
    default_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_test: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_test_success: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    def __repr__(self) -> str:
        return f"<Service(id={self.id}, type={self.type}, name={self.name})>"
