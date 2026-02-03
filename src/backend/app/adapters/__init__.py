"""External service adapters."""

from app.adapters.plex_adapter import PlexAdapter
from app.adapters.tunarr_adapter import TunarrAdapter

__all__ = ["TunarrAdapter", "PlexAdapter"]
