"""Profiles API routes."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.schemas.profile_schema import ProfileCreate, ProfileResponse, ProfileUpdate
from app.services.profile_service import ProfileService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("", response_model=list[ProfileResponse])
async def list_profiles(
    label: str | None = Query(None, description="Filter by label"),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """List all profiles with optional label filter."""
    service = ProfileService(session)
    profiles = await service.list_profiles(label=label)
    return [service.profile_to_response(p) for p in profiles]


@router.post("", response_model=ProfileResponse, status_code=201)
async def create_profile(
    data: ProfileCreate,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Create a new profile."""
    service = ProfileService(session)
    profile = await service.create_profile(data)
    return service.profile_to_response(profile)


@router.get("/{profile_id}", response_model=ProfileResponse)
async def get_profile(
    profile_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Get a profile by ID."""
    service = ProfileService(session)
    profile = await service.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return service.profile_to_response(profile)


@router.put("/{profile_id}", response_model=ProfileResponse)
async def update_profile(
    profile_id: str,
    data: ProfileUpdate,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Update a profile."""
    service = ProfileService(session)
    profile = await service.update_profile(profile_id, data)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return service.profile_to_response(profile)


@router.delete("/{profile_id}", status_code=204)
async def delete_profile(
    profile_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a profile."""
    service = ProfileService(session)
    success = await service.delete_profile(profile_id)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")


@router.post("/{profile_id}/duplicate", response_model=ProfileResponse, status_code=201)
async def duplicate_profile(
    profile_id: str,
    new_name: str = Query(..., description="Name for the duplicated profile"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Duplicate an existing profile."""
    service = ProfileService(session)
    profile = await service.duplicate_profile(profile_id, new_name)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return service.profile_to_response(profile)


@router.get("/{profile_id}/export")
async def export_profile(
    profile_id: str,
    session: AsyncSession = Depends(get_session),
) -> JSONResponse:
    """Export a profile as JSON."""
    service = ProfileService(session)
    profile = await service.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile_data = service.export_profile(profile)
    filename = f"profile_{profile.name.lower().replace(' ', '_')}.json"

    return JSONResponse(
        content=profile_data, headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/import", response_model=ProfileResponse, status_code=201)
async def import_profile(
    profile_data: dict[str, Any],
    overwrite: bool = Query(False, description="Overwrite existing profile with same ID"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Import a profile from JSON data."""
    service = ProfileService(session)
    try:
        profile = await service.import_profile(profile_data, overwrite=overwrite)
        return service.profile_to_response(profile)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/validate")
async def validate_profile_route(
    profile_data: dict[str, Any],
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Validate profile data without saving."""
    service = ProfileService(session)
    result = service.validate_profile(profile_data)
    return {"valid": result.valid, "errors": result.errors, "warnings": result.warnings}


@router.get("/{profile_id}/stats")
async def get_profile_stats(
    profile_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Get usage statistics for a profile."""
    service = ProfileService(session)
    profile = await service.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Calculate statistics
    time_blocks = profile.time_blocks or []
    libraries = profile.libraries or []
    mf_criteria = profile.mandatory_forbidden_criteria or {}

    total_block_duration = 0
    for block in time_blocks:
        # Parse time strings to calculate duration
        start_str = block.get("start_time", "00:00")
        end_str = block.get("end_time", "00:00")
        start_parts = start_str.split(":")
        end_parts = end_str.split(":")
        start_minutes = int(start_parts[0]) * 60 + int(start_parts[1])
        end_minutes = int(end_parts[0]) * 60 + int(end_parts[1])
        if end_minutes <= start_minutes:
            end_minutes += 1440  # Midnight spanning
        total_block_duration += end_minutes - start_minutes

    forbidden = mf_criteria.get("forbidden", {})
    mandatory = mf_criteria.get("mandatory", {})

    return {
        "profile_id": profile_id,
        "name": profile.name,
        "time_blocks_count": len(time_blocks),
        "total_block_duration_minutes": total_block_duration,
        "libraries_count": len(libraries),
        "forbidden_types_count": len(forbidden.get("types", [])),
        "forbidden_genres_count": len(forbidden.get("genres", [])),
        "mandatory_genres_count": len(mandatory.get("required_genres", [])),
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }
