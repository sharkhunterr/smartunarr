"""TunarrAdapter for GET/PUT channels and programming."""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class TunarrAdapter:
    """Adapter for Tunarr API interactions."""

    def __init__(
        self,
        base_url: str,
        username: str | None = None,
        password: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        """
        Initialize Tunarr adapter.

        Args:
            base_url: Tunarr server URL
            username: Optional username for auth
            password: Optional password for auth
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.auth = (username, password) if username and password else None
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                auth=self.auth,
                timeout=self.timeout,
            )
        return self._client

    async def close(self) -> None:
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def test_connection(self) -> tuple[bool, str]:
        """
        Test connection to Tunarr.

        Returns:
            (success, message)
        """
        try:
            client = await self._get_client()
            response = await client.get("/api/version")
            if response.status_code == 200:
                data = response.json()
                version = data.get("version", "unknown")
                return True, f"Connected to Tunarr v{version}"
            return False, f"Unexpected status code: {response.status_code}"
        except httpx.ConnectError:
            return False, "Connection refused - is Tunarr running?"
        except Exception as e:
            return False, f"Connection error: {str(e)}"

    async def get_channels(self) -> list[dict[str, Any]]:
        """Get all channels from Tunarr."""
        client = await self._get_client()
        response = await client.get("/api/channels")
        response.raise_for_status()
        return response.json()

    async def get_channel(self, channel_id: str) -> dict[str, Any] | None:
        """Get a specific channel by ID."""
        client = await self._get_client()
        response = await client.get(f"/api/channels/{channel_id}")
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()

    async def get_channel_programming(self, channel_id: str) -> list[dict[str, Any]]:
        """Get current programming for a channel."""
        client = await self._get_client()
        response = await client.get(f"/api/channels/{channel_id}/programming")
        if response.status_code == 404:
            return []
        response.raise_for_status()
        return response.json()

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
        client = await self._get_client()

        # Tunarr expects specific format for programming
        programming_data = {
            "type": "manual",
            "programs": [
                {
                    "type": "content",
                    "persisted": True,
                    "id": p.get("content_plex_key", p.get("plex_key")),
                    "externalSourceType": "plex",
                    "externalSourceName": p.get("library_name", "Library"),
                    "externalKey": p.get("content_plex_key", p.get("plex_key")),
                    "duration": p.get("duration_ms", 0),
                    "title": p.get("title", ""),
                }
                for p in programs
            ],
        }

        response = await client.put(
            f"/api/channels/{channel_id}/programming",
            json=programming_data,
        )
        response.raise_for_status()
        return True

    async def get_plex_servers(self) -> list[dict[str, Any]]:
        """Get configured Plex servers in Tunarr."""
        client = await self._get_client()
        response = await client.get("/api/plex-servers")
        if response.status_code == 404:
            return []
        response.raise_for_status()
        return response.json()

    async def get_filler_lists(self) -> list[dict[str, Any]]:
        """Get filler lists from Tunarr."""
        client = await self._get_client()
        response = await client.get("/api/filler-lists")
        if response.status_code == 404:
            return []
        response.raise_for_status()
        return response.json()
