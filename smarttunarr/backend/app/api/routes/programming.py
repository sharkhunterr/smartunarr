"""Programming API routes with SSE progress tracking."""

import asyncio
import logging
import threading
import traceback
from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session, async_session_maker
from app.core.programming.generator import ProgrammingGenerator, ProgrammingResult
from app.core.scoring.engine import ScoringEngine
from app.core.job_manager import get_job_manager, JobType, ProgressStep
from app.services.service_config_service import ServiceConfigService
from app.services.plex_service import PlexService
from app.services.tunarr_service import TunarrService
from app.services.history_service import HistoryService
from app.services.result_service import ResultService
from app.services.tmdb_service import TMDBService
from app.services.content_enrichment_service import ContentEnrichmentService
from app.models.profile import Profile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/programming", tags=["programming"])

# In-memory storage for results (would be DB in production)
_results: dict[str, dict[str, Any]] = {}


class ProgrammingRequest(BaseModel):
    """Request to generate programming."""
    channel_id: str
    profile_id: str
    iterations: int = 10
    randomness: float = 0.3
    cache_mode: str = "full"  # none, plex_only, tmdb_only, cache_only, full, enrich_cache
    preview_only: bool = False
    replace_forbidden: bool = False  # Replace forbidden content in best iteration with alternatives
    improve_best: bool = False  # Upgrade programs with better ones from other iterations
    duration_days: int = 1  # Number of days to program (1-30)
    start_datetime: str | None = None  # ISO format datetime, defaults to now
    # AI improvement options
    ai_improve: bool = False  # Use AI to improve programming after generation
    ai_prompt: str | None = None  # User prompt for AI improvement
    ai_model: str | None = None  # Ollama model to use for AI improvement


class AIProgrammingRequest(BaseModel):
    """Request to generate programming with AI."""
    channel_id: str
    prompt: str
    model: str | None = None
    temperature: float = 0.7
    iterations: int = 10
    randomness: float = 0.3
    cache_mode: str = "full"
    preview_only: bool = False
    save_profile: bool = False
    profile_name: str | None = None
    duration_days: int = 1  # Number of days to program (1-30)
    start_datetime: str | None = None  # ISO format datetime, defaults to now


class AIImprovementRequest(BaseModel):
    """Request to improve programming with AI feedback."""
    result_id: str
    prompt: str
    model: str | None = None
    iteration_index: int | None = None  # Which iteration to improve (default: best)
    temperature: float = 0.5


class ApplyAIModificationRequest(BaseModel):
    """Request to apply a single AI modification to a programming result."""
    original_title: str
    replacement_title: str


