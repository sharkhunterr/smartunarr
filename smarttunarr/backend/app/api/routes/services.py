"""Services API routes for external service configuration."""

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import delete

from app.db.database import get_session
from app.models.content import Content, ContentMeta
from app.services.service_config_service import ServiceConfigService
from app.services.plex_service import PlexService
from app.services.tunarr_service import TunarrService
from app.services.tmdb_service import TMDBService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/services", tags=["services"])

ServiceType = Literal["plex", "tunarr", "tmdb", "ollama"]


class ServiceConfigUpdate(BaseModel):
    """Service configuration update schema."""
    url: str | None = None
    username: str | None = None
    password: str | None = None
    token: str | None = None
    api_key: str | None = None


class ServiceConfigResponse(BaseModel):
    """Service configuration response schema."""
    service_type: str
    url: str | None = None
    username: str | None = None
    has_token: bool = False
    has_api_key: bool = False
    is_configured: bool = False


class ConnectionTestResponse(BaseModel):
    """Connection test response schema."""
    success: bool
    message: str


@router.get("", response_model=list[ServiceConfigResponse])
async def list_services(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """List all service configurations."""
    service = ServiceConfigService(session)
    configs = await service.get_all_services()

    # Include all service types, even unconfigured ones
    all_services = {"plex", "tunarr", "tmdb", "ollama"}
    configured_types = {c.type for c in configs}

    result = []

    for config in configs:
        result.append({
            "service_type": config.type,
            "url": config.url,
            "username": config.username,
            "has_token": bool(config.token),
            "has_api_key": bool(config.api_key),
            "is_configured": True,
        })

    # Add unconfigured services
    for service_type in all_services - configured_types:
        result.append({
            "service_type": service_type,
            "url": None,
            "username": None,
            "has_token": False,
            "has_api_key": False,
            "is_configured": False,
        })

    return result


@router.get("/{service_type}", response_model=ServiceConfigResponse)
async def get_service_config(
    service_type: ServiceType,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Get service configuration."""
    service = ServiceConfigService(session)
    config = await service.get_service(service_type)

    if not config:
        return {
            "service_type": service_type,
            "url": None,
            "username": None,
            "has_token": False,
            "has_api_key": False,
            "is_configured": False,
        }

    return {
        "service_type": config.type,
        "url": config.url,
        "username": config.username,
        "has_token": bool(config.token),
        "has_api_key": bool(config.api_key),
        "is_configured": True,
    }


@router.put("/{service_type}", response_model=ServiceConfigResponse)
async def update_service_config(
    service_type: ServiceType,
    data: ServiceConfigUpdate,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Update service configuration."""
    service = ServiceConfigService(session)
    config = await service.create_or_update_service(
        service_type=service_type,
        config={
            "url": data.url,
            "username": data.username,
            "password": data.password,
            "token": data.token,
            "api_key": data.api_key,
        },
    )

    return {
        "service_type": config.type,
        "url": config.url,
        "username": config.username,
        "has_token": bool(config.token),
        "has_api_key": bool(config.api_key),
        "is_configured": True,
    }


@router.delete("/{service_type}", status_code=204)
async def delete_service_config(
    service_type: ServiceType,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete service configuration."""
    service = ServiceConfigService(session)
    success = await service.delete_service(service_type)
    if not success:
        raise HTTPException(status_code=404, detail="Service configuration not found")


@router.post("/{service_type}/test", response_model=ConnectionTestResponse)
async def test_service(
    service_type: ServiceType,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Test service connection."""
    config_service = ServiceConfigService(session)
    config = await config_service.get_service(service_type)

    if not config:
        return {"success": False, "message": "Service not configured"}

    try:
        creds = config_service.get_decrypted_credentials(config)

        if service_type == "plex":
            if not config.url or not creds.get("token"):
                return {"success": False, "message": "Plex URL and token required"}

            plex = PlexService(config.url, creds["token"])
            success, message = plex.test_connection()
            return {"success": success, "message": message}

        elif service_type == "tunarr":
            if not config.url:
                return {"success": False, "message": "Tunarr URL required"}

            tunarr = TunarrService(config.url, config.username, creds.get("password"))
            success, message = await tunarr.test_connection()
            await tunarr.close()
            return {"success": success, "message": message}

        elif service_type == "tmdb":
            if not creds.get("api_key"):
                return {"success": False, "message": "TMDB API key required"}

            tmdb = TMDBService(creds["api_key"])
            success, message = await tmdb.test_connection()
            await tmdb.close()
            return {"success": success, "message": message}

        elif service_type == "ollama":
            if not config.url:
                return {"success": False, "message": "Ollama URL required"}

            # Simple test for Ollama
            import httpx
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get(f"{config.url}/api/tags", timeout=10.0)
                    if response.status_code == 200:
                        data = response.json()
                        models = data.get("models", [])
                        return {
                            "success": True,
                            "message": f"Connected to Ollama ({len(models)} models available)"
                        }
                    return {"success": False, "message": f"Ollama returned status {response.status_code}"}
                except Exception as e:
                    return {"success": False, "message": f"Connection failed: {str(e)}"}

        else:
            return {"success": False, "message": f"Unknown service type: {service_type}"}

    except Exception as e:
        logger.error(f"Service test failed for {service_type}: {e}")
        return {"success": False, "message": f"Test failed: {str(e)}"}


# Plex-specific endpoints
@router.get("/plex/libraries")
async def get_plex_libraries(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get Plex libraries."""
    config_service = ServiceConfigService(session)
    config = await config_service.get_service("plex")

    if not config or not config.url or not config.token:
        raise HTTPException(status_code=400, detail="Plex not configured")

    creds = config_service.get_decrypted_credentials(config)
    plex = PlexService(config.url, creds["token"])

    try:
        return plex.get_libraries()
    except Exception as e:
        logger.error(f"Failed to get Plex libraries: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get libraries: {str(e)}")


@router.get("/plex/libraries/{library_id}/content")
async def get_plex_library_content(
    library_id: str,
    content_type: str | None = Query(None, description="Filter by content type"),
    limit: int = Query(100, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get content from a Plex library."""
    config_service = ServiceConfigService(session)
    config = await config_service.get_service("plex")

    if not config or not config.url or not config.token:
        raise HTTPException(status_code=400, detail="Plex not configured")

    creds = config_service.get_decrypted_credentials(config)
    plex = PlexService(config.url, creds["token"])

    try:
        return plex.get_library_content(library_id, content_type, limit)
    except Exception as e:
        logger.error(f"Failed to get Plex content: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get content: {str(e)}")


# Tunarr-specific endpoints
@router.get("/tunarr/channels")
async def get_tunarr_channels(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get Tunarr channels."""
    config_service = ServiceConfigService(session)
    config = await config_service.get_service("tunarr")

    if not config or not config.url:
        raise HTTPException(status_code=400, detail="Tunarr not configured")

    creds = config_service.get_decrypted_credentials(config)
    tunarr = TunarrService(config.url, config.username, creds.get("password"))

    try:
        channels = await tunarr.get_channels()
        await tunarr.close()
        return channels
    except Exception as e:
        logger.error(f"Failed to get Tunarr channels: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get channels: {str(e)}")


# TMDB-specific endpoints
@router.get("/tmdb/search")
async def search_tmdb(
    query: str = Query(..., min_length=1),
    content_type: Literal["movie", "tv"] = Query("movie"),
    year: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Search TMDB for content."""
    config_service = ServiceConfigService(session)
    config = await config_service.get_service("tmdb")

    if not config or not config.api_key:
        raise HTTPException(status_code=400, detail="TMDB not configured")

    creds = config_service.get_decrypted_credentials(config)
    tmdb = TMDBService(creds["api_key"])

    try:
        if content_type == "movie":
            results = await tmdb.search_movie(query, year)
        else:
            results = await tmdb.search_tv(query, year)
        await tmdb.close()
        return results
    except Exception as e:
        logger.error(f"TMDB search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


# Ollama-specific endpoints
@router.get("/ollama/models")
async def get_ollama_models(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get available Ollama models."""
    config_service = ServiceConfigService(session)
    config = await config_service.get_service("ollama")

    if not config or not config.url:
        raise HTTPException(status_code=400, detail="Ollama not configured")

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{config.url}/api/tags", timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                return data.get("models", [])
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Ollama returned status {response.status_code}"
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")


# Cache management endpoints
@router.delete("/cache/content")
async def clear_content_cache(
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Clear all cached content and metadata.

    This forces a fresh fetch from Plex and TMDB on next programming generation.
    Use this to re-enrich content with updated TMDB data (budget, revenue, etc.).
    """
    # Delete all ContentMeta first (due to foreign key)
    meta_result = await session.execute(delete(ContentMeta))
    meta_count = meta_result.rowcount

    # Delete all Content
    content_result = await session.execute(delete(Content))
    content_count = content_result.rowcount

    await session.commit()

    logger.info(f"Cleared content cache: {content_count} contents, {meta_count} metadata")

    return {
        "success": True,
        "deleted_content": content_count,
        "deleted_metadata": meta_count,
        "message": f"Cleared {content_count} contents and {meta_count} metadata entries",
    }
