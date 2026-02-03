"""PlexAdapter for library listing and content metadata."""

import logging
from typing import Any

from plexapi.exceptions import NotFound, Unauthorized
from plexapi.server import PlexServer

logger = logging.getLogger(__name__)


class PlexAdapter:
    """Adapter for Plex API interactions."""

    def __init__(self, base_url: str, token: str) -> None:
        """
        Initialize Plex adapter.

        Args:
            base_url: Plex server URL
            token: Plex authentication token
        """
        self.base_url = base_url.rstrip("/")
        self.token = token
        self._server: PlexServer | None = None

    def _get_server(self) -> PlexServer:
        """Get or create Plex server connection."""
        if self._server is None:
            self._server = PlexServer(self.base_url, self.token)
        return self._server

    def test_connection(self) -> tuple[bool, str]:
        """
        Test connection to Plex.

        Returns:
            (success, message)
        """
        try:
            server = self._get_server()
            return True, f"Connected to {server.friendlyName}"
        except Unauthorized:
            return False, "Invalid Plex token"
        except Exception as e:
            return False, f"Connection error: {str(e)}"

    def get_libraries(self) -> list[dict[str, Any]]:
        """Get all libraries from Plex."""
        server = self._get_server()
        libraries = []

        for section in server.library.sections():
            libraries.append({
                "id": str(section.key),
                "title": section.title,
                "type": section.type,
                "uuid": section.uuid,
                "total_items": section.totalSize,
            })

        return libraries

    def get_library_content(
        self,
        library_id: str,
        content_type: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        Get content from a library.

        Args:
            library_id: Library section key
            content_type: Filter by type (movie, show, episode)
            limit: Maximum items to return

        Returns:
            List of content items
        """
        server = self._get_server()
        try:
            section = server.library.sectionByID(int(library_id))
        except NotFound:
            logger.warning(f"Library {library_id} not found")
            return []

        items = []
        all_items = section.all()

        if limit:
            all_items = all_items[:limit]

        for item in all_items:
            item_type = item.type

            # Handle shows - get episodes
            if item_type == "show" and (content_type is None or content_type == "episode"):
                for episode in item.episodes():
                    items.append(self._item_to_dict(episode, library_id))
            elif content_type is None or item_type == content_type:
                items.append(self._item_to_dict(item, library_id))

        return items

    def _item_to_dict(self, item: Any, library_id: str) -> dict[str, Any]:
        """Convert Plex item to dictionary."""
        base = {
            "plex_key": item.key,
            "title": item.title,
            "type": item.type,
            "duration_ms": item.duration or 0,
            "year": getattr(item, "year", None),
            "library_id": library_id,
            # Include genres for scoring
            "genres": [g.tag for g in getattr(item, "genres", [])],
            "content_rating": getattr(item, "contentRating", None),
            "rating": getattr(item, "rating", None),
            "audience_rating": getattr(item, "audienceRating", None),
        }

        # Add extra fields based on type
        if item.type == "episode":
            base["show_title"] = item.grandparentTitle
            base["season_number"] = item.parentIndex
            base["episode_number"] = item.index
            base["title"] = f"{item.grandparentTitle} - S{item.parentIndex:02d}E{item.index:02d} - {item.title}"
            # For episodes, genres might be empty - use show genres if available
            if not base["genres"] and hasattr(item, "grandparentRatingKey"):
                try:
                    show = self._get_server().fetchItem(item.grandparentRatingKey)
                    base["genres"] = [g.tag for g in getattr(show, "genres", [])]
                except Exception:
                    pass  # Keep empty genres if we can't fetch show

        # Add rating key as unique identifier
        base["rating_key"] = str(item.ratingKey)

        return base

    def get_content_metadata(self, plex_key: str) -> dict[str, Any] | None:
        """
        Get detailed metadata for a content item.

        Args:
            plex_key: Plex content key

        Returns:
            Metadata dictionary or None if not found
        """
        server = self._get_server()
        try:
            item = server.fetchItem(plex_key)
        except NotFound:
            return None

        metadata = {
            "plex_key": item.key,
            "title": item.title,
            "type": item.type,
            "duration_ms": item.duration or 0,
            "year": getattr(item, "year", None),
            "genres": [g.tag for g in getattr(item, "genres", [])],
            "directors": [d.tag for d in getattr(item, "directors", [])],
            "actors": [a.tag for a in getattr(item, "roles", [])][:10],  # Top 10
            "studio": getattr(item, "studio", None),
            "content_rating": getattr(item, "contentRating", None),
            "summary": getattr(item, "summary", None),
            "rating": getattr(item, "rating", None),
            "audience_rating": getattr(item, "audienceRating", None),
        }

        # Add TMDB/IMDB IDs from guids
        guids = getattr(item, "guids", [])
        for guid in guids:
            guid_str = str(guid.id)
            if "tmdb://" in guid_str:
                metadata["tmdb_id"] = guid_str.replace("tmdb://", "")
            elif "imdb://" in guid_str:
                metadata["imdb_id"] = guid_str.replace("imdb://", "")

        return metadata

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
            library_id: Optional library to search in
            limit: Maximum results

        Returns:
            List of matching items
        """
        server = self._get_server()

        if library_id:
            section = server.library.sectionByID(int(library_id))
            results = section.search(query, limit=limit)
        else:
            results = server.search(query, limit=limit)

        return [
            self._item_to_dict(item, library_id or "0")
            for item in results
        ]
