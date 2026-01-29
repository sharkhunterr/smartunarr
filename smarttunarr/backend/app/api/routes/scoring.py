"""Scoring API routes for analyzing channel programming."""

import asyncio
import logging
import threading
from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session, async_session_maker
from app.core.scoring.engine import ScoringEngine
from app.core.job_manager import get_job_manager, JobType, ProgressStep
from app.services.service_config_service import ServiceConfigService
from app.services.tunarr_service import TunarrService
from app.services.tmdb_service import TMDBService
from app.services.content_enrichment_service import ContentEnrichmentService
from app.services.history_service import HistoryService
from app.models.profile import Profile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scoring", tags=["scoring"])

# In-memory storage for results
_scoring_results: dict[str, dict[str, Any]] = {}


class ScoringRequest(BaseModel):
    """Request to analyze scoring."""
    channel_id: str
    profile_id: str
    cache_mode: str = "full"  # none, cache_only, full (cache + TMDB enrichment)


async def _run_scoring(
    job_id: str,
    request: ScoringRequest,
) -> None:
    """Background task to run scoring analysis."""
    job_manager = get_job_manager()

    try:
        await job_manager.start_job(job_id)

        # Create a new session for the background task
        async with async_session_maker() as session:
            # Parse cache mode
            cache_mode = request.cache_mode
            use_cache = cache_mode in ("cache_only", "full")
            use_tmdb = cache_mode == "full"

            # Initialize progress steps based on cache mode
            steps = [
                ProgressStep("config", "Chargement configuration", "running"),
                ProgressStep("profile", "Récupération profil", "pending"),
                ProgressStep("channel", "Récupération chaîne Tunarr", "pending"),
            ]
            if use_cache:
                steps.append(ProgressStep("cache", "Recherche dans cache", "pending"))
            if use_tmdb:
                steps.append(ProgressStep("tmdb", "Enrichissement TMDB", "pending"))
            steps.extend([
                ProgressStep("scoring", "Calcul des scores", "pending"),
                ProgressStep("finalize", "Finalisation", "pending"),
            ])
            await job_manager.set_job_steps(job_id, steps)
            await job_manager.update_job_progress(job_id, 5, "Chargement configuration...")

            # Load services
            config_service = ServiceConfigService(session)

            # Get Tunarr config
            tunarr_config = await config_service.get_service("tunarr")
            if not tunarr_config or not tunarr_config.url:
                raise ValueError("Tunarr not configured")

            creds = config_service.get_decrypted_credentials(tunarr_config)
            tunarr = TunarrService(
                tunarr_config.url,
                tunarr_config.username,
                creds.get("password"),
            )

            # Initialize TMDB service for cache
            tmdb_service = None
            tmdb_config = await config_service.get_service("tmdb")
            if tmdb_config:
                tmdb_creds = config_service.get_decrypted_credentials(tmdb_config)
                api_key = tmdb_creds.get("api_key", "")
                if api_key:
                    tmdb_service = TMDBService(api_key)

            # Initialize content enrichment service (uses same cache as programming)
            enrichment_service = ContentEnrichmentService(session, tmdb_service)

            await job_manager.update_step_status(job_id, "config", "completed")

            # Get profile
            await job_manager.update_step_status(job_id, "profile", "running")
            await job_manager.update_job_progress(job_id, 10, "Récupération du profil...")

            profile = await session.get(Profile, request.profile_id)
            if not profile:
                raise ValueError(f"Profile not found: {request.profile_id}")

            profile_dict = {
                "time_blocks": profile.time_blocks or [],
                "mandatory_forbidden_criteria": profile.mandatory_forbidden_criteria or {},
                "strategies": profile.strategies or {},
                "scoring_weights": profile.scoring_weights or {},
            }

            await job_manager.update_step_status(job_id, "profile", "completed", profile.name)

            # Get channel programs from Tunarr
            await job_manager.update_step_status(job_id, "channel", "running")
            await job_manager.update_job_progress(job_id, 15, "Récupération des programmes Tunarr...")

            channel = await tunarr.get_channel(request.channel_id)
            if not channel:
                raise ValueError(f"Channel not found: {request.channel_id}")

            channel_name = channel.get("name", "Unknown")
            programs_response = await tunarr.get_channel_programming(request.channel_id)
            await tunarr.close()

            # Handle Tunarr response format:
            # - "programs" is a DICT with program IDs as keys containing detailed info
            # - "lineup" is a LIST of ordered entries with {id, durationMs, ...}
            if isinstance(programs_response, dict):
                logger.info(f"Tunarr returned dict with keys: {programs_response.keys()}")
                programs_dict = programs_response.get("programs", {})
                lineup = programs_response.get("lineup", [])

                if not lineup:
                    raise ValueError("No lineup found in Tunarr response")

                logger.info(f"Tunarr lineup: {len(lineup)} entries, programs dict: {len(programs_dict)} entries")

                # Get channel's programming start time (like old code did)
                from datetime import datetime, timezone, timedelta

                channel_start_time = channel.get("startTime")
                current_time = None

                if channel_start_time:
                    try:
                        # startTime can be a timestamp (ms) or ISO string
                        if isinstance(channel_start_time, (int, float)):
                            current_time = datetime.fromtimestamp(channel_start_time / 1000, tz=timezone.utc)
                        elif isinstance(channel_start_time, str):
                            if channel_start_time.replace(".", "").isdigit():
                                current_time = datetime.fromtimestamp(float(channel_start_time) / 1000, tz=timezone.utc)
                            else:
                                current_time = datetime.fromisoformat(channel_start_time.replace("Z", "+00:00"))
                        logger.info(f"Channel startTime: {channel_start_time} -> {current_time}")
                    except Exception as e:
                        logger.warning(f"Failed to parse channel startTime {channel_start_time}: {e}")

                # Fallback: try startTimeOffsets from programming response
                start_time_offsets = programs_response.get("startTimeOffsets", [])
                logger.info(f"startTimeOffsets count: {len(start_time_offsets)}")

                # Build programs_data by merging lineup with program details
                programs_data = []
                for i, lineup_entry in enumerate(lineup):
                    program_id = lineup_entry.get("id")
                    program_details = programs_dict.get(program_id, {})

                    # Get duration
                    duration_ms = lineup_entry.get("durationMs", program_details.get("duration", 0))

                    # Calculate start/end time by accumulating durations from channel startTime
                    # Store times in local timezone for consistency with time blocks
                    start_time = ""
                    end_time = ""

                    if current_time:
                        # Use accumulated time from channel startTime
                        # Convert to local time for display (time blocks are in local time)
                        local_start = current_time.astimezone()
                        start_time = local_start.isoformat()
                        end_dt = current_time + timedelta(milliseconds=duration_ms)
                        local_end = end_dt.astimezone()
                        end_time = local_end.isoformat()
                        # Advance current_time for next program
                        current_time = end_dt
                    elif i < len(start_time_offsets) and start_time_offsets[i]:
                        # Fallback to startTimeOffsets if available
                        offset_ms = start_time_offsets[i]
                        utc_start = datetime.fromtimestamp(offset_ms / 1000, tz=timezone.utc)
                        start_time = utc_start.astimezone().isoformat()
                        if duration_ms:
                            utc_end = utc_start + timedelta(milliseconds=duration_ms)
                            end_time = utc_end.astimezone().isoformat()
                    else:
                        # Last fallback: lineup entry start
                        start_time = lineup_entry.get("start", "")
                        if start_time and duration_ms:
                            try:
                                start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                                local_start = start_dt.astimezone()
                                start_time = local_start.isoformat()
                                end_time = (local_start + timedelta(milliseconds=duration_ms)).isoformat()
                            except Exception:
                                pass

                    # Merge lineup entry with program details
                    merged_program = {
                        **program_details,
                        "duration": duration_ms,
                        "start": start_time,
                        "end": end_time,
                        "lineup_id": program_id,
                    }
                    programs_data.append(merged_program)

                    # Debug first few programs
                    if i < 3:
                        logger.info(f"Program {i}: title={merged_program.get('title')}, start={start_time}, type={merged_program.get('type')}, keys={list(merged_program.keys())[:10]}")
            else:
                programs_data = programs_response if programs_response else []

            if not programs_data:
                raise ValueError("No programs found in channel")

            channel_detail = f"{channel_name} • {len(programs_data)} programmes"
            await job_manager.update_step_status(job_id, "channel", "completed", channel_detail)

            # Enrich content from cache (same cache as programming)
            enriched_count = 0
            not_in_cache = []

            if use_cache:
                await job_manager.update_step_status(job_id, "cache", "running")
                await job_manager.update_job_progress(job_id, 25, "Recherche dans cache...")

                for i, prog in enumerate(programs_data):
                    # Try multiple key formats used by Tunarr
                    plex_key = prog.get("externalKey", prog.get("plexKey", prog.get("id", "")))

                    if plex_key:
                        cached = await enrichment_service.get_cached_content(plex_key)
                        if cached:
                            content, meta = cached
                            prog["_cached_content"] = content
                            prog["_cached_meta"] = meta
                            enriched_count += 1
                        else:
                            prog["_cached_content"] = None
                            prog["_cached_meta"] = None
                            not_in_cache.append((i, prog))
                    else:
                        prog["_cached_content"] = None
                        prog["_cached_meta"] = None
                        not_in_cache.append((i, prog))

                    if i % 20 == 0:
                        await job_manager.update_step_status(
                            job_id, "cache", "running",
                            f"{i}/{len(programs_data)} vérifiés"
                        )

                cache_detail = f"{enriched_count}/{len(programs_data)} trouvés dans cache"
                await job_manager.update_step_status(job_id, "cache", "completed", cache_detail)
                logger.info(f"Cache: {enriched_count} found, {len(not_in_cache)} missing")
            else:
                # No cache, all programs need enrichment
                for i, prog in enumerate(programs_data):
                    prog["_cached_content"] = None
                    prog["_cached_meta"] = None
                    not_in_cache.append((i, prog))

            # TMDB enrichment for programs not found in cache
            if use_tmdb and tmdb_service and not_in_cache:
                await job_manager.update_step_status(job_id, "tmdb", "running")
                await job_manager.update_job_progress(
                    job_id, 35, f"Enrichissement TMDB: 0/{len(not_in_cache)}..."
                )

                tmdb_enriched = 0
                # Log first item for debugging
                if not_in_cache:
                    first_prog = not_in_cache[0][1]
                    logger.info(f"First program to enrich: title={first_prog.get('title')}, type={first_prog.get('type')}, year={first_prog.get('year')}, keys={list(first_prog.keys())[:15]}")

                for idx, (prog_idx, prog) in enumerate(not_in_cache):
                    title = prog.get("title", "")
                    # Tunarr returns type="content" with subtype="movie" or "episode"
                    prog_type = prog.get("subtype") or prog.get("type", "movie")
                    # Map "content" to "movie" as default
                    if prog_type == "content":
                        prog_type = "movie"
                    # Extract year from date field (format: "2009-04-29" or similar)
                    year = prog.get("year")
                    if not year:
                        date_str = prog.get("date", "")
                        if date_str and len(date_str) >= 4:
                            try:
                                year = int(date_str[:4])
                            except (ValueError, TypeError):
                                year = None

                    if idx % 5 == 0:
                        await job_manager.update_step_status(
                            job_id, "tmdb", "running",
                            f"{idx}/{len(not_in_cache)} enrichis"
                        )
                        await job_manager.update_job_progress(
                            job_id, 35 + (idx / len(not_in_cache)) * 15,
                            f"Enrichissement TMDB: {idx}/{len(not_in_cache)}..."
                        )

                    try:
                        enriched = await tmdb_service.enrich_content(title, prog_type, year)
                        if enriched:
                            # Build content and meta from TMDB data
                            # Use TMDB age_rating if available, otherwise fall back to Tunarr contentRating
                            age_rating = enriched.get("age_rating") or prog.get("contentRating")
                            meta_data = {
                                "genres": enriched.get("genres", []),
                                "tmdb_rating": enriched.get("tmdb_rating"),
                                "vote_count": enriched.get("vote_count", 0),
                                "keywords": enriched.get("keywords", []),
                                "collections": enriched.get("collections", []),
                                "studios": enriched.get("studios", []),
                                "budget": enriched.get("budget"),
                                "revenue": enriched.get("revenue"),
                                "content_rating": age_rating,
                                "age_rating": age_rating,
                            }
                            prog["_cached_meta"] = meta_data
                            tmdb_enriched += 1

                            # Save to cache for future "cache only" requests
                            plex_key = prog.get("externalKey", prog.get("plexKey", prog.get("id", "")))
                            if plex_key:
                                content_data = {
                                    "title": title,
                                    "type": prog_type,
                                    "duration_ms": prog.get("duration", 0),
                                    "year": year,
                                }
                                await enrichment_service.save_content_with_meta(
                                    plex_key, content_data, meta_data
                                )

                            if idx < 3:  # Log first 3 enrichments
                                logger.info(f"TMDB enriched & cached: {title} -> genres={enriched.get('genres')}, rating={enriched.get('tmdb_rating')}")
                        else:
                            if idx < 3:
                                logger.warning(f"TMDB returned no data for: {title} (type={prog_type}, year={year})")
                    except Exception as e:
                        logger.warning(f"TMDB enrichment failed for {title}: {e}")

                tmdb_detail = f"{tmdb_enriched}/{len(not_in_cache)} enrichis via TMDB"
                await job_manager.update_step_status(job_id, "tmdb", "completed", tmdb_detail)
                logger.info(f"TMDB: {tmdb_enriched}/{len(not_in_cache)} enriched")

                # Commit the cached content to database for future "cache only" requests
                await session.commit()
                logger.info(f"TMDB enrichment saved to cache")

            # Score each program
            await job_manager.update_step_status(job_id, "scoring", "running")
            await job_manager.update_job_progress(
                job_id, 40, f"Calcul des scores: 0/{len(programs_data)}..."
            )

            scoring_engine = ScoringEngine()
            scored_programs = []
            total_score = 0.0
            violations_count = 0
            mandatory_violations: list[str] = []
            forbidden_violations: list[str] = []
            penalties_applied: list[str] = []
            bonuses_applied: list[str] = []
            score_distribution: dict[str, float] = {
                "type": 0, "duration": 0, "genre": 0, "timing": 0,
                "strategy": 0, "age": 0, "rating": 0, "filter": 0, "bonus": 0
            }

            # Pre-compute block assignments to determine first/last in block
            time_blocks = profile_dict.get("time_blocks", [])
            block_assignments: list[dict[str, Any] | None] = []
            for prog in programs_data:
                start_time_str = prog.get("start", "")
                block_assignments.append(_get_block_for_time(start_time_str, time_blocks))

            # Import ScoringContext for timing information
            from app.core.scoring.base_criterion import ScoringContext

            for i, prog in enumerate(programs_data):
                # Update progress
                progress = 40 + (i / len(programs_data)) * 50
                if i % 10 == 0:
                    await job_manager.update_step_status(
                        job_id, "scoring", "running",
                        f"{i}/{len(programs_data)} scorés"
                    )
                    await job_manager.update_job_progress(
                        job_id, progress, f"Calcul des scores: {i}/{len(programs_data)}..."
                    )

                # Use cached content if available, otherwise use Tunarr data
                cached_content = prog.get("_cached_content")
                cached_meta = prog.get("_cached_meta")

                # Build content from cache or Tunarr data
                if cached_content:
                    content = cached_content
                else:
                    # Tunarr returns type="content" with subtype="movie" or "episode"
                    content_type = prog.get("subtype") or prog.get("type", "movie")
                    if content_type == "content":
                        content_type = "movie"
                    # Extract year from date field if not present
                    content_year = prog.get("year")
                    if not content_year:
                        date_str = prog.get("date", "")
                        if date_str and len(date_str) >= 4:
                            try:
                                content_year = int(date_str[:4])
                            except (ValueError, TypeError):
                                content_year = None
                    content = {
                        "id": prog.get("id", ""),
                        "plex_key": prog.get("externalKey", prog.get("plexKey", prog.get("id", ""))),
                        "title": prog.get("title", "Unknown"),
                        "type": content_type,
                        "duration_ms": prog.get("duration", 0),
                        "year": content_year,
                    }

                # Use cached meta (from cache or TMDB enrichment), or fallback to Tunarr data
                if cached_meta:
                    meta = cached_meta
                else:
                    meta = {
                        "genres": prog.get("genres", []),
                        "tmdb_rating": prog.get("rating"),
                        "content_rating": prog.get("contentRating"),
                        "age_rating": prog.get("contentRating"),
                    }

                # Get time block for program
                start_time = prog.get("start", "")
                block = block_assignments[i]

                # Determine if first/last in block
                current_block_name = block.get("name") if block else None
                prev_block_name = block_assignments[i - 1].get("name") if i > 0 and block_assignments[i - 1] else None
                next_block_name = block_assignments[i + 1].get("name") if i < len(block_assignments) - 1 and block_assignments[i + 1] else None

                is_first_in_block = current_block_name and current_block_name != prev_block_name
                is_last_in_block = current_block_name and current_block_name != next_block_name

                # Create ScoringContext with timing information
                context = None
                if block and start_time:
                    try:
                        # Parse program start time
                        prog_start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))

                        # Parse block start/end times (HH:MM format) using program date
                        block_start_str = block.get("start_time", "00:00")
                        block_end_str = block.get("end_time", "00:00")

                        block_start_h, block_start_m = map(int, block_start_str.split(":"))
                        block_end_h, block_end_m = map(int, block_end_str.split(":"))

                        # Use program's local date for block times
                        local_prog_start = prog_start_dt.astimezone()
                        base_date = local_prog_start.date()

                        block_start_dt = datetime(
                            base_date.year, base_date.month, base_date.day,
                            block_start_h, block_start_m,
                            tzinfo=local_prog_start.tzinfo
                        )
                        block_end_dt = datetime(
                            base_date.year, base_date.month, base_date.day,
                            block_end_h, block_end_m,
                            tzinfo=local_prog_start.tzinfo
                        )

                        # Handle overnight blocks
                        if block_end_dt <= block_start_dt:
                            block_end_dt += timedelta(days=1)

                        context = ScoringContext(
                            current_time=prog_start_dt,
                            block_start_time=block_start_dt,
                            block_end_time=block_end_dt,
                            is_first_in_block=is_first_in_block,
                            is_last_in_block=is_last_in_block,
                        )
                    except Exception as e:
                        logger.warning(f"Failed to create ScoringContext for {prog.get('title')}: {e}")

                # Score the program
                score_result = scoring_engine.score(content, meta, profile_dict, block, context)

                # Track violations
                if score_result.forbidden_violations:
                    violations_count += len(score_result.forbidden_violations)
                    for v in score_result.forbidden_violations:
                        forbidden_violations.append(
                            f"{content.get('title', 'Unknown')}: {v.get('message', v.get('rule', 'Unknown'))}"
                        )

                if score_result.mandatory_penalties:
                    for p in score_result.mandatory_penalties:
                        mandatory_violations.append(
                            f"{content.get('title', 'Unknown')}: {p.get('message', p.get('rule', 'Unknown'))}"
                        )
                        penalties_applied.append(p.get("rule", "unknown"))

                # Update score distribution (average per criterion)
                for name, res in score_result.criterion_results.items():
                    if name in score_distribution:
                        score_distribution[name] += res.score

                total_score += score_result.total_score

                # Build program result with full scoring details (same format as programming)
                # Use skipped flag to return None for skipped criteria (e.g., timing for middle programs)
                scored_programs.append({
                    "id": str(uuid4()),
                    "title": content.get("title", "Unknown"),
                    "type": content.get("type", "movie"),
                    "start_time": start_time,
                    "end_time": prog.get("end", ""),
                    "duration_min": content.get("duration_ms", 0) / 60000,
                    "genres": meta.get("genres", []) if meta else [],
                    "keywords": meta.get("keywords", []) if meta else [],
                    "year": content.get("year"),
                    "tmdb_rating": meta.get("tmdb_rating") if meta else None,
                    "content_rating": meta.get("age_rating") or meta.get("content_rating") if meta else None,
                    "plex_key": content.get("plex_key", ""),
                    "block_name": block.get("name") if block else None,
                    "score": {
                        "total": score_result.total_score,
                        "breakdown": {
                            name: (res.score if not res.skipped else None)
                            for name, res in score_result.criterion_results.items()
                        },
                        "criteria": {
                            name: {
                                "score": res.score if not res.skipped else None,
                                "weight": res.weight,
                                "weighted_score": res.weighted_score,
                                "multiplier": res.multiplier,
                                "multiplied_weighted_score": res.multiplied_weighted_score,
                                "skipped": res.skipped,
                                "details": res.details,  # Include criterion-specific details
                                "rule_violation": {
                                    "rule_type": res.rule_violation.rule_type,
                                    "values": res.rule_violation.values,
                                    "penalty_or_bonus": res.rule_violation.penalty_or_bonus,
                                } if res.rule_violation else None,
                            }
                            for name, res in score_result.criterion_results.items()
                        },
                        "penalties": [p.get("message", "") for p in score_result.mandatory_penalties],
                        "bonuses": score_result.bonuses_applied,
                        "mandatory_met": len(score_result.mandatory_penalties) == 0,
                        "forbidden_violated": len(score_result.forbidden_violations) > 0,
                        "forbidden_details": score_result.forbidden_violations,
                        "mandatory_details": score_result.mandatory_penalties,
                        "keyword_multiplier": score_result.keyword_multiplier,
                        "keyword_match": score_result.keyword_match,
                        "criterion_rule_violations": score_result.criterion_rule_violations,
                    },
                })

            await job_manager.update_step_status(job_id, "scoring", "completed", f"{len(programs_data)} programmes scorés")

            # Finalize
            await job_manager.update_step_status(job_id, "finalize", "running")
            await job_manager.update_job_progress(job_id, 95, "Génération du rapport...")

            # Calculate averages for distribution
            if len(programs_data) > 0:
                for key in score_distribution:
                    score_distribution[key] = score_distribution[key] / len(programs_data)

            average_score = total_score / len(scored_programs) if scored_programs else 0.0

            # Store result
            result_id = str(uuid4())
            result_data = {
                "id": result_id,
                "channel_id": request.channel_id,
                "channel_name": channel_name,
                "profile_id": request.profile_id,
                "profile_name": profile.name,
                "programs": scored_programs,
                "total_score": total_score,
                "average_score": average_score,
                "total_items": len(scored_programs),
                "violations_count": violations_count,
                "mandatory_violations": mandatory_violations[:50],  # Increased limit
                "forbidden_violations": forbidden_violations[:50],
                "penalties_applied": list(set(penalties_applied)),
                "bonuses_applied": list(set(bonuses_applied)),
                "score_distribution": score_distribution,
                "created_at": datetime.utcnow().isoformat(),
                # Include time blocks for UI
                "time_blocks": profile.time_blocks or [],
            }
            _scoring_results[result_id] = result_data

            # Save to history
            history_service = HistoryService(session)
            await history_service.create_entry(
                entry_type="scoring",
                channel_id=request.channel_id,
                profile_id=request.profile_id,
            )

            finalize_detail = f"Score moyen: {average_score:.1f} • {violations_count} violations"
            await job_manager.update_step_status(job_id, "finalize", "completed", finalize_detail)

            await job_manager.complete_job(
                job_id,
                result=result_data,
                best_score=average_score,
            )

            logger.info(f"Scoring completed: {len(scored_programs)} programs, avg {average_score:.2f}")

    except Exception as e:
        logger.error(f"Scoring failed: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        await job_manager.fail_job(job_id, str(e))


def _get_block_for_time(
    time_str: str,
    time_blocks: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Find the time block for a given time.

    Time blocks are defined in local time, so we need to convert
    UTC times to local time before comparing.
    """
    if not time_str or not time_blocks:
        return None

    try:
        if "T" in time_str:
            dt = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
            # Convert UTC to local time for comparison with time blocks
            # Time blocks are defined in local time by users
            local_dt = dt.astimezone()  # Convert to system local timezone
            check_time = local_dt.hour * 60 + local_dt.minute
        else:
            parts = time_str.split(":")
            check_time = int(parts[0]) * 60 + (int(parts[1]) if len(parts) > 1 else 0)

        for block in time_blocks:
            start_h, start_m = map(int, block["start_time"].split(":"))
            end_h, end_m = map(int, block["end_time"].split(":"))

            start_mins = start_h * 60 + start_m
            end_mins = end_h * 60 + end_m

            # Handle overnight blocks
            if end_mins < start_mins:
                if check_time >= start_mins or check_time < end_mins:
                    return block
            else:
                if start_mins <= check_time < end_mins:
                    return block

        return None
    except (ValueError, TypeError, KeyError):
        return None


def _run_scoring_in_thread(job_id: str, request: ScoringRequest) -> None:
    """Run scoring in a separate thread with its own event loop."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_run_scoring(job_id, request))
    finally:
        loop.close()


@router.post("/analyze")
async def analyze_scoring(
    request: ScoringRequest,
) -> dict[str, Any]:
    """
    Analyze scoring for a channel's programming.

    This starts a background job and returns immediately.
    Progress is tracked via WebSocket.
    """
    job_manager = get_job_manager()

    # Create job
    job_id = await job_manager.create_job(
        job_type=JobType.SCORING,
        title="Analyse scoring",
        channel_id=request.channel_id,
        profile_id=request.profile_id,
    )

    # Run in a separate thread with its own event loop
    # This is needed because SQLAlchemy async requires proper greenlet context
    thread = threading.Thread(
        target=_run_scoring_in_thread,
        args=(job_id, request),
        daemon=True,
    )
    thread.start()

    return {
        "job_id": job_id,
        "status": "started",
        "message": "Scoring analysis started. Track progress via WebSocket.",
    }


@router.get("/results/{result_id}")
async def get_scoring_result(result_id: str) -> dict[str, Any]:
    """Get a scoring result by ID."""
    result = _scoring_results.get(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return result


@router.get("/results/{result_id}/export/csv")
async def export_scoring_csv(result_id: str) -> PlainTextResponse:
    """Export scoring result as CSV."""
    result = _scoring_results.get(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    # Build CSV
    lines = [
        "Title,Type,Start Time,Duration (min),Total Score,Type,Duration,Genre,Timing,Strategy,Age,Rating,Filter,Bonus,Mandatory Met,Forbidden Violated"
    ]

    for prog in result["programs"]:
        score = prog["score"]
        breakdown = score.get("breakdown", {})
        line = ",".join([
            f'"{prog["title"]}"',
            prog["type"],
            prog["start_time"],
            f'{prog["duration_min"]:.1f}',
            f'{score["total"]:.2f}',
            f'{breakdown.get("type", 0):.2f}',
            f'{breakdown.get("duration", 0):.2f}',
            f'{breakdown.get("genre", 0):.2f}',
            f'{breakdown.get("timing", 0):.2f}',
            f'{breakdown.get("strategy", 0):.2f}',
            f'{breakdown.get("age", 0):.2f}',
            f'{breakdown.get("rating", 0):.2f}',
            f'{breakdown.get("filter", 0):.2f}',
            f'{breakdown.get("bonus", 0):.2f}',
            str(score["mandatory_met"]),
            str(score["forbidden_violated"]),
        ])
        lines.append(line)

    csv_content = "\n".join(lines)

    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="scoring-{result_id}.csv"'
        },
    )


@router.get("/results/{result_id}/export/json")
async def export_scoring_json(result_id: str) -> dict[str, Any]:
    """Export scoring result as JSON."""
    result = _scoring_results.get(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return result
