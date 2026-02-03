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

    async def get_channel_programming(self, channel_id: str) -> dict[str, Any] | list[dict[str, Any]]:
        """Get current programming for a channel.

        Uses /programming endpoint which returns the ordered lineup with programs dict.
        Falls back to /programs if /programming fails.
        """
        client = await self._get_client()
        # Try /programming first (has lineup order)
        response = await client.get(f"/api/channels/{channel_id}/programming")
        if response.status_code == 404:
            # Fallback to /programs
            response = await client.get(f"/api/channels/{channel_id}/programs")
            if response.status_code == 404:
                return []
        response.raise_for_status()
        return response.json()

    async def update_channel_programming(
        self,
        channel_id: str,
        programs: list[dict[str, Any]],
        plex_server_name: str = "NAS-Jérémie",
        plex_server_id: str = "caa0e3c3-67d7-4533-8d8d-616ab86bf4bc",
    ) -> bool:
        """
        Update channel programming (replaces all programs).

        Uses POST /api/channels/{channel_id}/programming with Tunarr's expected format.

        Args:
            channel_id: Channel ID
            programs: List of program items with plex_key, duration_ms, title, type
            plex_server_name: Plex server name as configured in Tunarr
            plex_server_id: Plex server UUID as configured in Tunarr

        Returns:
            True if successful
        """
        client = await self._get_client()

        # Build programs in Tunarr format
        tunarr_programs = []
        for idx, p in enumerate(programs):
            plex_key = p.get("content_plex_key") or p.get("plex_key", "")

            # Extract numeric rating_key from plex_key
            # /library/metadata/834170 -> 834170
            if plex_key.startswith("/library/metadata/"):
                rating_key = plex_key.split("/")[-1]
            elif plex_key.startswith("/"):
                rating_key = plex_key.split("/")[-1]
            else:
                rating_key = plex_key

            unique_id = f"plex|{plex_server_name}|{rating_key}"

            # Map content type to subtype
            content_type = p.get("type", "movie")
            subtype = "movie" if content_type == "movie" else "episode"

            program = {
                "type": "content",
                "externalSourceType": "plex",
                "externalSourceId": plex_server_id,
                "externalSourceName": plex_server_name,
                "externalKey": rating_key,  # Use numeric rating_key, not full path
                "duration": p.get("duration_ms", 0),
                "title": p.get("title", ""),
                "subtype": subtype,
                "persisted": False,
                "uniqueId": unique_id,
                "id": unique_id,
                "originalIndex": idx,
                "startTimeOffset": 0,  # Will be recalculated
                "externalIds": [],  # Let Tunarr populate this
            }

            # Add optional fields if available
            if p.get("content_rating"):
                program["rating"] = p.get("content_rating")
            if p.get("summary"):
                program["summary"] = p.get("summary")
            if p.get("year"):
                # Use year with placeholder month/day if no full date available
                program["date"] = f"{p.get('year')}-01-01"

            tunarr_programs.append(program)

        # Recalculate startTimeOffset
        total_offset = 0
        for program in tunarr_programs:
            program["startTimeOffset"] = total_offset
            total_offset += program["duration"]

        # Build lineup (index references to programs)
        lineup = [
            {
                "duration": program["duration"],
                "index": idx,
                "type": "index",
            }
            for idx, program in enumerate(tunarr_programs)
        ]

        # Tunarr programming payload
        payload = {
            "type": "manual",
            "lineup": lineup,
            "programs": tunarr_programs,
            "append": False,
        }

        logger.info(f"Sending {len(tunarr_programs)} programs to Tunarr channel {channel_id}")

        response = await client.post(
            f"/api/channels/{channel_id}/programming",
            json=payload,
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

    async def update_channel(self, channel_id: str, channel_config: dict[str, Any]) -> bool:
        """
        Update a channel's configuration.

        Args:
            channel_id: Channel ID
            channel_config: Full channel configuration

        Returns:
            True if successful
        """
        client = await self._get_client()
        response = await client.put(
            f"/api/channels/{channel_id}",
            json=channel_config,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/plain, */*",
            },
        )
        if response.status_code == 200:
            logger.info(f"Channel {channel_id} configuration updated")
            return True
        else:
            logger.error(f"Failed to update channel {channel_id}: {response.status_code}")
            logger.error(f"Response: {response.text}")
            return False

    async def update_channel_start_time(
        self,
        channel_id: str,
        start_time_ms: int,
        duration_ms: int | None = None,
    ) -> bool:
        """
        Update a channel's programming start time.

        Args:
            channel_id: Channel ID
            start_time_ms: Start time as Unix timestamp in milliseconds
            duration_ms: Optional total duration in milliseconds (calculated from programs if not provided)

        Returns:
            True if successful
        """
        # Get current channel configuration
        channel_config = await self.get_channel(channel_id)
        if not channel_config:
            logger.error(f"Channel {channel_id} not found")
            return False

        # Update startTime
        channel_config["startTime"] = start_time_ms
        logger.info(f"Updating channel {channel_id} startTime to {start_time_ms}")

        # Update duration if provided
        if duration_ms is not None:
            channel_config["duration"] = duration_ms
            logger.info(f"Updating channel {channel_id} duration to {duration_ms}")

        # Send update
        return await self.update_channel(channel_id, channel_config)
