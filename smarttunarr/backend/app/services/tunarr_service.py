"""TunarrService with connection testing and channel management."""

import logging
from typing import Any

from app.adapters.tunarr_adapter import TunarrAdapter

logger = logging.getLogger(__name__)


class TunarrService:
    """Service for Tunarr interactions."""

    def __init__(
        self,
        url: str,
        username: str | None = None,
        password: str | None = None,
    ) -> None:
        """
        Initialize Tunarr service.

        Args:
            url: Tunarr server URL
            username: Optional username
            password: Optional password
        """
        self.adapter = TunarrAdapter(url, username, password)

    async def test_connection(self) -> tuple[bool, str]:
        """
        Test connection to Tunarr server.

        Returns:
            (success, message) tuple
        """
        return await self.adapter.test_connection()

    async def get_channels(self) -> list[dict[str, Any]]:
        """
        Get all channels from Tunarr.

        Returns:
            List of channel dictionaries
        """
        return await self.adapter.get_channels()

    async def get_channel(self, channel_id: str) -> dict[str, Any] | None:
        """
        Get a specific channel by ID.

        Args:
            channel_id: Channel ID

        Returns:
            Channel dictionary or None
        """
        return await self.adapter.get_channel(channel_id)

    async def get_channel_programming(self, channel_id: str) -> list[dict[str, Any]]:
        """
        Get current programming for a channel.

        Args:
            channel_id: Channel ID

        Returns:
            List of program items
        """
        return await self.adapter.get_channel_programming(channel_id)

    async def update_channel_programming(
        self,
        channel_id: str,
        programs: list[dict[str, Any]],
    ) -> bool:
        """
        Update channel programming.

        Args:
            channel_id: Channel ID
            programs: List of program items

        Returns:
            True if successful
        """
        return await self.adapter.update_channel_programming(channel_id, programs)

    async def get_server_info(self) -> dict[str, Any] | None:
        """
        Get Tunarr server information.

        Returns:
            Server info dictionary or None on error
        """
        try:
            success, message = await self.test_connection()
            if success:
                channels = await self.get_channels()
                return {
                    "connected": True,
                    "version": message.replace("Connected to Tunarr ", ""),
                    "channel_count": len(channels),
                }
        except Exception as e:
            logger.error(f"Failed to get server info: {e}")

        return None

    async def close(self) -> None:
        """Close the adapter connection."""
        await self.adapter.close()