async def _run_programming(
    job_id: str,
    request: ProgrammingRequest,
) -> None:
    """Background task to run programming generation."""
    import traceback

    logger.info(f"[DEBUG] _run_programming started for job {job_id}")
    logger.info(f"[DEBUG] Current thread: {threading.current_thread().name}")

    job_manager = get_job_manager()
    logger.info(f"[DEBUG] Got job_manager")

    try:
        logger.info(f"[DEBUG] About to call job_manager.start_job")
        await job_manager.start_job(job_id)
        logger.info(f"[DEBUG] job_manager.start_job completed")
    except Exception as e:
        logger.error(f"[DEBUG] Error in start_job: {e}")
        logger.error(f"[DEBUG] Traceback: {traceback.format_exc()}")
        raise

    try:
        logger.info(f"[DEBUG] About to create async session")
        # Create a new session for the background task
        async with async_session_maker() as session:
            logger.info(f"[DEBUG] Session created successfully")

            # Initialize progress steps based on cache mode
            cache_mode = request.cache_mode
            use_cache = cache_mode in ("cache_only", "full", "enrich_cache")
            use_tmdb = cache_mode in ("tmdb_only", "full", "enrich_cache")
            enrich_existing = cache_mode == "enrich_cache"

            logger.info(f"[DEBUG] cache_mode={cache_mode}, use_cache={use_cache}, use_tmdb={use_tmdb}, enrich_existing={enrich_existing}")

            steps = [
                ProgressStep("config", "Chargement configuration", "running"),
                ProgressStep("profile", "Récupération profil", "pending"),
            ]

            if use_cache:
                steps.append(ProgressStep("cache_read", "Lecture du cache", "pending"))
            if enrich_existing:
                steps.append(ProgressStep("enrich_existing", "Enrichissement cache existant", "pending"))

            steps.append(ProgressStep("plex", "Récupération Plex", "pending"))

            if use_tmdb:
                steps.append(ProgressStep("tmdb", "Enrichissement TMDB", "pending"))

            if use_cache:
                steps.append(ProgressStep("cache_write", "Mise à jour cache", "pending"))

            steps.append(ProgressStep("filter", "Filtrage contenus", "pending"))
            steps.append(ProgressStep("generation", "Génération programmation", "pending"))

            if request.improve_best:
                steps.append(ProgressStep("improve", "Amélioration (meilleurs programmes)", "pending"))

            if request.replace_forbidden:
                steps.append(ProgressStep("optimize", "Optimisation (remplacement interdits)", "pending"))

            if request.ai_improve and request.ai_prompt:
                steps.append(ProgressStep("ai_improve", "Amélioration IA", "pending"))

            steps.append(ProgressStep("finalize", "Finalisation", "pending"))

            # Add Tunarr sync step if not preview only
            if not request.preview_only:
                steps.append(ProgressStep("tunarr_sync", "Envoi vers Tunarr", "pending"))

            logger.info(f"[DEBUG] About to set job steps")
            await job_manager.set_job_steps(job_id, steps)
            logger.info(f"[DEBUG] Job steps set")
            await job_manager.update_job_progress(job_id, 5, "Chargement configuration...")
            logger.info(f"[DEBUG] Progress updated")

            # Load services configuration
            config_service = ServiceConfigService(session)

            # Get Plex config
            plex_config = await config_service.get_service("plex")
            if not plex_config or not plex_config.url:
                raise ValueError("Plex not configured")

            creds = config_service.get_decrypted_credentials(plex_config)
            plex = PlexService(plex_config.url, creds.get("token", ""))

            await job_manager.update_step_status(job_id, "config", "completed")

            # Get profile
            await job_manager.update_step_status(job_id, "profile", "running")
            await job_manager.update_job_progress(job_id, 8, "Récupération du profil...")

            profile = await session.get(Profile, request.profile_id)
            if not profile:
                raise ValueError(f"Profile not found: {request.profile_id}")

            profile_dict = {
                "time_blocks": profile.time_blocks or [],
                "mandatory_forbidden_criteria": profile.mandatory_forbidden_criteria or {},
                "strategies": profile.strategies or {},
                "scoring_weights": profile.scoring_weights or {},
                "libraries": profile.libraries or [],
            }

            # Count expected blocks and programs info
            time_blocks = profile.time_blocks or []
            num_blocks = len(time_blocks)
            libraries = profile_dict.get("libraries", [])
            total_libraries = len(libraries)

            profile_detail = f"{profile.name} • {num_blocks} blocs • {total_libraries} bibliothèques"
            await job_manager.update_step_status(job_id, "profile", "completed", profile_detail)

            # Create history entry at the START of processing
            history_service = HistoryService(session)
            history_entry = await history_service.create_entry(
                entry_type="programming",
                channel_id=request.channel_id,
                profile_id=request.profile_id,
                iterations=request.iterations,
            )

            # Initialize TMDB service if needed
            tmdb_service = None
            if use_tmdb:
                tmdb_config = await config_service.get_service("tmdb")
                if tmdb_config:
                    tmdb_creds = config_service.get_decrypted_credentials(tmdb_config)
                    api_key = tmdb_creds.get("api_key", "")
                    if api_key:
                        tmdb_service = TMDBService(api_key)

            # Initialize content enrichment service
            enrichment_service = ContentEnrichmentService(session, tmdb_service)

            all_contents: list[tuple[dict[str, Any], dict[str, Any] | None]] = []
            cached_count = 0

            # Step: Read from cache if enabled
            if use_cache:
                await job_manager.update_step_status(job_id, "cache_read", "running")
                await job_manager.update_job_progress(job_id, 10, "Lecture du cache...")

                for lib_config in libraries:
                    lib_id = lib_config.get("id", "")
                    if lib_id:
                        cached = await enrichment_service.get_cached_contents(library_id=lib_id)
                        cached_count += len(cached)
                        all_contents.extend(cached)

                cache_detail = f"{cached_count} contenus en cache"
                await job_manager.update_step_status(job_id, "cache_read", "completed", cache_detail)
                logger.info(f"Found {cached_count} cached contents")

            # Step: Enrich existing cached items missing TMDB data
            if enrich_existing and tmdb_service and all_contents:
                await job_manager.update_step_status(job_id, "enrich_existing", "running")

                # Find items missing TMDB data (budget is a good indicator)
                items_to_enrich = [
                    (content, meta, idx) for idx, (content, meta) in enumerate(all_contents)
                    if meta and meta.get("budget") is None and meta.get("vote_count", 0) > 0
                ]
                # Also include items with no vote_count (never enriched)
                items_to_enrich.extend([
                    (content, meta, idx) for idx, (content, meta) in enumerate(all_contents)
                    if meta and meta.get("vote_count", 0) == 0
                ])
                # Limit to avoid too many API calls
                items_to_enrich = items_to_enrich[:200]

                if items_to_enrich:
                    await job_manager.update_job_progress(
                        job_id, 12,
                        f"Enrichissement: 0/{len(items_to_enrich)} contenus existants...",
                    )

                    enriched_count = 0
                    for i, (content, meta, original_idx) in enumerate(items_to_enrich):
                        if i % 10 == 0:
                            await job_manager.update_step_status(
                                job_id, "enrich_existing", "running",
                                f"{i}/{len(items_to_enrich)} enrichis"
                            )
                            await job_manager.update_job_progress(
                                job_id, 12 + (i / len(items_to_enrich)) * 8,
                                f"Enrichissement cache: {i}/{len(items_to_enrich)}...",
                            )

                        try:
                            enriched = await tmdb_service.enrich_content(
                                content.get("title", ""),
                                content.get("type", "movie"),
                                content.get("year"),
                            )
                            if enriched:
                                # Update meta with enriched data
                                if meta:
                                    meta["genres"] = enriched.get("genres", meta.get("genres", []))
                                    meta["tmdb_rating"] = enriched.get("tmdb_rating") or meta.get("tmdb_rating")
                                    meta["vote_count"] = enriched.get("vote_count") or meta.get("vote_count", 0)
                                    meta["keywords"] = enriched.get("keywords", meta.get("keywords", []))
                                    meta["collections"] = enriched.get("collections", meta.get("collections", []))
                                    meta["studios"] = enriched.get("studios", meta.get("studios", []))
                                    meta["budget"] = enriched.get("budget")
                                    meta["revenue"] = enriched.get("revenue")

                                    # Update in database
                                    await enrichment_service.update_content_meta(
                                        content.get("plex_key", ""),
                                        meta
                                    )
                                    enriched_count += 1
                        except Exception as e:
                            logger.warning(f"TMDB enrichment failed for cached {content.get('title')}: {e}")

                    enrich_detail = f"{enriched_count}/{len(items_to_enrich)} contenus enrichis"
                    await job_manager.update_step_status(job_id, "enrich_existing", "completed", enrich_detail)
                    logger.info(f"Enriched {enriched_count} existing cached items")
                else:
                    await job_manager.update_step_status(job_id, "enrich_existing", "completed", "Tout est déjà enrichi")

            # Step: Fetch from Plex
            await job_manager.update_step_status(job_id, "plex", "running")
            plex_items: list[dict[str, Any]] = []

            # Get cached plex_keys to avoid re-fetching
            cached_keys = {c[0].get("plex_key") for c in all_contents if c[0].get("plex_key")}

            for lib_idx, lib_config in enumerate(libraries):
                lib_id = lib_config.get("id", "")
                lib_name = lib_config.get("name", f"Library {lib_id}")
                if not lib_id:
                    continue

                # Progress for library fetching
                lib_progress = 15 + (lib_idx / max(total_libraries, 1)) * 10
                await job_manager.update_job_progress(
                    job_id,
                    lib_progress,
                    f"Récupération bibliothèque {lib_idx + 1}/{total_libraries}: {lib_name}...",
                    library_name=lib_name,
                    libraries_fetched=lib_idx,
                    total_libraries=total_libraries,
                )
                await job_manager.update_step_status(
                    job_id, "plex", "running",
                    f"{lib_idx + 1}/{total_libraries} - {lib_name}"
                )

                try:
                    items = plex.get_library_content(lib_id)  # No limit - fetch all content
                    logger.info(f"Library {lib_id} ({lib_name}): fetched {len(items)} items")

                    # Filter out already cached items
                    new_items = [
                        item for item in items
                        if item.get("plex_key") not in cached_keys
                    ]
                    plex_items.extend(new_items)
                except Exception as e:
                    logger.warning(f"Failed to fetch library {lib_id}: {e}")

            plex_detail = f"{len(plex_items)} nouveaux contenus Plex"
            await job_manager.update_step_status(job_id, "plex", "completed", plex_detail)

            # Step: TMDB enrichment if enabled
            if use_tmdb and tmdb_service and plex_items:
                await job_manager.update_step_status(job_id, "tmdb", "running")
                items_to_enrich = min(len(plex_items), 100)  # Limit to avoid too many API calls
                await job_manager.update_job_progress(
                    job_id, 30,
                    f"Enrichissement TMDB: 0/{items_to_enrich}...",
                )

                enriched_count = 0
                for idx, item in enumerate(plex_items[:items_to_enrich]):
                    if idx % 10 == 0:
                        await job_manager.update_step_status(
                            job_id, "tmdb", "running",
                            f"{idx}/{items_to_enrich} enrichis"
                        )
                        await job_manager.update_job_progress(
                            job_id, 30 + (idx / items_to_enrich) * 15,
                            f"Enrichissement TMDB: {idx}/{items_to_enrich}...",
                        )

                    try:
                        enriched = await tmdb_service.enrich_content(
                            item.get("title", ""),
                            item.get("type", "movie"),
                            item.get("year"),
                        )
                        if enriched:
                            # Merge enriched data into item
                            item["genres"] = enriched.get("genres", item.get("genres", []))
                            item["tmdb_rating"] = enriched.get("tmdb_rating")
                            item["vote_count"] = enriched.get("vote_count")
                            item["keywords"] = enriched.get("keywords", [])
                            item["collections"] = enriched.get("collections", [])
                            item["studios"] = enriched.get("studios", [])
                            item["budget"] = enriched.get("budget")
                            item["revenue"] = enriched.get("revenue")
                            enriched_count += 1
                    except Exception as e:
                        logger.warning(f"TMDB enrichment failed for {item.get('title')}: {e}")

                tmdb_detail = f"{enriched_count}/{items_to_enrich} contenus enrichis"
                await job_manager.update_step_status(job_id, "tmdb", "completed", tmdb_detail)
                logger.info(f"TMDB enriched {enriched_count} items")

            # Step: Update cache if enabled, otherwise add items directly
            if use_cache and plex_items:
                await job_manager.update_step_status(job_id, "cache_write", "running")
                await job_manager.update_job_progress(job_id, 48, "Mise à jour du cache...")

                # Add new items to cache and to all_contents
                for item in plex_items:
                    content, meta = await enrichment_service.get_or_cache_content(
                        item.get("plex_key", ""),
                        item,
                    )
                    all_contents.append((content, meta))

                cache_write_detail = f"{len(plex_items)} contenus ajoutés au cache"
                await job_manager.update_step_status(job_id, "cache_write", "completed", cache_write_detail)
            elif plex_items:
                # No cache mode: add items directly with enriched data
                for item in plex_items:
                    content = {
                        "id": item.get("plex_key", item.get("rating_key", "")),
                        "plex_key": item.get("plex_key", ""),
                        "title": item.get("title", ""),
                        "type": item.get("type", "movie"),
                        "duration_ms": item.get("duration_ms", 0),
                        "year": item.get("year"),
                        "library_id": item.get("library_id", ""),
                    }
                    meta = {
                        "genres": item.get("genres", []),
                        # Use TMDB rating if available, fallback to Plex rating
                        "tmdb_rating": item.get("tmdb_rating") or item.get("rating"),
                        "vote_count": item.get("vote_count", 0),
                        "content_rating": item.get("content_rating"),
                        "keywords": item.get("keywords", []),
                        "collections": item.get("collections", []),
                        "studios": item.get("studios", []),
                    }
                    all_contents.append((content, meta))

            if not all_contents:
                raise ValueError("No content found in Plex libraries")

            total_detail = f"{len(all_contents)} contenus ({cached_count} cache + {len(plex_items)} Plex)"
            await job_manager.update_job_progress(
                job_id,
                50,
                f"Contenus récupérés: {len(all_contents)}",
                total_content=len(all_contents),
                libraries_fetched=total_libraries,
                total_libraries=total_libraries,
                phase="content_loaded",
            )

            # Filtering step
            await job_manager.update_step_status(job_id, "filter", "running")
            await job_manager.update_job_progress(job_id, 22, "Filtrage des contenus interdits...")

            # Count forbidden/mandatory criteria
            criteria = profile_dict.get("mandatory_forbidden_criteria", {})
            forbidden = criteria.get("forbidden", {})
            mandatory = criteria.get("mandatory", {})
            forbidden_count = len(forbidden.get("content_ids", []))
            forbidden_count += len(forbidden.get("types", []))
            forbidden_count += len(forbidden.get("keywords", []))
            forbidden_count += len(forbidden.get("genres", []))
            mandatory_count = len(mandatory.get("content_ids", []))

            filter_detail = f"Interdits: {forbidden_count} règles • Obligatoires: {mandatory_count}"
            await job_manager.update_step_status(job_id, "filter", "completed", filter_detail)

            # Generation step
            await job_manager.update_step_status(job_id, "generation", "running")

            # Run in executor since generator is sync with async progress callback
            iteration_results: list[tuple[int, float]] = []

            def run_generator() -> ProgrammingResult:
                def sync_progress(iteration: int, total: int, best_score: float) -> None:
                    iteration_results.append((iteration, best_score))

                generator = ProgrammingGenerator(
                    scoring_engine=ScoringEngine(),
                    on_progress=sync_progress,
                )

                start_dt = datetime.now()
                if request.start_datetime:
                    try:
                        start_dt = datetime.fromisoformat(request.start_datetime.replace("Z", "+00:00"))
                    except ValueError:
                        pass

                # Calculate duration in hours from days
                duration_hours = request.duration_days * 24

                return generator.generate(
                    contents=all_contents,
                    profile=profile_dict,
                    start_datetime=start_dt,
                    duration_hours=duration_hours,
                    iterations=request.iterations,
                    randomness=request.randomness,
                    replace_forbidden=request.replace_forbidden,
                    improve_best=request.improve_best,
                )

            # Run generator with progress updates
            loop = asyncio.get_event_loop()

            # Initial progress before generation
            await job_manager.update_job_progress(
                job_id,
                25,
                f"Génération: itération 0/{request.iterations}",
                total_content=len(all_contents),
                total_iterations=request.iterations,
                phase="generation_started",
            )
            await job_manager.update_step_status(
                job_id, "generation", "running",
                f"0/{request.iterations} itérations"
            )

            # Run generator (sync) - we'll update progress after
            result = await loop.run_in_executor(None, run_generator)

            # Update final generation status - show ORIGINAL best iteration (before improve/optimize)
            if result.original_best_iteration > 0:
                original_iter = result.original_best_iteration
                original_score = result.original_best_score
            else:
                original_iter = result.iteration
                original_score = result.average_score
            gen_detail = f"{request.iterations} itérations • Meilleure: #{original_iter} (score: {original_score:.1f})"
            await job_manager.update_step_status(job_id, "generation", "completed", gen_detail)

            # Improvement step (if enabled)
            if request.improve_best:
                await job_manager.update_step_status(job_id, "improve", "running")
                await job_manager.update_job_progress(job_id, 85, "Amélioration avec meilleurs programmes...")

                if result.is_improved or (result.is_optimized and result.improved_count > 0):
                    improve_detail = f"{result.improved_count} programmes améliorés • Score: {result.average_score:.1f}"
                else:
                    improve_detail = "Aucune amélioration possible"

                await job_manager.update_step_status(job_id, "improve", "completed", improve_detail)

            # Optimization step (if enabled)
            if request.replace_forbidden:
                await job_manager.update_step_status(job_id, "optimize", "running")
                await job_manager.update_job_progress(job_id, 88, "Remplacement des contenus interdits...")

                if result.is_optimized:
                    optimize_detail = f"{result.replaced_count} contenus remplacés • Score: {result.average_score:.1f}"
                else:
                    optimize_detail = "Aucun contenu interdit à remplacer"

                await job_manager.update_step_status(job_id, "optimize", "completed", optimize_detail)

            # AI Improvement step (if enabled)
            ai_improved_programs: set[str] = set()  # Track programs actually modified by AI
            ai_response_data: dict[str, Any] | None = None  # Store AI response for frontend
            ai_applied_count = 0  # Count of actually applied modifications
            if request.ai_improve and request.ai_prompt:
                await job_manager.update_step_status(job_id, "ai_improve", "running")
                await job_manager.update_job_progress(job_id, 90, "Analyse IA en cours...")

                try:
                    from app.services.ai_prompt_template import get_ai_improvement_prompt, SYSTEM_PROMPT
                    from app.adapters.ollama_adapter import OllamaAdapter
                    import json

                    # Get Ollama configuration
                    ollama_config = await config_service.get_service("ollama")

                    if ollama_config and ollama_config.url:
                        # Prepare programs data for AI
                        programs_for_ai = []
                        for prog in result.programs:
                            programs_for_ai.append({
                                "title": prog.content.get("title", ""),
                                "type": prog.content.get("type", "movie"),
                                "duration_min": prog.content.get("duration_ms", 0) / 60000,
                                "genres": prog.content_meta.get("genres", []) if prog.content_meta else [],
                                "keywords": prog.content_meta.get("keywords", []) if prog.content_meta else [],
                                "collections": prog.content_meta.get("collections", []) if prog.content_meta else [],
                                "studios": prog.content_meta.get("studios", []) if prog.content_meta else [],
                                "year": prog.content.get("year"),
                                "content_rating": prog.content_meta.get("content_rating") if prog.content_meta else None,
                                "tmdb_rating": prog.content_meta.get("tmdb_rating") if prog.content_meta else None,
                                "block_name": prog.block_name,
                                "score": prog.score.total_score,
                                "forbidden_violated": len(prog.score.forbidden_violations) > 0,
                            })

                        # Prepare all iterations data with FULL information
                        all_iter_data = []
                        for iter_result in result.all_iterations:
                            iter_programs = []
                            for prog in iter_result.programs:
                                iter_programs.append({
                                    "title": prog.content.get("title", ""),
                                    "type": prog.content.get("type", "movie"),
                                    "duration_min": prog.content.get("duration_ms", 0) / 60000,
                                    "genres": prog.content_meta.get("genres", []) if prog.content_meta else [],
                                    "keywords": prog.content_meta.get("keywords", []) if prog.content_meta else [],
                                    "collections": prog.content_meta.get("collections", []) if prog.content_meta else [],
                                    "studios": prog.content_meta.get("studios", []) if prog.content_meta else [],
                                    "year": prog.content.get("year"),
                                    "content_rating": prog.content_meta.get("content_rating") if prog.content_meta else None,
                                    "tmdb_rating": prog.content_meta.get("tmdb_rating") if prog.content_meta else None,
                                    "score": prog.score.total_score,
                                    "block_name": prog.block_name,
                                    "forbidden_violated": len(prog.score.forbidden_violations) > 0,
                                })
                            all_iter_data.append({
                                "iteration": iter_result.iteration,
                                "average_score": iter_result.average_score,
                                "programs": iter_programs,
                            })

                        # Build AI prompt
                        ai_prompt = get_ai_improvement_prompt(
                            current_programs=programs_for_ai,
                            user_feedback=request.ai_prompt,
                            all_iterations=all_iter_data,
                        )

                        # Determine model to use
                        model = request.ai_model or "qwen3:14b"

                        # Create adapter and generate
                        adapter = OllamaAdapter(ollama_config.url)

                        try:
                            await job_manager.update_job_progress(job_id, 92, f"Génération IA avec {model}...")

                            response = await adapter.generate(
                                model=model,
                                prompt=ai_prompt,
                                system=SYSTEM_PROMPT,
                                temperature=0.5,
                                format_json=False,
                            )

                            if response:
                                logger.info(f"AI response received, length: {len(response)} chars")
                                logger.debug(f"AI response content: {response[:500]}...")

                                # Parse AI response
                                ai_result = None
                                try:
                                    # Try direct parse
                                    ai_result = json.loads(response)
                                    logger.info("AI response parsed as direct JSON")
                                except json.JSONDecodeError as e:
                                    logger.info(f"Direct JSON parse failed: {e}, trying extraction...")
                                    # Try to extract JSON
                                    start = response.find("{")
                                    end = response.rfind("}") + 1
                                    if start != -1 and end > start:
                                        json_str = response[start:end]
                                        logger.info(f"Extracted JSON from position {start} to {end}")
                                        try:
                                            ai_result = json.loads(json_str)
                                            logger.info("Extracted JSON parsed successfully")
                                        except json.JSONDecodeError as e2:
                                            logger.error(f"Extracted JSON parse failed: {e2}")
                                            logger.error(f"JSON content: {json_str[:300]}...")
                                            ai_result = None
                                    else:
                                        logger.error(f"No JSON braces found in response")
                                        ai_result = None

                                if ai_result:
                                    logger.info(f"AI result keys: {list(ai_result.keys())}")
                                    logger.info(f"AI analysis: {ai_result.get('analysis', 'N/A')[:200]}")
                                    logger.info(f"AI summary: {ai_result.get('summary', 'N/A')[:200]}")
                                    if "modifications" in ai_result:
                                        mods = ai_result.get('modifications', [])
                                        logger.info(f"Found {len(mods)} modifications: {mods}")
                                    else:
                                        logger.warning("AI result has no 'modifications' key")
                                else:
                                    logger.error("AI result is None after parsing attempts")

                                # Process AI modifications - ACTUALLY APPLY THEM
                                if ai_result and "modifications" in ai_result:
                                    # Store the full AI response for frontend display
                                    ai_response_data = ai_result

                                    modifications = ai_result.get("modifications", [])

                                    # Build lookup of all programs from all iterations by title
                                    all_programs_by_title: dict[str, Any] = {}
                                    for iter_result in result.all_iterations:
                                        for prog in iter_result.programs:
                                            title = prog.content.get("title", "")
                                            if title:
                                                # Keep the one with highest score
                                                existing = all_programs_by_title.get(title)
                                                if not existing or prog.score.total_score > existing.score.total_score:
                                                    all_programs_by_title[title] = prog

                                    # Build lookup of current programs by title
                                    current_programs_by_title = {
                                        prog.content.get("title", ""): (idx, prog)
                                        for idx, prog in enumerate(result.programs)
                                    }

                                    # Helper to strip year from title (AI sometimes includes year like "Title (2017)")
                                    import re
                                    def strip_year_from_title(title: str) -> str:
                                        """Remove trailing year in parentheses from title."""
                                        return re.sub(r'\s*\(\d{4}\)\s*$', '', title).strip()

                                    def find_in_dict(title: str, programs_dict: dict) -> tuple[str, Any] | None:
                                        """Find program by exact title or title without year."""
                                        # Try exact match first
                                        if title in programs_dict:
                                            return title, programs_dict[title]
                                        # Try without year
                                        title_no_year = strip_year_from_title(title)
                                        if title_no_year in programs_dict:
                                            return title_no_year, programs_dict[title_no_year]
                                        # Try matching stripped versions
                                        for key, value in programs_dict.items():
                                            if strip_year_from_title(key) == title_no_year:
                                                return key, value
                                        return None

                                    # Log details for debugging
                                    logger.info(f"Processing {len(modifications)} AI modifications")
                                    current_titles_list = list(current_programs_by_title.keys())
                                    available_titles_list = list(all_programs_by_title.keys())
                                    logger.info(f"Current program titles ({len(current_titles_list)}): {current_titles_list[:10]}...")
                                    logger.info(f"Available replacement titles ({len(available_titles_list)}): {available_titles_list}")  # Log ALL available titles

                                    # Apply modifications
                                    for mod in modifications:
                                        logger.info(f"Processing modification: {mod}")
                                        if mod.get("action") == "replace":
                                            original_title = mod.get("original_title", "")
                                            replacement_title = mod.get("replacement_title", "")

                                            if original_title and replacement_title:
                                                # Find original program in current (with fuzzy year matching)
                                                original_match = find_in_dict(original_title, current_programs_by_title)
                                                if original_match:
                                                    matched_title, (idx, original_prog) = original_match
                                                    logger.info(f"Matched original '{original_title}' -> '{matched_title}'")

                                                    # Find replacement in all iterations (with fuzzy year matching)
                                                    replacement_match = find_in_dict(replacement_title, all_programs_by_title)
                                                    if replacement_match:
                                                        matched_replacement, replacement_prog = replacement_match
                                                        logger.info(f"Matched replacement '{replacement_title}' -> '{matched_replacement}'")

                                                        # Create a copy with modified attributes
                                                        new_prog = type(original_prog)(
                                                            content=replacement_prog.content,
                                                            content_meta=replacement_prog.content_meta,
                                                            start_time=original_prog.start_time,
                                                            end_time=original_prog.end_time,
                                                            block_name=original_prog.block_name,
                                                            score=replacement_prog.score,
                                                        )
                                                        # Mark as AI improved
                                                        new_prog.is_replacement = True
                                                        new_prog.replacement_reason = "ai_improved"
                                                        new_prog.replaced_title = matched_title  # Use actual matched title

                                                        # Apply the replacement
                                                        result.programs[idx] = new_prog
                                                        ai_improved_programs.add(matched_replacement)  # Use actual matched title
                                                        ai_applied_count += 1
                                                        logger.info(f"AI applied: replaced '{matched_title}' with '{matched_replacement}'")
                                                    else:
                                                        logger.warning(f"AI replacement not found: '{replacement_title}'")
                                                else:
                                                    logger.warning(f"AI original not found: '{original_title}'")

                                    # Recalculate result scores after modifications
                                    if ai_applied_count > 0:
                                        result.total_score = sum(p.score.total_score for p in result.programs)
                                        result.average_score = result.total_score / len(result.programs) if result.programs else 0
                                        # Mark the result as AI improved
                                        result.is_ai_improved = True

                                    ai_improve_detail = f"{ai_applied_count} modifications appliquées par IA"
                                    await job_manager.update_step_status(job_id, "ai_improve", "completed", ai_improve_detail)
                                    logger.info(f"AI improvement: {ai_applied_count} programs actually modified")
                                else:
                                    # Still save AI response for frontend even if no modifications applied
                                    if ai_result:
                                        ai_response_data = ai_result
                                        logger.info("AI result saved but no modifications to apply")
                                    await job_manager.update_step_status(job_id, "ai_improve", "completed", "Aucune modification suggérée")
                            else:
                                logger.warning("AI response was empty")
                                await job_manager.update_step_status(job_id, "ai_improve", "completed", "Réponse IA vide")
                        finally:
                            await adapter.close()
                    else:
                        await job_manager.update_step_status(job_id, "ai_improve", "completed", "Ollama non configuré")
                except Exception as e:
                    logger.error(f"AI improvement failed: {e}")
                    import traceback
                    logger.error(f"AI improvement traceback: {traceback.format_exc()}")
                    await job_manager.update_step_status(job_id, "ai_improve", "failed", f"Erreur: {str(e)[:50]}")

            # Post-generation progress
            await job_manager.update_job_progress(
                job_id,
                90,
                f"Génération terminée: {len(result.programs)} programmes",
                total_content=len(all_contents),
                programs_count=len(result.programs),
                best_iteration=result.iteration,
                total_iterations=request.iterations,
                best_score=result.average_score,
                phase="generation_complete",
            )

            # Finalize step
            await job_manager.update_step_status(job_id, "finalize", "running")
            await job_manager.update_job_progress(job_id, 95, "Traitement des résultats...")

            # Helper to convert programs to API format
            def convert_programs(progs: list, ai_modified_titles: set[str] | None = None) -> list[dict]:
                converted = []
                for prog in progs:
                    title = prog.content.get("title", "")
                    # Check if this program was AI improved (either by replacement_reason or by title in set)
                    is_ai_improved = (
                        getattr(prog, "replacement_reason", None) == "ai_improved" or
                        (ai_modified_titles is not None and title in ai_modified_titles)
                    )
                    converted.append({
                        "id": str(uuid4()),
                        "title": title,
                        "type": prog.content.get("type", "movie"),
                        "start_time": prog.start_time.isoformat(),
                        "end_time": prog.end_time.isoformat(),
                        "duration_min": prog.content.get("duration_ms", 0) / 60000,
                        "genres": prog.content_meta.get("genres", []) if prog.content_meta else [],
                        "keywords": prog.content_meta.get("keywords", []) if prog.content_meta else [],
                        "studios": prog.content_meta.get("studios", []) if prog.content_meta else [],
                        "collections": prog.content_meta.get("collections", []) if prog.content_meta else [],
                        "year": prog.content.get("year"),
                        "tmdb_rating": prog.content_meta.get("tmdb_rating") if prog.content_meta else None,
                        "content_rating": prog.content_meta.get("content_rating") if prog.content_meta else None,
                        "plex_key": prog.content.get("plex_key", ""),
                        "block_name": prog.block_name,
                        "score": {
                            "total": prog.score.total_score,
                            "breakdown": {
                                name: res.score
                                for name, res in prog.score.criterion_results.items()
                            },
                            "criteria": {
                                name: {
                                    "score": res.score,
                                    "weight": res.weight,
                                    "weighted_score": res.weighted_score,
                                    "multiplier": res.multiplier,
                                    "multiplied_weighted_score": res.multiplied_weighted_score,
                                    "skipped": res.skipped,
                                    "details": res.details if res.details else None,
                                    "rule_violation": {
                                        "rule_type": res.rule_violation.rule_type,
                                        "values": res.rule_violation.values,
                                        "penalty_or_bonus": res.rule_violation.penalty_or_bonus,
                                    } if res.rule_violation else None,
                                }
                                for name, res in prog.score.criterion_results.items()
                            },
                            "penalties": [p.get("message", "") for p in prog.score.mandatory_penalties],
                            "bonuses": prog.score.bonuses_applied,
                            "mandatory_met": len(prog.score.mandatory_penalties) == 0,
                            "forbidden_violated": len(prog.score.forbidden_violations) > 0,
                            "forbidden_details": prog.score.forbidden_violations,
                            "mandatory_details": prog.score.mandatory_penalties,
                            "keyword_multiplier": prog.score.keyword_multiplier,
                            "keyword_match": prog.score.keyword_match,
                            "criterion_rule_violations": prog.score.criterion_rule_violations,
                        },
                        "is_replacement": getattr(prog, "is_replacement", False),
                        "replacement_reason": getattr(prog, "replacement_reason", None),
                        "replaced_title": getattr(prog, "replaced_title", None),
                        "is_ai_improved": is_ai_improved,
                    })
                return converted

            # Convert best result to API format (pass AI improved titles for marking)
            programs = convert_programs(result.programs, ai_improved_programs if ai_improved_programs else None)

            # Calculate total duration
            total_duration = sum(p["duration_min"] for p in programs)

            # Convert all iterations (sorted by score descending)
            all_iterations_data = []

            # If AI modifications were applied, add an AI-improved iteration at the beginning
            if ai_applied_count > 0:
                all_iterations_data.append({
                    "iteration": 0,  # Special iteration number for AI improved
                    "programs": programs,  # The AI-modified programs
                    "total_score": result.total_score,
                    "average_score": result.average_score,
                    "total_duration_min": total_duration,
                    "program_count": len(programs),
                    "is_optimized": False,
                    "is_improved": False,
                    "is_ai_improved": True,  # New flag for AI improved iteration
                })

            for iter_result in result.all_iterations:
                # Don't pass AI titles to other iterations - they weren't modified
                iter_programs = convert_programs(iter_result.programs, None)
                iter_total_duration = sum(p["duration_min"] for p in iter_programs)
                all_iterations_data.append({
                    "iteration": iter_result.iteration,
                    "programs": iter_programs,
                    "total_score": iter_result.total_score,
                    "average_score": iter_result.average_score,
                    "total_duration_min": iter_total_duration,
                    "program_count": len(iter_programs),
                    "is_optimized": iter_result.is_optimized,
                    "is_improved": iter_result.is_improved,
                    "is_ai_improved": False,
                })

            # Store result
            result_id = str(uuid4())
            result_data = {
                "id": result_id,
                "channel_id": request.channel_id,
                "profile_id": request.profile_id,
                "programs": programs,
                "total_score": result.total_score,
                "average_score": result.average_score,
                "total_duration_min": total_duration,
                "iteration": result.iteration,
                "created_at": datetime.utcnow().isoformat(),
                # All iterations sorted by score
                "all_iterations": all_iterations_data,
                "total_iterations": len(all_iterations_data),
                # Time blocks for frontend rendering
                "time_blocks": profile.time_blocks or [],
                # AI improvement response (if AI was used)
                "ai_response": ai_response_data,
            }
            # Save result to database for persistence
            result_service = ResultService(session)
            await result_service.save_result(
                result_id=result_id,
                result_type="programming",
                data=result_data,
                channel_id=request.channel_id,
                profile_id=request.profile_id,
            )

            # Also keep in memory for quick access during session
            _results[result_id] = result_data

            # Mark history as successful with result reference (entry was created at start)
            await history_service.mark_success(
                history_entry.id,
                best_score=result.average_score,
                result_summary={"result_id": result_id, "program_count": len(programs)},
            )

            # Mark finalize step as completed
            finalize_detail = f"{len(programs)} programmes • Score: {result.average_score:.1f}"
            await job_manager.update_step_status(job_id, "finalize", "completed", finalize_detail)

            # Tunarr sync step (if not preview only)
            if not request.preview_only:
                await job_manager.update_step_status(job_id, "tunarr_sync", "running")
                await job_manager.update_job_progress(job_id, 97, "Envoi de la programmation vers Tunarr...")

                tunarr_service = None
                try:
                    # Get Tunarr config
                    tunarr_config = await config_service.get_service("tunarr")
                    if not tunarr_config or not tunarr_config.url:
                        raise ValueError("Tunarr non configuré")

                    tunarr_creds = config_service.get_decrypted_credentials(tunarr_config)
                    tunarr_service = TunarrService(
                        tunarr_config.url,
                        tunarr_creds.get("username"),
                        tunarr_creds.get("password"),
                    )

                    # Get Plex server info from Tunarr
                    plex_servers = await tunarr_service.adapter.get_plex_servers()
                    plex_server_name = "NAS-Jérémie"  # Default fallback
                    plex_server_id = "caa0e3c3-67d7-4533-8d8d-616ab86bf4bc"  # Default fallback
                    if plex_servers:
                        # Use the first Plex server configured in Tunarr
                        plex_server_name = plex_servers[0].get("name", plex_server_name)
                        plex_server_id = plex_servers[0].get("id", plex_server_id)
                        logger.info(f"Using Plex server from Tunarr: {plex_server_name} (ID: {plex_server_id})")

                    # Convert programs to Tunarr format
                    tunarr_programs = []
                    for prog in result.programs:
                        tunarr_programs.append({
                            "plex_key": prog.content.get("plex_key", ""),
                            "content_plex_key": prog.content.get("plex_key", ""),
                            "title": prog.content.get("title", ""),
                            "duration_ms": prog.content.get("duration_ms", 0),
                            "type": prog.content.get("type", "movie"),
                        })

                    # Send to Tunarr
                    success = await tunarr_service.update_channel_programming(
                        request.channel_id,
                        tunarr_programs,
                        plex_server_name=plex_server_name,
                        plex_server_id=plex_server_id,
                    )

                    if success:
                        # Update channel start time
                        # Parse start datetime from request
                        start_dt = datetime.now()
                        if request.start_datetime:
                            try:
                                start_dt = datetime.fromisoformat(request.start_datetime.replace("Z", "+00:00"))
                            except ValueError:
                                pass

                        # Convert to Unix timestamp in milliseconds
                        start_time_ms = int(start_dt.timestamp() * 1000)

                        # Calculate total duration from programs (in milliseconds)
                        total_duration_ms = sum(p.get("duration_ms", 0) for p in tunarr_programs)

                        # Update channel start time in Tunarr
                        start_time_updated = await tunarr_service.update_channel_start_time(
                            request.channel_id,
                            start_time_ms,
                            total_duration_ms,
                        )
                        if start_time_updated:
                            logger.info(f"Channel start time updated to {start_dt.isoformat()}")
                        else:
                            logger.warning(f"Failed to update channel start time")

                        sync_detail = f"{len(tunarr_programs)} programmes envoyés"
                        await job_manager.update_step_status(job_id, "tunarr_sync", "completed", sync_detail)
                        logger.info(f"Tunarr sync completed: {len(tunarr_programs)} programs sent to channel {request.channel_id}")
                    else:
                        raise ValueError("Échec de l'envoi vers Tunarr")

                except Exception as e:
                    logger.error(f"Tunarr sync failed: {e}")
                    sync_detail = f"Erreur: {str(e)}"
                    await job_manager.update_step_status(job_id, "tunarr_sync", "failed", sync_detail)
                    # Don't fail the whole job, just log the error
                    # The programming was still generated successfully
                finally:
                    if tunarr_service:
                        await tunarr_service.close()

            await job_manager.complete_job(
                job_id,
                result=result_data,
                best_score=result.average_score,
            )

            logger.info(f"Programming completed: {len(programs)} programs, avg score {result.average_score:.2f}")

    except Exception as e:
        logger.error(f"Programming failed: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        await job_manager.fail_job(job_id, str(e))
        # Try to mark history entry as failed if it was created
        try:
            if 'history_entry' in dir() and 'history_service' in dir():
                await history_service.mark_failed(history_entry.id, str(e))
        except Exception:
            pass  # Best effort


def _run_programming_in_thread(job_id: str, request: ProgrammingRequest) -> None:
    """Run programming in a separate thread with its own event loop."""
    # Create a new event loop for this thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_run_programming(job_id, request))
    finally:
        loop.close()


@router.post("/generate")
async def generate_programming(
    request: ProgrammingRequest,
) -> dict[str, Any]:
    """
    Generate programming for a channel.

    This starts a background job and returns immediately.
    Progress is tracked via WebSocket.
    """
    job_manager = get_job_manager()

    # Create job
    job_id = await job_manager.create_job(
        job_type=JobType.PROGRAMMING,
        title=f"Programming generation",
        channel_id=request.channel_id,
        profile_id=request.profile_id,
        total_iterations=request.iterations,
    )

    # Run in a separate thread with its own event loop
    # This is needed because SQLAlchemy async requires proper greenlet context
    import threading
    thread = threading.Thread(
        target=_run_programming_in_thread,
        args=(job_id, request),
        daemon=True,
    )
    thread.start()

    return {
        "job_id": job_id,
        "status": "started",
        "message": "Programming generation started. Track progress via WebSocket.",
    }


@router.post("/generate-ai")
async def generate_programming_ai(
    request: AIProgrammingRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Generate programming using AI to create a profile from a prompt."""
    # TODO: Implement AI profile generation
    # For now, return not implemented
    raise HTTPException(
        status_code=501,
        detail="AI programming generation not yet implemented"
    )


@router.post("/improve")
async def improve_programming_with_ai(
    request: AIImprovementRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Analyze programming results and provide AI-powered improvement suggestions.

    Returns suggestions for improving the programming based on user feedback.
    """
    from app.services.ai_prompt_template import get_ai_improvement_prompt, SYSTEM_PROMPT
    from app.adapters.ollama_adapter import OllamaAdapter

    # Get the result
    result = _results.get(request.result_id)
    if not result:
        # Try to load from database
        result_service = ResultService(session)
        result = await result_service.get_result_data(request.result_id)
        if not result:
            raise HTTPException(status_code=404, detail="Result not found")

    # Get programs from the specified iteration or best
    all_iterations = result.get("all_iterations", [])
    if request.iteration_index is not None and 0 <= request.iteration_index < len(all_iterations):
        current_programs = all_iterations[request.iteration_index].get("programs", [])
    else:
        current_programs = result.get("programs", [])

    # Format programs for AI (convert from API format to AI format)
    programs_for_ai = []
    for prog in current_programs:
        score_data = prog.get("score", {})
        programs_for_ai.append({
            "title": prog.get("title", ""),
            "type": prog.get("type", "movie"),
            "duration_min": prog.get("duration_min", 0),
            "genres": prog.get("genres", []),
            "keywords": prog.get("keywords", []),
            "collections": prog.get("collections", []),
            "studios": prog.get("studios", []),
            "year": prog.get("year"),
            "content_rating": prog.get("content_rating"),
            "tmdb_rating": prog.get("tmdb_rating"),
            "block_name": prog.get("block_name", ""),
            "score": score_data.get("total", 0) if isinstance(score_data, dict) else 0,
            "forbidden_violated": score_data.get("forbidden_violated", False) if isinstance(score_data, dict) else False,
        })

    # Format iterations for AI
    all_iter_data = []
    for iter_result in all_iterations:
        iter_programs = []
        for prog in iter_result.get("programs", []):
            score_data = prog.get("score", {})
            iter_programs.append({
                "title": prog.get("title", ""),
                "type": prog.get("type", "movie"),
                "duration_min": prog.get("duration_min", 0),
                "genres": prog.get("genres", []),
                "keywords": prog.get("keywords", []),
                "collections": prog.get("collections", []),
                "studios": prog.get("studios", []),
                "year": prog.get("year"),
                "content_rating": prog.get("content_rating"),
                "tmdb_rating": prog.get("tmdb_rating"),
                "score": score_data.get("total", 0) if isinstance(score_data, dict) else 0,
                "block_name": prog.get("block_name", ""),
                "forbidden_violated": score_data.get("forbidden_violated", False) if isinstance(score_data, dict) else False,
            })
        all_iter_data.append({
            "iteration": iter_result.get("iteration", 0),
            "programs": iter_programs,
            "average_score": iter_result.get("average_score", 0),
        })

    # Get Ollama configuration
    config_service = ServiceConfigService(session)
    ollama_config = await config_service.get_service("ollama")

    if not ollama_config or not ollama_config.url:
        raise HTTPException(status_code=400, detail="Ollama not configured")

    # Determine model to use
    model = request.model
    if not model:
        # Try to get default model from config or use a sensible default
        model = "qwen3:14b"

    # Create adapter and generate suggestions
    adapter = OllamaAdapter(ollama_config.url)

    try:
        # Build the improvement prompt using the proper function
        prompt = get_ai_improvement_prompt(
            current_programs=programs_for_ai,
            user_feedback=request.prompt,
            all_iterations=all_iter_data,
        )

        logger.info(f"AI improvement prompt length: {len(prompt)} chars, {len(programs_for_ai)} current programs, {len(all_iter_data)} iterations")

        logger.info(f"Generating AI improvement suggestions with model '{model}'")

        # Generate response
        response = await adapter.generate(
            model=model,
            prompt=prompt,
            system=SYSTEM_PROMPT,
            temperature=request.temperature,
            format_json=False,  # qwen3 compatibility
        )

        if not response:
            raise HTTPException(status_code=500, detail="AI generation failed - no response")

        # Try to parse JSON from response
        import json
        try:
            # Try direct parse
            suggestions = json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            start = response.find("{")
            end = response.rfind("}") + 1
            if start != -1 and end > start:
                try:
                    suggestions = json.loads(response[start:end])
                except json.JSONDecodeError:
                    # Return raw response as fallback
                    suggestions = {
                        "analysis": response,
                        "suggestions": [],
                        "summary": "Unable to parse AI response as JSON",
                        "raw_response": response
                    }
            else:
                suggestions = {
                    "analysis": response,
                    "suggestions": [],
                    "summary": "Unable to parse AI response as JSON",
                    "raw_response": response
                }

        return {
            "success": True,
            "result_id": request.result_id,
            "model": model,
            "suggestions": suggestions,
        }

    except Exception as e:
        logger.error(f"AI improvement failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI improvement failed: {str(e)}")
    finally:
        await adapter.close()


@router.post("/apply-ai-modification/{result_id}")
async def apply_ai_modification(
    result_id: str,
    request: ApplyAIModificationRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Apply a single AI modification by replacing a program with an alternative from other iterations.

    This finds the program with original_title and replaces it with the program
    that has replacement_title from the available iterations.
    """
    logger.info(f"[AI Modification] Applying: '{request.original_title}' -> '{request.replacement_title}'")

    # Get the result
    result = _results.get(result_id)
    if not result:
        # Try to load from database
        result_service = ResultService(session)
        result = await result_service.get_result_data(result_id)
        if not result:
            logger.error(f"[AI Modification] Result not found: {result_id}")
            raise HTTPException(status_code=404, detail="Result not found")

    all_iterations = result.get("all_iterations", [])
    programs = result.get("programs", [])

    # Log available programs for debugging
    current_titles = [p.get("title", "") for p in programs]
    logger.info(f"[AI Modification] Current programs ({len(current_titles)}): {current_titles}")

    # Find the program to replace
    program_idx = None
    original_program = None
    for idx, prog in enumerate(programs):
        if prog.get("title") == request.original_title:
            program_idx = idx
            original_program = prog
            break

    if program_idx is None:
        # Log the error with available titles
        logger.error(f"[AI Modification] Original '{request.original_title}' NOT FOUND in current programs")
        logger.error(f"[AI Modification] Available titles: {current_titles}")
        raise HTTPException(
            status_code=404,
            detail=f"Programme '{request.original_title}' introuvable dans la programmation actuelle. L'IA a peut-être confondu les listes. Programmes disponibles: {', '.join(current_titles[:5])}..."
        )

    # Find the replacement program from all iterations
    replacement_program = None
    all_alternative_titles = set()
    for iter_result in all_iterations:
        for prog in iter_result.get("programs", []):
            title = prog.get("title", "")
            all_alternative_titles.add(title)
            if title == request.replacement_title:
                replacement_program = prog
                break
        if replacement_program:
            break

    logger.info(f"[AI Modification] Alternative titles available: {len(all_alternative_titles)}")

    if not replacement_program:
        logger.error(f"[AI Modification] Replacement '{request.replacement_title}' NOT FOUND in alternatives")
        raise HTTPException(
            status_code=404,
            detail=f"Programme de remplacement '{request.replacement_title}' introuvable dans les alternatives"
        )

    # Create the replacement program with original timing but new content
    new_program = {
        **replacement_program,
        "id": str(uuid4()),
        "start_time": original_program.get("start_time"),
        "end_time": original_program.get("end_time"),
        "block_name": original_program.get("block_name"),
        "is_replacement": True,
        "replacement_reason": "ai_improved",
        "replaced_title": request.original_title,
        "is_ai_improved": True,
    }

    # Replace the program
    programs[program_idx] = new_program

    # Recalculate totals
    total_score = sum(p.get("score", {}).get("total", 0) for p in programs)
    avg_score = total_score / len(programs) if programs else 0

    result["programs"] = programs
    result["total_score"] = total_score
    result["average_score"] = avg_score

    # Also update the first iteration (best) which should match programs
    if all_iterations:
        all_iterations[0]["programs"] = programs
        all_iterations[0]["total_score"] = total_score
        all_iterations[0]["average_score"] = avg_score

    # Update in-memory cache
    _results[result_id] = result

    # Update in database
    result_service = ResultService(session)
    await result_service.save_result(
        result_id=result_id,
        result_type="programming",
        data=result,
        channel_id=result.get("channel_id"),
        profile_id=result.get("profile_id"),
    )

    logger.info(f"Applied AI modification: replaced '{request.original_title}' with '{request.replacement_title}'")

    return {
        "success": True,
        "message": f"Replaced '{request.original_title}' with '{request.replacement_title}'",
        "new_average_score": avg_score,
        "updated_program": new_program,
    }


@router.post("/apply/{result_id}")
async def apply_programming(
    result_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Apply programming result to Tunarr channel."""
    result = _results.get(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    # Get Tunarr config
    config_service = ServiceConfigService(session)
    tunarr_config = await config_service.get_service("tunarr")

    if not tunarr_config or not tunarr_config.url:
        raise HTTPException(status_code=400, detail="Tunarr not configured")

    creds = config_service.get_decrypted_credentials(tunarr_config)
    tunarr = TunarrService(
        tunarr_config.url,
        tunarr_config.username,
        creds.get("password"),
    )

    try:
        # Convert programs to Tunarr format
        tunarr_programs = []
        for prog in result["programs"]:
            tunarr_programs.append({
                "start": prog["start_time"],
                "duration": int(prog["duration_min"] * 60 * 1000),  # ms
                "title": prog["title"],
                "type": prog["type"],
                "plexKey": prog.get("plex_key"),
            })

        # Update channel in Tunarr
        success = await tunarr.update_channel_programming(
            result["channel_id"],
            tunarr_programs,
        )
        await tunarr.close()

        if success:
            return {
                "status": "success",
                "message": f"Applied {len(tunarr_programs)} programs to channel",
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to apply programming to Tunarr"
            )

    except Exception as e:
        await tunarr.close()
        logger.error(f"Failed to apply programming: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/results/{result_id}")
async def get_programming_result(
    result_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Get a programming result by ID."""
    # Check in-memory cache first
    result = _results.get(result_id)
    if result:
        return result

    # Fall back to database
    result_service = ResultService(session)
    db_result = await result_service.get_result_data(result_id)
    if db_result:
        # Cache for future requests
        _results[result_id] = db_result
        return db_result

    raise HTTPException(status_code=404, detail="Result not found")


@router.get("/jobs")
async def list_jobs() -> list[dict[str, Any]]:
    """List recent programming jobs."""
    job_manager = get_job_manager()
    jobs = await job_manager.get_recent_jobs(limit=20)
    return [
        job.to_dict() for job in jobs
        if job.type == JobType.PROGRAMMING
    ]


@router.get("/jobs/{job_id}")
async def get_job(job_id: str) -> dict[str, Any]:
    """Get a specific job status."""
    job_manager = get_job_manager()
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_dict()


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str) -> dict[str, Any]:
    """Cancel a running job."""
    job_manager = get_job_manager()
    success = await job_manager.cancel_job(job_id)
    if success:
        return {"status": "cancelled"}
    raise HTTPException(status_code=400, detail="Cannot cancel job")
