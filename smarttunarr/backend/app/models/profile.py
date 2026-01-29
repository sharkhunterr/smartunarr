"""Profile model per data-model.md."""

from typing import Any

from sqlalchemy import Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Profile(BaseModel):
    """Configuration JSON defining programming criteria."""

    __tablename__ = "profiles"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    version: Mapped[str] = mapped_column(String(10), nullable=False, default="6.0")
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    libraries: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    time_blocks: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    mandatory_forbidden_criteria: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict
    )
    enhanced_criteria: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    strategies: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    scoring_weights: Mapped[dict[str, float]] = mapped_column(JSON, nullable=False, default=dict)
    default_iterations: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    default_randomness: Mapped[float] = mapped_column(Float, default=0.3, nullable=False)

    # Relationships
    labels: Mapped[list["ProfileLabel"]] = relationship(
        "ProfileLabel", back_populates="profile", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Profile(id={self.id}, name={self.name}, version={self.version})>"


class ProfileLabel(BaseModel):
    """Tags for organizing profiles."""

    __tablename__ = "profile_labels"

    profile_id: Mapped[str] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(50), nullable=False)

    # Relationships
    profile: Mapped["Profile"] = relationship("Profile", back_populates="labels")

    __table_args__ = (UniqueConstraint("profile_id", "label", name="uq_profile_label"),)

    def __repr__(self) -> str:
        return f"<ProfileLabel(id={self.id}, label={self.label})>"
