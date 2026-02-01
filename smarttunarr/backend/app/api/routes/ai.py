"""AI API routes for profile generation using Ollama."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.services.service_config_service import ServiceConfigService
from app.services.ai_profile_service import AIProfileService, GenerationResult
from app.services.profile_service import ProfileService
from app.schemas.profile_schema import ProfileCreate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


class AILibraryInfo(BaseModel):
    """Library info for AI context."""
    id: str
    name: str
    type: str


class GenerateProfileRequest(BaseModel):
    """Request schema for profile generation."""
    prompt: str = Field(..., min_length=10, description="Natural language description of desired profile")
    model: str | None = Field(None, description="Ollama model to use (default: auto)")
    temperature: float = Field(0.3, ge=0.0, le=1.0, description="Generation temperature")
    save_profile: bool = Field(False, description="Save generated profile to database")
    profile_name: str | None = Field(None, description="Name for saved profile (required if save_profile=True)")
    libraries: list[AILibraryInfo] | None = Field(None, description="Libraries to use for profile generation")


class ModifyProfileRequest(BaseModel):
    """Request schema for profile modification."""
    profile_id: str = Field(..., description="ID of profile to modify")
    modification: str = Field(..., min_length=5, description="What to change")
    model: str | None = Field(None, description="Ollama model to use")
    save_changes: bool = Field(False, description="Save changes to database")


class GenerationAttemptResponse(BaseModel):
    """Response schema for a generation attempt."""
    attempt_number: int
    success: bool
    validation_errors: list[str]
    timestamp: str


class GenerateProfileResponse(BaseModel):
    """Response schema for profile generation."""
    success: bool
    generation_id: str
    profile: dict[str, Any] | None
    total_attempts: int
    attempts: list[GenerationAttemptResponse]
    error_message: str | None = None
    saved_profile_id: str | None = None


class AIHistoryEntry(BaseModel):
    """AI generation history entry."""
    generation_id: str
    success: bool
    total_attempts: int
    prompt_preview: str
    timestamp: str
    profile_name: str | None = None


async def get_ai_service(session: AsyncSession = Depends(get_session)) -> AIProfileService:
    """Get configured AI service."""
    config_service = ServiceConfigService(session)
    service = await config_service.get_service("ollama")

    if not service or not service.url:
        raise HTTPException(
            status_code=400,
            detail="Ollama not configured. Please configure Ollama in settings first."
        )

    return AIProfileService(ollama_url=service.url)


@router.post("/generate-profile", response_model=GenerateProfileResponse)
async def generate_profile(
    request: GenerateProfileRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Generate a programming profile from a natural language description.

    The AI will attempt to generate a valid profile up to 3 times,
    refining based on validation errors after each failed attempt.

    Example prompts:
    - "Une soirée cinéma action avec des films récents bien notés"
    - "Programme familial pour le weekend avec dessins animés le matin et films l'après-midi"
    - "Chaîne de films classiques des années 80-90, pas de films d'horreur"
    """
    # Validate save request
    if request.save_profile and not request.profile_name:
        raise HTTPException(
            status_code=400,
            detail="profile_name is required when save_profile is True"
        )

    # Use libraries from request if provided, otherwise fetch from Plex
    available_libraries = None
    if request.libraries:
        # Convert request libraries to the format expected by AI service
        available_libraries = [
            {"id": lib.id, "name": lib.name, "type": lib.type}
            for lib in request.libraries
        ]
        logger.info(f"Using {len(available_libraries)} libraries from request")
    else:
        # Fallback to Plex libraries
        try:
            config_service = ServiceConfigService(session)
            plex_service = await config_service.get_service("plex")
            if plex_service and plex_service.url and plex_service.token:
                from app.services.plex_service import PlexService
                credentials = config_service.get_decrypted_credentials(plex_service)
                plex = PlexService(plex_service.url, credentials.get("token"))
                available_libraries = plex.get_libraries()
        except Exception as e:
            logger.warning(f"Could not get Plex libraries for AI context: {e}")

    # Initialize AI service
    ai_service = await get_ai_service(session)

    try:
        # Set model if specified
        if request.model:
            ai_service.model = request.model

        # Generate profile
        result = await ai_service.generate_profile(
            user_request=request.prompt,
            available_libraries=available_libraries,
            temperature=request.temperature,
        )

        # Prepare response
        response: dict[str, Any] = {
            "success": result.success,
            "generation_id": result.generation_id,
            "profile": result.profile,
            "total_attempts": result.total_attempts,
            "attempts": [
                {
                    "attempt_number": a.attempt_number,
                    "success": a.success,
                    "validation_errors": a.validation_errors,
                    "timestamp": a.timestamp.isoformat(),
                }
                for a in result.attempts
            ],
            "error_message": result.error_message,
            "saved_profile_id": None,
        }

        # Save profile if requested and successful
        if result.success and request.save_profile and result.profile:
            try:
                profile_service = ProfileService(session)
                profile_data = ProfileCreate(
                    name=request.profile_name or result.profile.get("name", "AI Generated Profile"),
                    config=result.profile,
                    labels=["ai-generated"],
                )
                saved_profile = await profile_service.create_profile(profile_data)
                response["saved_profile_id"] = saved_profile.id
            except Exception as e:
                logger.error(f"Failed to save generated profile: {e}")
                response["error_message"] = f"Profile generated but save failed: {str(e)}"

        return response

    finally:
        await ai_service.close()


