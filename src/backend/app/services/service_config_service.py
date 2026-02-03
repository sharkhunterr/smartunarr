"""ServiceConfigService for CRUD operations on service configurations."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import Service
from app.utils.encryption import decrypt_value, encrypt_value

logger = logging.getLogger(__name__)


class ServiceConfigService:
    """Service for managing external service configurations."""

    SUPPORTED_TYPES = ["plex", "tunarr", "tmdb", "ollama"]

    def __init__(self, session: AsyncSession) -> None:
        """Initialize service config service."""
        self.session = session

    async def get_service(self, service_type: str) -> Service | None:
        """
        Get service configuration by type.

        Args:
            service_type: Service type (plex, tunarr, tmdb, ollama)

        Returns:
            Service configuration or None
        """
        if service_type not in self.SUPPORTED_TYPES:
            raise ValueError(f"Unsupported service type: {service_type}")

        query = select(Service).where(Service.type == service_type)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_all_services(self) -> list[Service]:
        """
        Get all service configurations.

        Returns:
            List of all services
        """
        query = select(Service).order_by(Service.type)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_or_update_service(
        self,
        service_type: str,
        config: dict[str, Any],
    ) -> Service:
        """
        Create or update a service configuration.

        Args:
            service_type: Service type
            config: Configuration values

        Returns:
            Created or updated service
        """
        if service_type not in self.SUPPORTED_TYPES:
            raise ValueError(f"Unsupported service type: {service_type}")

        existing = await self.get_service(service_type)

        if existing:
            # Update existing
            return await self._update_service(existing, config)
        else:
            # Create new
            return await self._create_service(service_type, config)

    async def _create_service(
        self,
        service_type: str,
        config: dict[str, Any],
    ) -> Service:
        """Create a new service configuration."""
        service = Service(
            type=service_type,
            name=config.get("name", service_type.title()),
            url=config.get("url"),
            is_active=config.get("is_active", True),
        )

        # Handle encrypted fields
        if "api_key" in config and config["api_key"]:
            service.api_key = encrypt_value(config["api_key"])

        if "token" in config and config["token"]:
            service.token = encrypt_value(config["token"])

        if "password" in config and config["password"]:
            service.password = encrypt_value(config["password"])

        # Handle non-encrypted fields
        if "username" in config:
            service.username = config["username"]

        if "default_model" in config:
            service.default_model = config["default_model"]

        self.session.add(service)
        await self.session.commit()
        await self.session.refresh(service)

        return service

    async def _update_service(
        self,
        service: Service,
        config: dict[str, Any],
    ) -> Service:
        """Update an existing service configuration."""
        if "name" in config:
            service.name = config["name"]

        if "url" in config:
            service.url = config["url"]

        if "is_active" in config:
            service.is_active = config["is_active"]

        # Handle encrypted fields (only update if provided and non-empty)
        if "api_key" in config:
            if config["api_key"]:
                service.api_key = encrypt_value(config["api_key"])
            elif config["api_key"] == "":
                service.api_key = None

        if "token" in config:
            if config["token"]:
                service.token = encrypt_value(config["token"])
            elif config["token"] == "":
                service.token = None

        if "password" in config:
            if config["password"]:
                service.password = encrypt_value(config["password"])
            elif config["password"] == "":
                service.password = None

        # Handle non-encrypted fields
        if "username" in config:
            service.username = config["username"]

        if "default_model" in config:
            service.default_model = config["default_model"]

        await self.session.commit()
        await self.session.refresh(service)

        return service

    async def delete_service(self, service_type: str) -> bool:
        """
        Delete a service configuration.

        Args:
            service_type: Service type to delete

        Returns:
            True if deleted, False if not found
        """
        service = await self.get_service(service_type)
        if not service:
            return False

        await self.session.delete(service)
        await self.session.commit()

        return True

    async def update_test_result(
        self,
        service_type: str,
        success: bool,
    ) -> None:
        """
        Update service test result.

        Args:
            service_type: Service type
            success: Whether the test was successful
        """
        from datetime import datetime

        service = await self.get_service(service_type)
        if service:
            service.last_test = datetime.utcnow()
            service.last_test_success = success
            await self.session.commit()

    def get_decrypted_credentials(self, service: Service) -> dict[str, Any]:
        """
        Get decrypted credentials for a service.

        Args:
            service: Service to get credentials from

        Returns:
            Dictionary with decrypted values
        """
        result: dict[str, Any] = {
            "url": service.url,
            "username": service.username,
        }

        if service.api_key:
            result["api_key"] = decrypt_value(service.api_key)

        if service.token:
            result["token"] = decrypt_value(service.token)

        if service.password:
            result["password"] = decrypt_value(service.password)

        if service.default_model:
            result["default_model"] = service.default_model

        return result

    def service_to_response(self, service: Service) -> dict[str, Any]:
        """
        Convert service to API response (without sensitive data).

        Args:
            service: Service to convert

        Returns:
            Response dictionary
        """
        return {
            "id": service.id,
            "type": service.type,
            "name": service.name,
            "url": service.url,
            "username": service.username,
            "default_model": service.default_model,
            "is_active": service.is_active,
            "has_api_key": service.api_key is not None,
            "has_token": service.token is not None,
            "has_password": service.password is not None,
            "last_test": service.last_test.isoformat() if service.last_test else None,
            "last_test_success": service.last_test_success,
            "created_at": service.created_at.isoformat(),
            "updated_at": service.updated_at.isoformat(),
        }
