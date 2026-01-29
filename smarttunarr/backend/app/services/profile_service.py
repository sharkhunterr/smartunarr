"""ProfileService with CRUD operations."""

import json
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.profile import Profile, ProfileLabel
from app.schemas.profile_schema import ProfileCreate, ProfileUpdate, ProfileValidation
from app.services.profile_migration import ProfileMigration

logger = logging.getLogger(__name__)


class ProfileService:
    """Service for profile CRUD operations."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize profile service."""
        self.session = session

    async def list_profiles(
        self,
        label: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Profile]:
        """
        List profiles with optional label filter.

        Args:
            label: Filter by label (case-insensitive)
            limit: Maximum results
            offset: Results offset

        Returns:
            List of profiles
        """
        query = select(Profile).options(selectinload(Profile.labels))

        if label:
            query = query.join(ProfileLabel).where(
                ProfileLabel.label.ilike(f"%{label}%")
            )

        query = query.order_by(Profile.name).limit(limit).offset(offset)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_profile(self, profile_id: str) -> Profile | None:
        """
        Get profile by ID.

        Args:
            profile_id: Profile ID

        Returns:
            Profile or None if not found
        """
        query = (
            select(Profile)
            .options(selectinload(Profile.labels))
            .where(Profile.id == profile_id)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_profile_by_name(self, name: str) -> Profile | None:
        """
        Get profile by name.

        Args:
            name: Profile name

        Returns:
            Profile or None if not found
        """
        query = (
            select(Profile)
            .options(selectinload(Profile.labels))
            .where(Profile.name == name)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def create_profile(self, data: ProfileCreate) -> Profile:
        """
        Create a new profile.

        Args:
            data: Profile creation data

        Returns:
            Created profile

        Raises:
            ValueError: If profile name already exists
        """
        # Check for duplicate name
        existing = await self.get_profile_by_name(data.name)
        if existing:
            raise ValueError(f"Profile with name '{data.name}' already exists")

        # Create profile
        profile = Profile(
            name=data.name,
            version=data.version,
            description=data.description,
            libraries=[lib.model_dump() for lib in data.libraries],
            time_blocks=[block.model_dump() for block in data.time_blocks],
            mandatory_forbidden_criteria=data.mandatory_forbidden_criteria.model_dump(),
            enhanced_criteria=data.enhanced_criteria.model_dump() if data.enhanced_criteria else None,
            strategies=data.strategies.model_dump() if data.strategies else None,
            scoring_weights=data.scoring_weights.model_dump(),
            default_iterations=data.default_iterations,
            default_randomness=data.default_randomness,
        )

        self.session.add(profile)
        await self.session.flush()

        # Add labels
        for label_name in data.labels:
            label = ProfileLabel(
                profile_id=profile.id,
                label=label_name.lower().strip(),
            )
            self.session.add(label)

        await self.session.commit()

        # Reload with labels eagerly loaded
        return await self.get_profile(profile.id)

    async def update_profile(
        self,
        profile_id: str,
        data: ProfileUpdate,
    ) -> Profile | None:
        """
        Update an existing profile.

        Args:
            profile_id: Profile ID to update
            data: Update data

        Returns:
            Updated profile or None if not found
        """
        profile = await self.get_profile(profile_id)
        if not profile:
            return None

        # Check name uniqueness if changing
        if data.name and data.name != profile.name:
            existing = await self.get_profile_by_name(data.name)
            if existing:
                raise ValueError(f"Profile with name '{data.name}' already exists")
            profile.name = data.name

        # Update fields if provided
        if data.description is not None:
            profile.description = data.description

        if data.libraries is not None:
            profile.libraries = [lib.model_dump() for lib in data.libraries]

        if data.time_blocks is not None:
            profile.time_blocks = [block.model_dump() for block in data.time_blocks]

        if data.mandatory_forbidden_criteria is not None:
            profile.mandatory_forbidden_criteria = data.mandatory_forbidden_criteria.model_dump()

        if data.enhanced_criteria is not None:
            profile.enhanced_criteria = data.enhanced_criteria.model_dump()

        if data.strategies is not None:
            profile.strategies = data.strategies.model_dump()

        if data.scoring_weights is not None:
            profile.scoring_weights = data.scoring_weights.model_dump()

        if data.default_iterations is not None:
            profile.default_iterations = data.default_iterations

        if data.default_randomness is not None:
            profile.default_randomness = data.default_randomness

        # Update labels if provided
        if data.labels is not None:
            # Remove existing labels
            for label in profile.labels:
                await self.session.delete(label)

            # Add new labels
            for label_name in data.labels:
                label = ProfileLabel(
                    profile_id=profile.id,
                    label=label_name.lower().strip(),
                )
                self.session.add(label)

        await self.session.commit()

        # Reload with labels eagerly loaded
        return await self.get_profile(profile.id)

    async def delete_profile(self, profile_id: str) -> bool:
        """
        Delete a profile.

        Args:
            profile_id: Profile ID to delete

        Returns:
            True if deleted, False if not found
        """
        profile = await self.get_profile(profile_id)
        if not profile:
            return False

        await self.session.delete(profile)
        await self.session.commit()

        return True

    async def import_profile(
        self,
        profile_data: dict[str, Any],
        overwrite: bool = False,
    ) -> Profile:
        """
        Import a profile from JSON data.

        Args:
            profile_data: Profile data (may be v4 or v5 format)
            overwrite: Whether to overwrite existing profile with same name

        Returns:
            Imported profile
        """
        # Detect and migrate if needed
        version = ProfileMigration.detect_version(profile_data)
        if not ProfileMigration.validate_version(version):
            raise ValueError(f"Unsupported profile version: {version}")

        migrated_data = ProfileMigration.migrate(profile_data)

        # Validate migrated data
        validation = self.validate_profile(migrated_data)
        if not validation.valid:
            raise ValueError(f"Invalid profile: {', '.join(validation.errors)}")

        # Check for existing
        name = migrated_data["name"]
        existing = await self.get_profile_by_name(name)

        if existing:
            if overwrite:
                await self.delete_profile(existing.id)
            else:
                raise ValueError(f"Profile '{name}' already exists. Set overwrite=True to replace.")

        # Create from migrated data
        create_data = ProfileCreate(**migrated_data)
        return await self.create_profile(create_data)

    def profile_to_response(self, profile: Profile) -> dict[str, Any]:
        """
        Convert a profile to API response format.

        Args:
            profile: Profile model instance

        Returns:
            Dictionary matching ProfileResponse schema
        """
        return {
            "id": profile.id,
            "name": profile.name,
            "version": profile.version,
            "description": profile.description,
            "libraries": profile.libraries or [],
            "time_blocks": profile.time_blocks or [],
            "mandatory_forbidden_criteria": profile.mandatory_forbidden_criteria or {},
            "enhanced_criteria": profile.enhanced_criteria,
            "strategies": profile.strategies,
            "scoring_weights": profile.scoring_weights or {},
            "default_iterations": profile.default_iterations,
            "default_randomness": profile.default_randomness,
            "labels": [label.label for label in profile.labels] if profile.labels else [],
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
            "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
        }

    def export_profile(self, profile: Profile) -> dict[str, Any]:
        """
        Export a profile to JSON format.

        Args:
            profile: Profile to export

        Returns:
            JSON-serializable dictionary
        """
        return {
            "name": profile.name,
            "version": profile.version,
            "description": profile.description,
            "libraries": profile.libraries,
            "time_blocks": profile.time_blocks,
            "mandatory_forbidden_criteria": profile.mandatory_forbidden_criteria,
            "enhanced_criteria": profile.enhanced_criteria,
            "strategies": profile.strategies,
            "scoring_weights": profile.scoring_weights,
            "default_iterations": profile.default_iterations,
            "default_randomness": profile.default_randomness,
            "labels": [label.label for label in profile.labels],
        }

    def validate_profile(self, profile_data: dict[str, Any]) -> ProfileValidation:
        """
        Validate profile data without saving.

        Args:
            profile_data: Profile data to validate

        Returns:
            Validation result with errors and warnings
        """
        errors: list[str] = []
        warnings: list[str] = []

        # Required fields
        required = ["name", "libraries", "time_blocks", "scoring_weights"]
        for field in required:
            if field not in profile_data:
                errors.append(f"Missing required field: {field}")

        if errors:
            return ProfileValidation(valid=False, errors=errors)

        # Validate libraries
        libraries = profile_data.get("libraries", [])
        if not libraries:
            errors.append("At least one library is required")
        else:
            for i, lib in enumerate(libraries):
                if not lib.get("id"):
                    errors.append(f"Library {i}: missing 'id'")
                if not lib.get("name"):
                    errors.append(f"Library {i}: missing 'name'")

        # Validate time blocks
        time_blocks = profile_data.get("time_blocks", [])
        if not time_blocks:
            errors.append("At least one time block is required")
        else:
            for i, block in enumerate(time_blocks):
                if not block.get("name"):
                    errors.append(f"Time block {i}: missing 'name'")
                if not block.get("start_time"):
                    errors.append(f"Time block {i}: missing 'start_time'")
                if not block.get("end_time"):
                    errors.append(f"Time block {i}: missing 'end_time'")

            # Check for gaps (warning only)
            # This would require more complex time analysis
            if len(time_blocks) > 1:
                warnings.append("Consider verifying time blocks cover 24 hours")

        # Validate scoring weights
        weights = profile_data.get("scoring_weights", {})
        total_weight = sum(weights.values())
        if total_weight < 50:
            warnings.append(f"Total scoring weight ({total_weight}) is low, consider increasing")
        if total_weight > 200:
            warnings.append(f"Total scoring weight ({total_weight}) is very high")

        # Validate iterations
        iterations = profile_data.get("default_iterations", 10)
        if iterations < 1:
            errors.append("default_iterations must be at least 1")
        elif iterations > 100:
            warnings.append(f"High iteration count ({iterations}) may be slow")

        # Validate randomness
        randomness = profile_data.get("default_randomness", 0.3)
        if randomness < 0 or randomness > 1:
            errors.append("default_randomness must be between 0 and 1")

        return ProfileValidation(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
        )

    async def duplicate_profile(
        self,
        profile_id: str,
        new_name: str,
    ) -> Profile:
        """
        Duplicate an existing profile.

        Args:
            profile_id: Profile to duplicate
            new_name: Name for the new profile

        Returns:
            New duplicated profile
        """
        original = await self.get_profile(profile_id)
        if not original:
            raise ValueError(f"Profile not found: {profile_id}")

        # Export and import with new name
        export_data = self.export_profile(original)
        export_data["name"] = new_name

        return await self.import_profile(export_data)