@router.post("/modify-profile", response_model=GenerateProfileResponse)
async def modify_profile(
    request: ModifyProfileRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Modify an existing profile using natural language.

    Example modifications:
    - "Ajoute un bloc nuit de 23h à 6h avec des films calmes"
    - "Interdit tous les films d'horreur"
    - "Augmente le poids du genre à 3.0"
    """
    # Get existing profile
    profile_service = ProfileService(session)
    profile = await profile_service.get_profile(request.profile_id)

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Initialize AI service
    ai_service = await get_ai_service(session)

    try:
        if request.model:
            ai_service.model = request.model

        # Modify profile
        result = await ai_service.modify_profile(
            current_profile=profile.config or {},
            modification_request=request.modification,
        )

        response: dict[str, Any] = {
            "success": result.success,
            "generation_id": result.generation_id,
            "profile": result.profile,
            "total_attempts": result.total_attempts,
            "attempts": [
                {
                    "attempt_number": a.attempt_number,
                    "success": a.success,
                    "validation_errors": a.validation_errors,
                    "timestamp": a.timestamp.isoformat(),
                }
                for a in result.attempts
            ],
            "error_message": result.error_message,
            "saved_profile_id": None,
        }

        # Save changes if requested
        if result.success and request.save_changes and result.profile:
            try:
                from app.schemas.profile_schema import ProfileUpdate
                update_data = ProfileUpdate(config=result.profile)
                await profile_service.update_profile(request.profile_id, update_data)
                response["saved_profile_id"] = request.profile_id
            except Exception as e:
                logger.error(f"Failed to save modified profile: {e}")
                response["error_message"] = f"Profile modified but save failed: {str(e)}"

        return response

    finally:
        await ai_service.close()


@router.get("/history", response_model=list[AIHistoryEntry])
async def get_ai_history(
    limit: int = Query(10, ge=1, le=50, description="Maximum results"),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """
    Get recent AI generation history.

    Note: History is stored in memory and will be lost on server restart.
    For persistent history, check the History API.
    """
    ai_service = await get_ai_service(session)

    try:
        history = ai_service.get_generation_history(limit)

        return [
            {
                "generation_id": r.generation_id,
                "success": r.success,
                "total_attempts": r.total_attempts,
                "prompt_preview": r.attempts[0].prompt[:100] + "..." if r.attempts else "",
                "timestamp": r.attempts[0].timestamp.isoformat() if r.attempts else "",
                "profile_name": r.profile.get("name") if r.profile else None,
            }
            for r in history
        ]
    finally:
        await ai_service.close()


@router.get("/models")
async def get_ai_models(
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Get available Ollama models and recommendations.
    """
    from app.services.ai_prompt_template import RECOMMENDED_MODELS, get_recommended_model

    ai_service = await get_ai_service(session)

    try:
        models = await ai_service.adapter.list_models()

        return {
            "available_models": [
                {
                    "name": m.get("name"),
                    "size": m.get("size"),
                    "modified_at": m.get("modified_at"),
                }
                for m in models
            ],
            "recommended": {
                "profile_generation": get_recommended_model("profile_generation"),
                "quick_modification": get_recommended_model("quick_modification"),
                "complex_schedule": get_recommended_model("complex_schedule"),
            },
            "all_recommendations": RECOMMENDED_MODELS,
        }
    finally:
        await ai_service.close()


@router.post("/check-model")
async def check_model_availability(
    model: str = Query(..., description="Model name to check"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Check if a specific model is available.
    """
    ai_service = await get_ai_service(session)
    ai_service.model = model

    try:
        available, message = await ai_service.check_model_available()
        return {
            "model": model,
            "available": available,
            "message": message,
        }
    finally:
        await ai_service.close()
