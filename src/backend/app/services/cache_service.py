"""Cache service for metadata and frequently accessed data."""

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Generic, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass
class CacheEntry(Generic[T]):
    """A cached value with expiration."""

    value: T
    expires_at: datetime
    created_at: datetime = field(default_factory=datetime.utcnow)
    hits: int = 0

    @property
    def is_expired(self) -> bool:
        """Check if the entry has expired."""
        return datetime.utcnow() > self.expires_at


class CacheService:
    """In-memory cache service with TTL support."""

    def __init__(
        self,
        default_ttl: int = 300,
        max_size: int = 1000,
        cleanup_interval: int = 60,
    ) -> None:
        """
        Initialize cache service.

        Args:
            default_ttl: Default time-to-live in seconds
            max_size: Maximum number of entries
            cleanup_interval: Interval for automatic cleanup in seconds
        """
        self.default_ttl = default_ttl
        self.max_size = max_size
        self.cleanup_interval = cleanup_interval
        self._cache: dict[str, CacheEntry[Any]] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: asyncio.Task | None = None
        self._stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "evictions": 0,
        }

    async def start(self) -> None:
        """Start the background cleanup task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.info("Cache cleanup task started")

    async def stop(self) -> None:
        """Stop the background cleanup task."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
            logger.info("Cache cleanup task stopped")

    async def get(self, key: str) -> Any | None:
        """
        Get a value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/expired
        """
        async with self._lock:
            entry = self._cache.get(key)

            if entry is None:
                self._stats["misses"] += 1
                return None

            if entry.is_expired:
                del self._cache[key]
                self._stats["misses"] += 1
                return None

            entry.hits += 1
            self._stats["hits"] += 1
            return entry.value

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int | None = None,
    ) -> None:
        """
        Set a value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (uses default if not specified)
        """
        ttl = ttl or self.default_ttl

        async with self._lock:
            # Check size limit
            if len(self._cache) >= self.max_size and key not in self._cache:
                await self._evict_lru()

            self._cache[key] = CacheEntry(
                value=value,
                expires_at=datetime.utcnow() + timedelta(seconds=ttl),
            )
            self._stats["sets"] += 1

    async def delete(self, key: str) -> bool:
        """
        Delete a value from cache.

        Args:
            key: Cache key

        Returns:
            True if key was deleted, False if not found
        """
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching a pattern.

        Args:
            pattern: Key prefix pattern

        Returns:
            Number of deleted keys
        """
        async with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if k.startswith(pattern)]
            for key in keys_to_delete:
                del self._cache[key]
            return len(keys_to_delete)

    async def clear(self) -> None:
        """Clear all cached values."""
        async with self._lock:
            self._cache.clear()
            logger.info("Cache cleared")

    async def get_or_set(
        self,
        key: str,
        factory: Callable[[], Any],
        ttl: int | None = None,
    ) -> Any:
        """
        Get a value from cache or compute and store it.

        Args:
            key: Cache key
            factory: Function to compute value if not cached
            ttl: Time-to-live in seconds

        Returns:
            Cached or computed value
        """
        value = await self.get(key)
        if value is not None:
            return value

        # Compute value
        if asyncio.iscoroutinefunction(factory):
            value = await factory()
        else:
            value = factory()

        await self.set(key, value, ttl)
        return value

    def get_stats(self) -> dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Statistics dictionary
        """
        total_requests = self._stats["hits"] + self._stats["misses"]
        hit_rate = self._stats["hits"] / total_requests * 100 if total_requests > 0 else 0

        return {
            **self._stats,
            "size": len(self._cache),
            "max_size": self.max_size,
            "hit_rate_percent": round(hit_rate, 2),
        }

    async def _evict_lru(self) -> None:
        """Evict the least recently used entry."""
        if not self._cache:
            return

        # Find entry with lowest hit count
        lru_key = min(
            self._cache.keys(),
            key=lambda k: self._cache[k].hits,
        )
        del self._cache[lru_key]
        self._stats["evictions"] += 1

    async def _cleanup_expired(self) -> int:
        """
        Remove expired entries.

        Returns:
            Number of removed entries
        """
        async with self._lock:
            now = datetime.utcnow()
            expired_keys = [k for k, v in self._cache.items() if v.expires_at < now]
            for key in expired_keys:
                del self._cache[key]

            if expired_keys:
                logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")

            return len(expired_keys)

    async def _cleanup_loop(self) -> None:
        """Background task to clean up expired entries."""
        while True:
            try:
                await asyncio.sleep(self.cleanup_interval)
                await self._cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cache cleanup error: {e}")


# Global cache instance
_cache: CacheService | None = None


def get_cache() -> CacheService:
    """Get the global cache instance."""
    global _cache
    if _cache is None:
        _cache = CacheService()
    return _cache


def cached(
    key_prefix: str,
    ttl: int | None = None,
    key_builder: Callable[..., str] | None = None,
):
    """
    Decorator to cache function results.

    Args:
        key_prefix: Prefix for cache keys
        ttl: Time-to-live in seconds
        key_builder: Custom function to build cache key from arguments

    Usage:
        @cached("user", ttl=300)
        async def get_user(user_id: str):
            ...
    """

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache = get_cache()

            # Build cache key
            if key_builder:
                key = f"{key_prefix}:{key_builder(*args, **kwargs)}"
            else:
                key_parts = [str(a) for a in args] + [f"{k}={v}" for k, v in sorted(kwargs.items())]
                key = f"{key_prefix}:{':'.join(key_parts)}"

            # Check cache
            cached_value = await cache.get(key)
            if cached_value is not None:
                return cached_value

            # Call function
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)

            # Cache result
            await cache.set(key, result, ttl)
            return result

        return wrapper

    return decorator


# Cache key builders for common patterns
class CacheKeys:
    """Cache key builders for different data types."""

    @staticmethod
    def content(content_id: str) -> str:
        """Cache key for content."""
        return f"content:{content_id}"

    @staticmethod
    def content_meta(content_id: str) -> str:
        """Cache key for content metadata."""
        return f"content_meta:{content_id}"

    @staticmethod
    def channel(channel_id: str) -> str:
        """Cache key for channel."""
        return f"channel:{channel_id}"

    @staticmethod
    def profile(profile_id: str) -> str:
        """Cache key for profile."""
        return f"profile:{profile_id}"

    @staticmethod
    def plex_library(library_id: str) -> str:
        """Cache key for Plex library."""
        return f"plex_library:{library_id}"

    @staticmethod
    def tmdb_content(tmdb_id: int) -> str:
        """Cache key for TMDB content."""
        return f"tmdb:{tmdb_id}"

    @staticmethod
    def tunarr_channels() -> str:
        """Cache key for Tunarr channels list."""
        return "tunarr:channels"


# TTL configurations for different data types
class CacheTTL:
    """Standard TTL values for different data types."""

    SHORT = 60  # 1 minute - for frequently changing data
    MEDIUM = 300  # 5 minutes - for moderately changing data
    LONG = 3600  # 1 hour - for rarely changing data
    EXTENDED = 86400  # 24 hours - for static data

    # Specific TTLs
    PLEX_LIBRARY = LONG  # Libraries don't change often
    TMDB_METADATA = EXTENDED  # TMDB data is static
    TUNARR_CHANNELS = MEDIUM  # Channels might be added/removed
    PROFILE = MEDIUM  # Profiles might be edited
    CONTENT = LONG  # Content metadata is fairly static
