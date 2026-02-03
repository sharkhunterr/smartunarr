"""TMDBService with rate limiting for metadata enrichment."""

import asyncio
import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class TMDBService:
    """Service for TMDB API interactions with rate limiting."""

    BASE_URL = "https://api.themoviedb.org/3"

    def __init__(
        self,
        api_key: str,
        rate_limit: int = 40,
        rate_window: int = 10,
    ) -> None:
        """
        Initialize TMDB service.

        Args:
            api_key: TMDB API key
            rate_limit: Max requests per window (default 40)
            rate_window: Window size in seconds (default 10)
        """
        self.api_key = api_key
        self.rate_limit = rate_limit
        self.rate_window = rate_window
        self._request_times: list[float] = []
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                timeout=30.0,
            )
        return self._client

    async def close(self) -> None:
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _rate_limit_wait(self) -> None:
        """Wait if necessary to respect rate limits."""
        now = time.time()

        # Remove old request times
        self._request_times = [t for t in self._request_times if now - t < self.rate_window]

        # Wait if at limit
        if len(self._request_times) >= self.rate_limit:
            oldest = self._request_times[0]
            wait_time = self.rate_window - (now - oldest)
            if wait_time > 0:
                logger.debug(f"Rate limit reached, waiting {wait_time:.2f}s")
                await asyncio.sleep(wait_time)

        self._request_times.append(time.time())

    async def _request(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """
        Make a rate-limited request to TMDB API.

        Args:
            endpoint: API endpoint
            params: Query parameters

        Returns:
            Response data or None on error
        """
        await self._rate_limit_wait()

        client = await self._get_client()
        params = params or {}
        params["api_key"] = self.api_key

        try:
            response = await client.get(endpoint, params=params)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                # Rate limited, wait and retry
                retry_after = int(response.headers.get("Retry-After", "5"))
                logger.warning(f"TMDB rate limited, waiting {retry_after}s")
                await asyncio.sleep(retry_after)
                return await self._request(endpoint, params)
            else:
                logger.error(f"TMDB request failed: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"TMDB request error: {e}")
            return None

    async def test_connection(self) -> tuple[bool, str]:
        """
        Test connection to TMDB API.

        Returns:
            (success, message) tuple
        """
        try:
            result = await self._request("/configuration")
            if result:
                return True, "Connected to TMDB API"
            return False, "Invalid API response"
        except Exception as e:
            return False, f"Connection error: {str(e)}"

    async def search_movie(
        self,
        query: str,
        year: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        Search for movies.

        Args:
            query: Search query
            year: Optional release year

        Returns:
            List of movie results
        """
        params: dict[str, Any] = {"query": query}
        if year:
            params["year"] = year

        result = await self._request("/search/movie", params)
        return result.get("results", []) if result else []

    async def search_tv(
        self,
        query: str,
        year: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        Search for TV shows.

        Args:
            query: Search query
            year: Optional first air year

        Returns:
            List of TV show results
        """
        params: dict[str, Any] = {"query": query}
        if year:
            params["first_air_date_year"] = year

        result = await self._request("/search/tv", params)
        return result.get("results", []) if result else []

    async def get_movie_details(self, movie_id: int) -> dict[str, Any] | None:
        """
        Get movie details.

        Args:
            movie_id: TMDB movie ID

        Returns:
            Movie details or None
        """
        return await self._request(
            f"/movie/{movie_id}",
            {"append_to_response": "keywords,credits,release_dates"},
        )

    async def get_tv_details(self, tv_id: int) -> dict[str, Any] | None:
        """
        Get TV show details.

        Args:
            tv_id: TMDB TV show ID

        Returns:
            TV show details or None
        """
        return await self._request(
            f"/tv/{tv_id}",
            {"append_to_response": "keywords,credits,content_ratings"},
        )

    async def enrich_content(
        self,
        title: str,
        content_type: str,
        year: int | None = None,
    ) -> dict[str, Any] | None:
        """
        Enrich content with TMDB metadata.

        Args:
            title: Content title
            content_type: Type (movie/episode)
            year: Release year

        Returns:
            Enriched metadata or None
        """
        # Search for the content
        if content_type == "movie":
            results = await self.search_movie(title, year)
            if results:
                details = await self.get_movie_details(results[0]["id"])
                if details:
                    return self._parse_movie_details(details)
        elif content_type in ["episode", "show"]:
            results = await self.search_tv(title, year)
            if results:
                details = await self.get_tv_details(results[0]["id"])
                if details:
                    return self._parse_tv_details(details)

        return None

    def _parse_movie_details(self, details: dict[str, Any]) -> dict[str, Any]:
        """Parse movie details into enriched metadata."""
        # Extract genres
        genres = [g["name"] for g in details.get("genres", [])]

        # Extract keywords
        keywords_data = details.get("keywords", {}).get("keywords", [])
        keywords = [k["name"] for k in keywords_data]

        # Extract studios
        studios = [c["name"] for c in details.get("production_companies", [])]

        # Extract age rating
        age_rating = None
        release_dates = details.get("release_dates", {}).get("results", [])
        for country_data in release_dates:
            if country_data["iso_3166_1"] == "US":
                for release in country_data.get("release_dates", []):
                    if release.get("certification"):
                        age_rating = release["certification"]
                        break

        # Extract collections
        collections = []
        if details.get("belongs_to_collection"):
            collections.append(details["belongs_to_collection"]["name"])

        return {
            "tmdb_id": details["id"],
            "genres": genres,
            "keywords": keywords,
            "age_rating": age_rating,
            "tmdb_rating": details.get("vote_average"),
            "vote_count": details.get("vote_count", 0),
            "budget": details.get("budget"),
            "revenue": details.get("revenue"),
            "studios": studios,
            "collections": collections,
        }

    def _parse_tv_details(self, details: dict[str, Any]) -> dict[str, Any]:
        """Parse TV show details into enriched metadata."""
        # Extract genres
        genres = [g["name"] for g in details.get("genres", [])]

        # Extract keywords
        keywords_data = details.get("keywords", {}).get("results", [])
        keywords = [k["name"] for k in keywords_data]

        # Extract studios (networks)
        studios = [n["name"] for n in details.get("networks", [])]

        # Extract age rating
        age_rating = None
        content_ratings = details.get("content_ratings", {}).get("results", [])
        for rating in content_ratings:
            if rating["iso_3166_1"] == "US":
                age_rating = rating["rating"]
                break

        return {
            "tmdb_id": details["id"],
            "genres": genres,
            "keywords": keywords,
            "age_rating": age_rating,
            "tmdb_rating": details.get("vote_average"),
            "vote_count": details.get("vote_count", 0),
            "budget": None,
            "revenue": None,
            "studios": studios,
            "collections": [],
        }

    async def batch_enrich(
        self,
        items: list[dict[str, Any]],
        batch_size: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Batch enrich multiple content items.

        Args:
            items: List of items with title, type, year
            batch_size: Items to process in parallel

        Returns:
            List of enriched items (matching input order)
        """
        results = []

        for i in range(0, len(items), batch_size):
            batch = items[i : i + batch_size]
            tasks = [
                self.enrich_content(
                    item.get("title", ""),
                    item.get("type", "movie"),
                    item.get("year"),
                )
                for item in batch
            ]
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)

        return results
