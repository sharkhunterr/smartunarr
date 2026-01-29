"""Content enrichment service with caching and TMDB integration."""

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.content import Content, ContentMeta
from app.services.tmdb_service import TMDBService

logger = logging.getLogger(__name__)


class ContentEnrichmentService:
    """Service for caching and enriching content with TMDB metadata."""

    def __init__(
        self,
        session: AsyncSession,
        tmdb_service: TMDBService | None = None,
    ) -> None:
        """
        Initialize the enrichment service.

        Args:
            session: Database session
            tmdb_service: Optional TMDB service for enrichment
        """
        self.session = session
        self.tmdb_service = tmdb_service

    async def get_or_cache_content(
        self,
        plex_key: str,
        plex_data: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, Any] | None]:
        """
        Get content from cache or create from Plex data.

        Args:
            plex_key: Plex content key
            plex_data: Data from Plex adapter

        Returns:
            (content_dict, meta_dict) tuple
        """
        # Check if content exists in cache
        # Use selectinload to eagerly load the meta relationship
        stmt = select(Content).options(selectinload(Content.meta)).where(Content.plex_key == plex_key)
        result = await self.session.execute(stmt)
        content = result.scalar_one_or_none()

        if content:
            # Return cached content and meta
            meta_dict = None
            if content.meta:
                meta_dict = {
                    "genres": content.meta.genres or [],
                    "keywords": content.meta.keywords or [],
                    "age_rating": content.meta.age_rating,
                    "tmdb_rating": content.meta.tmdb_rating,
                    "vote_count": content.meta.vote_count,
                    "budget": content.meta.budget,
                    "revenue": content.meta.revenue,
                    "studios": content.meta.studios or [],
                    "collections": content.meta.collections or [],
                    "content_rating": content.meta.age_rating,
                }
            return self._content_to_dict(content, plex_data), meta_dict

        # Create new content from Plex data
        content = Content(
            plex_key=plex_key,
            title=plex_data.get("title", ""),
            type=plex_data.get("type", "movie"),
            duration_ms=plex_data.get("duration_ms", 0),
            year=plex_data.get("year"),
            library_id=plex_data.get("library_id", ""),
        )
        self.session.add(content)

        # Create metadata from Plex data if available
        # Priority: tmdb_rating (from TMDB enrichment) > rating (from Plex)
        meta = ContentMeta(
            content=content,
            genres=plex_data.get("genres", []),
            age_rating=plex_data.get("content_rating"),
            tmdb_rating=plex_data.get("tmdb_rating") or plex_data.get("rating"),
            vote_count=plex_data.get("vote_count", 0),
            budget=plex_data.get("budget"),
            revenue=plex_data.get("revenue"),
            keywords=plex_data.get("keywords", []),
            studios=plex_data.get("studios", []),
            collections=plex_data.get("collections", []),
        )
        self.session.add(meta)

        await self.session.flush()

        meta_dict = {
            "genres": meta.genres or [],
            "content_rating": meta.age_rating,
            "tmdb_rating": meta.tmdb_rating,
            "vote_count": meta.vote_count,
            "budget": meta.budget,
            "revenue": meta.revenue,
            "keywords": meta.keywords or [],
            "studios": meta.studios or [],
            "collections": meta.collections or [],
        }

        return self._content_to_dict(content, plex_data), meta_dict

    async def enrich_with_tmdb(
        self,
        content_id: str,
        title: str,
        content_type: str,
        year: int | None = None,
        force: bool = False,
    ) -> dict[str, Any] | None:
        """
        Enrich content with TMDB metadata.

        Args:
            content_id: Content database ID
            title: Content title
            content_type: Type (movie/episode)
            year: Release year
            force: Force re-enrichment even if cached

        Returns:
            Enriched metadata or None
        """
        if not self.tmdb_service:
            return None

        # Get existing content with eager loading of meta
        stmt = select(Content).options(selectinload(Content.meta)).where(Content.plex_key == content_id)
        result = await self.session.execute(stmt)
        content = result.scalar_one_or_none()
        if not content:
            return None

        # Check if already enriched recently (within 7 days)
        if content.meta and content.meta.enriched_at and not force:
            if datetime.utcnow() - content.meta.enriched_at < timedelta(days=7):
                return self._meta_to_dict(content.meta)

        # Enrich with TMDB
        tmdb_data = await self.tmdb_service.enrich_content(
            title, content_type, year
        )

        if not tmdb_data:
            return None

        # Update or create metadata
        if content.meta:
            meta = content.meta
        else:
            meta = ContentMeta(content=content)
            self.session.add(meta)

        # Update fields from TMDB
        meta.tmdb_id = tmdb_data.get("tmdb_id")
        meta.genres = tmdb_data.get("genres", [])
        meta.keywords = tmdb_data.get("keywords", [])
        meta.age_rating = tmdb_data.get("age_rating")
        meta.tmdb_rating = tmdb_data.get("tmdb_rating")
        meta.vote_count = tmdb_data.get("vote_count", 0)
        meta.budget = tmdb_data.get("budget")
        meta.revenue = tmdb_data.get("revenue")
        meta.studios = tmdb_data.get("studios", [])
        meta.collections = tmdb_data.get("collections", [])
        meta.enriched_at = datetime.utcnow()

        await self.session.flush()

        return self._meta_to_dict(meta)

    async def update_content_meta(
        self,
        plex_key: str,
        meta_data: dict[str, Any],
    ) -> bool:
        """
        Update content metadata in the database.

        Args:
            plex_key: Plex content key
            meta_data: New metadata values to update

        Returns:
            True if updated successfully, False otherwise
        """
        # Get existing content with eager loading of meta
        stmt = select(Content).options(selectinload(Content.meta)).where(Content.plex_key == plex_key)
        result = await self.session.execute(stmt)
        content = result.scalar_one_or_none()

        if not content or not content.meta:
            return False

        meta = content.meta

        # Update fields from meta_data
        if "genres" in meta_data:
            meta.genres = meta_data["genres"]
        if "keywords" in meta_data:
            meta.keywords = meta_data["keywords"]
        if "age_rating" in meta_data:
            meta.age_rating = meta_data["age_rating"]
        if "tmdb_rating" in meta_data and meta_data["tmdb_rating"] is not None:
            meta.tmdb_rating = meta_data["tmdb_rating"]
        if "vote_count" in meta_data and meta_data["vote_count"] is not None:
            meta.vote_count = meta_data["vote_count"]
        if "budget" in meta_data:
            meta.budget = meta_data["budget"]
        if "revenue" in meta_data:
            meta.revenue = meta_data["revenue"]
        if "studios" in meta_data:
            meta.studios = meta_data["studios"]
        if "collections" in meta_data:
            meta.collections = meta_data["collections"]

        meta.enriched_at = datetime.utcnow()

        await self.session.flush()
        return True

    async def batch_enrich_from_plex(
        self,
        plex_items: list[dict[str, Any]],
        enrich_with_tmdb: bool = False,
    ) -> list[tuple[dict[str, Any], dict[str, Any] | None]]:
        """
        Process a batch of Plex items, caching and optionally enriching.

        Args:
            plex_items: List of items from Plex adapter
            enrich_with_tmdb: Whether to enrich with TMDB

        Returns:
            List of (content, meta) tuples
        """
        results = []
        items_to_enrich = []

        for item in plex_items:
            plex_key = item.get("plex_key", "")
            if not plex_key:
                continue

            content_dict, meta_dict = await self.get_or_cache_content(
                plex_key, item
            )
            results.append((content_dict, meta_dict))

            # Track items that need TMDB enrichment
            if enrich_with_tmdb and self.tmdb_service:
                # Check if needs enrichment
                needs_enrich = (
                    not meta_dict or
                    not meta_dict.get("tmdb_rating") or
                    not meta_dict.get("genres")
                )
                if needs_enrich:
                    items_to_enrich.append((
                        len(results) - 1,  # index in results
                        content_dict.get("id"),
                        content_dict.get("title"),
                        content_dict.get("type"),
                        content_dict.get("year"),
                    ))

        # Batch enrich with TMDB
        if items_to_enrich and self.tmdb_service:
            logger.info(f"Enriching {len(items_to_enrich)} items with TMDB")
            for idx, content_id, title, content_type, year in items_to_enrich:
                enriched = await self.enrich_with_tmdb(
                    content_id, title, content_type, year
                )
                if enriched:
                    # Update the results
                    content_dict, _ = results[idx]
                    results[idx] = (content_dict, enriched)

        await self.session.commit()
        return results

    async def get_cached_contents(
        self,
        library_id: str | None = None,
        content_type: str | None = None,
    ) -> list[tuple[dict[str, Any], dict[str, Any] | None]]:
        """
        Get cached contents from database.

        Args:
            library_id: Filter by library
            content_type: Filter by type

        Returns:
            List of (content, meta) tuples
        """
        # Use selectinload to eagerly load the meta relationship
        # This avoids lazy loading issues with async sessions
        stmt = select(Content).options(selectinload(Content.meta))
        if library_id:
            stmt = stmt.where(Content.library_id == library_id)
        if content_type:
            stmt = stmt.where(Content.type == content_type)

        result = await self.session.execute(stmt)
        contents = result.scalars().all()

        return [
            (self._content_to_dict(c), self._meta_to_dict(c.meta) if c.meta else None)
            for c in contents
        ]

    async def get_cached_content(
        self,
        plex_key: str,
    ) -> tuple[dict[str, Any], dict[str, Any] | None] | None:
        """
        Get a single cached content by plex_key.

        Args:
            plex_key: The Plex key to look up

        Returns:
            Tuple of (content, meta) or None if not found
        """
        stmt = select(Content).options(selectinload(Content.meta)).where(
            Content.plex_key == plex_key
        )
        result = await self.session.execute(stmt)
        content = result.scalar_one_or_none()

        if content:
            return (
                self._content_to_dict(content),
                self._meta_to_dict(content.meta) if content.meta else None
            )
        return None

    async def save_content_with_meta(
        self,
        plex_key: str,
        content_data: dict[str, Any],
        meta_data: dict[str, Any],
    ) -> bool:
        """
        Save content and metadata to the cache database.

        This is used to cache TMDB enrichment results for future "cache only" requests.

        Args:
            plex_key: Unique content key (from Tunarr's externalKey/plexKey)
            content_data: Content info (title, type, duration_ms, year)
            meta_data: Metadata from TMDB (genres, tmdb_rating, age_rating, etc.)

        Returns:
            True if saved successfully, False otherwise
        """
        if not plex_key:
            return False

        try:
            # Check if content already exists
            stmt = select(Content).options(selectinload(Content.meta)).where(
                Content.plex_key == plex_key
            )
            result = await self.session.execute(stmt)
            content = result.scalar_one_or_none()

            if content:
                # Update existing content's metadata
                if content.meta:
                    meta = content.meta
                else:
                    meta = ContentMeta(content=content)
                    self.session.add(meta)

                # Update meta fields
                if meta_data.get("genres"):
                    meta.genres = meta_data["genres"]
                if meta_data.get("keywords"):
                    meta.keywords = meta_data["keywords"]
                if meta_data.get("age_rating"):
                    meta.age_rating = meta_data["age_rating"]
                if meta_data.get("tmdb_rating") is not None:
                    meta.tmdb_rating = meta_data["tmdb_rating"]
                if meta_data.get("vote_count") is not None:
                    meta.vote_count = meta_data["vote_count"]
                if meta_data.get("budget"):
                    meta.budget = meta_data["budget"]
                if meta_data.get("revenue"):
                    meta.revenue = meta_data["revenue"]
                if meta_data.get("studios"):
                    meta.studios = meta_data["studios"]
                if meta_data.get("collections"):
                    meta.collections = meta_data["collections"]
                meta.enriched_at = datetime.utcnow()
            else:
                # Create new content
                content = Content(
                    plex_key=plex_key,
                    title=content_data.get("title", ""),
                    type=content_data.get("type", "movie"),
                    duration_ms=content_data.get("duration_ms", 0),
                    year=content_data.get("year"),
                    library_id=content_data.get("library_id", "tunarr"),
                )
                self.session.add(content)

                # Create metadata
                meta = ContentMeta(
                    content=content,
                    genres=meta_data.get("genres", []),
                    keywords=meta_data.get("keywords", []),
                    age_rating=meta_data.get("age_rating"),
                    tmdb_rating=meta_data.get("tmdb_rating"),
                    vote_count=meta_data.get("vote_count", 0),
                    budget=meta_data.get("budget"),
                    revenue=meta_data.get("revenue"),
                    studios=meta_data.get("studios", []),
                    collections=meta_data.get("collections", []),
                    enriched_at=datetime.utcnow(),
                )
                self.session.add(meta)

            await self.session.flush()
            return True

        except Exception as e:
            logger.error(f"Failed to save content {plex_key}: {e}")
            return False

    def _content_to_dict(
        self,
        content: Content,
        plex_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Convert Content model to dict."""
        return {
            "id": content.plex_key,
            "plex_key": content.plex_key,
            "title": content.title,
            "type": content.type,
            "duration_ms": content.duration_ms,
            "year": content.year,
            "library_id": content.library_id,
            # Include Plex-specific fields if provided
            "rating_key": plex_data.get("rating_key") if plex_data else None,
        }

    def _meta_to_dict(self, meta: ContentMeta) -> dict[str, Any]:
        """Convert ContentMeta model to dict."""
        return {
            "genres": meta.genres or [],
            "keywords": meta.keywords or [],
            "age_rating": meta.age_rating,
            "content_rating": meta.age_rating,
            "tmdb_rating": meta.tmdb_rating,
            "vote_count": meta.vote_count,
            "budget": meta.budget,
            "revenue": meta.revenue,
            "studios": meta.studios or [],
            "collections": meta.collections or [],
        }
