"""PlexService with library listing and connection testing."""

import logging
from typing import Any

from app.adapters.plex_adapter import PlexAdapter

logger = logging.getLogger(__name__)


class PlexService:
    """Service for Plex interactions."""

    def __init__(self, url: str, token: str) -> None:
        """
        Initialize Plex service.

        Args:
            url: Plex server URL
            token: Plex authentication token
        """
        self.adapter = PlexAdapter(url, token)

    def test_connection(self) -> tuple[bool, str]:
        """
        Test connection to Plex server.

        Returns:
            (success, message) tuple
        """
        return self.adapter.test_connection()

    def get_libraries(self) -> list[dict[str, Any]]:
        """
        Get all libraries from Plex.

        Returns:
            List of library dictionaries
        """
        return self.adapter.get_libraries()

    def get_library_content(
        self,
        library_id: str,
        content_type: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        Get content from a specific library.

        Args:
            library_id: Library section ID
            content_type: Optional content type filter
            limit: Maximum items to return

        Returns:
            List of content items
        """
        return self.adapter.get_library_content(library_id, content_type, limit)

    def get_content_metadata(self, plex_key: str) -> dict[str, Any] | None:
        """
        Get detailed metadata for a content item.

        Args:
            plex_key: Plex content key

        Returns:
            Metadata dictionary or None
        """
        return self.adapter.get_content_metadata(plex_key)

    def search(
        self,
        query: str,
        library_id: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """
        Search for content.

        Args:
            query: Search query
            library_id: Optional library filter
            limit: Maximum results

        Returns:
            List of matching items
        """
        return self.adapter.search(query, library_id, limit)

    def get_server_info(self) -> dict[str, Any] | None:
        """
        Get Plex server information.

        Returns:
            Server info dictionary or None on error
        """
        try:
            success, message = self.test_connection()
            if success:
                return {
                    "connected": True,
                    "server_name": message.replace("Connected to ", ""),
                    "libraries": self.get_libraries(),
                }
        except Exception as e:
            logger.error(f"Failed to get server info: {e}")

        return None
