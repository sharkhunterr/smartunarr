"""ScoringService to analyze existing programming."""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.scoring.base_criterion import ScoringContext
from app.core.scoring.engine import ScoringEngine, ScoringResult
from app.models.channel import Channel, Program
from app.models.content import Content, ContentMeta
from app.models.profile import Profile
from app.models.scoring import ScoringResult as ScoringResultModel

logger = logging.getLogger(__name__)


@dataclass
class ProgramScore:
    """Score result for a single program."""

    program_id: str
    content_id: str
    title: str
    start_time: datetime
    end_time: datetime
    block_name: str
    position: int
    score: ScoringResult


@dataclass
class ChannelAnalysis:
    """Complete analysis of a channel's programming."""

    channel_id: str
    channel_name: str
    profile_id: str
    profile_name: str
    total_programs: int
    total_score: float
    average_score: float
    program_scores: list[ProgramScore]
    forbidden_violations: list[dict[str, Any]]
    mandatory_penalties: list[dict[str, Any]]
    analyzed_at: datetime


class ScoringService:
    """Service for analyzing and scoring existing channel programming."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize scoring service."""
        self.session = session
        self.scoring_engine = ScoringEngine()

    async def analyze_channel(
        self,
        channel_id: str,
        profile_id: str,
    ) -> ChannelAnalysis:
        """
        Analyze all programs in a channel against a profile.

        Args:
            channel_id: Channel to analyze
            profile_id: Profile to use for scoring

        Returns:
            ChannelAnalysis with all program scores
        """
        # Load channel
        channel = await self.session.get(Channel, channel_id)
        if not channel:
            raise ValueError(f"Channel not found: {channel_id}")

        # Load profile
        profile = await self.session.get(Profile, profile_id)
        if not profile:
            raise ValueError(f"Profile not found: {profile_id}")

        # Convert profile to dict for scoring engine
        profile_dict = {
            "time_blocks": profile.time_blocks,
            "mandatory_forbidden_criteria": profile.mandatory_forbidden_criteria,
            "strategies": profile.strategies,
            "scoring_weights": profile.scoring_weights,
        }

        # Load programs with content
        programs_query = (
            select(Program).where(Program.channel_id == channel_id).order_by(Program.position)
        )
        result = await self.session.execute(programs_query)
        programs = result.scalars().all()

        program_scores: list[ProgramScore] = []
        all_violations: list[dict[str, Any]] = []
        all_penalties: list[dict[str, Any]] = []
        total_score = 0.0

        # Group programs by block to identify first/last in each block
        programs_by_block: dict[str, list[Any]] = {}
        for program in programs:
            block_name = program.block_name or "Unknown"
            if block_name not in programs_by_block:
                programs_by_block[block_name] = []
            programs_by_block[block_name].append(program)

        # Create sets of first and last program IDs for each block
        first_in_block_ids: set[str] = set()
        last_in_block_ids: set[str] = set()
        for block_programs in programs_by_block.values():
            if block_programs:
                first_in_block_ids.add(block_programs[0].id)
                last_in_block_ids.add(block_programs[-1].id)

        for program in programs:
            # Load content and metadata
            content = await self.session.get(Content, program.content_id)
            if not content:
                continue

            content_dict = {
                "id": content.id,
                "plex_key": content.plex_key,
                "title": content.title,
                "type": content.type,
                "duration_ms": content.duration_ms,
                "year": content.year,
                "start_time": program.start_time.isoformat() if program.start_time else None,
                "end_time": program.end_time.isoformat() if program.end_time else None,
            }

            # Load metadata
            meta_query = select(ContentMeta).where(ContentMeta.content_id == content.id)
            meta_result = await self.session.execute(meta_query)
            meta = meta_result.scalar_one_or_none()

            meta_dict = None
            if meta:
                meta_dict = {
                    "genres": meta.genres,
                    "keywords": meta.keywords,
                    "age_rating": meta.age_rating,
                    "tmdb_rating": meta.tmdb_rating,
                    "vote_count": meta.vote_count,
                    "studios": meta.studios,
                    "collections": meta.collections,
                }

            # Get block for program time
            block_dict = self._get_block_for_time(
                program.start_time.time(),
                profile.time_blocks,
            )

            # Create scoring context with first/last in block information
            is_first = program.id in first_in_block_ids
            is_last = program.id in last_in_block_ids
            scoring_context = ScoringContext(
                current_time=program.start_time,
                block_start_time=None,  # Will be computed from block if needed
                block_end_time=None,  # Will be computed from block if needed
                is_first_in_block=is_first,
                is_last_in_block=is_last,
            )

            # Score the program
            score = self.scoring_engine.score(
                content_dict,
                meta_dict,
                profile_dict,
                block_dict,
                scoring_context,
            )

            program_scores.append(
                ProgramScore(
                    program_id=program.id,
                    content_id=content.id,
                    title=content.title,
                    start_time=program.start_time,
                    end_time=program.end_time,
                    block_name=program.block_name or "Unknown",
                    position=program.position,
                    score=score,
                )
            )

            total_score += score.total_score

            # Collect violations and penalties
            if score.forbidden_violations:
                for violation in score.forbidden_violations:
                    all_violations.append(
                        {
                            "program_id": program.id,
                            "content_title": content.title,
                            **violation,
                        }
                    )

            if score.mandatory_penalties:
                for penalty in score.mandatory_penalties:
                    all_penalties.append(
                        {
                            "program_id": program.id,
                            "content_title": content.title,
                            **penalty,
                        }
                    )

        average_score = total_score / len(program_scores) if program_scores else 0.0

        return ChannelAnalysis(
            channel_id=channel.id,
            channel_name=channel.name,
            profile_id=profile.id,
            profile_name=profile.name,
            total_programs=len(program_scores),
            total_score=total_score,
            average_score=average_score,
            program_scores=program_scores,
            forbidden_violations=all_violations,
            mandatory_penalties=all_penalties,
            analyzed_at=datetime.utcnow(),
        )

    def _get_block_for_time(
        self,
        t: Any,
        time_blocks: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        """Find the time block that contains the given time."""
        from datetime import time as dt_time

        for block in time_blocks:
            start_str = block.get("start_time", "00:00")
            end_str = block.get("end_time", "23:59")

            try:
                start_parts = start_str.split(":")
                end_parts = end_str.split(":")
                start_time = dt_time(int(start_parts[0]), int(start_parts[1]))
                end_time = dt_time(int(end_parts[0]), int(end_parts[1]))
            except (ValueError, IndexError):
                continue

            # Handle midnight-spanning blocks
            if end_time < start_time:
                if t >= start_time or t < end_time:
                    return block
            else:
                if start_time <= t < end_time:
                    return block

        return None

    def detect_violations(
        self,
        analysis: ChannelAnalysis,
    ) -> list[dict[str, Any]]:
        """
        Detect all forbidden rule violations in the analysis.

        Args:
            analysis: Channel analysis result

        Returns:
            List of violation details
        """
        violations = []

        for violation in analysis.forbidden_violations:
            violations.append(
                {
                    "type": "forbidden",
                    "severity": "critical",
                    "program_id": violation.get("program_id"),
                    "content_title": violation.get("content_title"),
                    "rule": violation.get("rule"),
                    "value": violation.get("value"),
                    "message": violation.get("message"),
                }
            )

        return violations

    def calculate_penalties(
        self,
        analysis: ChannelAnalysis,
    ) -> list[dict[str, Any]]:
        """
        Calculate all mandatory rule penalties in the analysis.

        Args:
            analysis: Channel analysis result

        Returns:
            List of penalty details with amounts
        """
        penalties = []

        for penalty in analysis.mandatory_penalties:
            penalties.append(
                {
                    "type": "mandatory",
                    "severity": "warning",
                    "program_id": penalty.get("program_id"),
                    "content_title": penalty.get("content_title"),
                    "rule": penalty.get("rule"),
                    "required": penalty.get("required"),
                    "actual": penalty.get("actual"),
                    "penalty_amount": penalty.get("penalty", 0),
                    "message": penalty.get("message"),
                }
            )

        return penalties

    async def save_scoring_results(
        self,
        analysis: ChannelAnalysis,
    ) -> None:
        """
        Save scoring results to database.

        Args:
            analysis: Channel analysis to save
        """
        for program_score in analysis.program_scores:
            # Check if scoring result exists
            existing_query = select(ScoringResultModel).where(
                ScoringResultModel.program_id == program_score.program_id
            )
            existing = await self.session.execute(existing_query)
            existing_result = existing.scalar_one_or_none()

            score = program_score.score
            criterion_results = score.criterion_results

            if existing_result:
                # Update existing
                existing_result.profile_id = analysis.profile_id
                existing_result.total_score = score.total_score
                existing_result.type_score = (
                    criterion_results.get("type", {}).score if "type" in criterion_results else 0
                )
                existing_result.duration_score = (
                    criterion_results.get("duration", {}).score
                    if "duration" in criterion_results
                    else 0
                )
                existing_result.genre_score = (
                    criterion_results.get("genre", {}).score if "genre" in criterion_results else 0
                )
                existing_result.timing_score = (
                    criterion_results.get("timing", {}).score
                    if "timing" in criterion_results
                    else 0
                )
                existing_result.strategy_score = (
                    criterion_results.get("strategy", {}).score
                    if "strategy" in criterion_results
                    else 0
                )
                existing_result.age_score = (
                    criterion_results.get("age", {}).score if "age" in criterion_results else 0
                )
                existing_result.rating_score = (
                    criterion_results.get("rating", {}).score
                    if "rating" in criterion_results
                    else 0
                )
                existing_result.filter_score = (
                    criterion_results.get("filter", {}).score
                    if "filter" in criterion_results
                    else 0
                )
                existing_result.bonus_score = (
                    criterion_results.get("bonus", {}).score if "bonus" in criterion_results else 0
                )
                existing_result.forbidden_violations = score.forbidden_violations
                existing_result.mandatory_penalties = score.mandatory_penalties
                existing_result.scored_at = analysis.analyzed_at
            else:
                # Create new
                scoring_result = ScoringResultModel(
                    program_id=program_score.program_id,
                    profile_id=analysis.profile_id,
                    total_score=score.total_score,
                    type_score=criterion_results.get("type").score
                    if "type" in criterion_results
                    else 0,
                    duration_score=criterion_results.get("duration").score
                    if "duration" in criterion_results
                    else 0,
                    genre_score=criterion_results.get("genre").score
                    if "genre" in criterion_results
                    else 0,
                    timing_score=criterion_results.get("timing").score
                    if "timing" in criterion_results
                    else 0,
                    strategy_score=criterion_results.get("strategy").score
                    if "strategy" in criterion_results
                    else 0,
                    age_score=criterion_results.get("age").score
                    if "age" in criterion_results
                    else 0,
                    rating_score=criterion_results.get("rating").score
                    if "rating" in criterion_results
                    else 0,
                    filter_score=criterion_results.get("filter").score
                    if "filter" in criterion_results
                    else 0,
                    bonus_score=criterion_results.get("bonus").score
                    if "bonus" in criterion_results
                    else 0,
                    forbidden_violations=score.forbidden_violations,
                    mandatory_penalties=score.mandatory_penalties,
                    scored_at=analysis.analyzed_at,
                )
                self.session.add(scoring_result)

        await self.session.commit()

    def export_to_csv(self, analysis: ChannelAnalysis) -> str:
        """
        Export analysis to CSV format.

        Args:
            analysis: Channel analysis to export

        Returns:
            CSV string
        """
        lines = [
            "Position,Title,Start Time,End Time,Block,Total Score,Type,Duration,Genre,Timing,Strategy,Age,Rating,Filter,Bonus,Violations,Penalties"
        ]

        for ps in analysis.program_scores:
            criteria = ps.score.criterion_results
            line = ",".join(
                [
                    str(ps.position),
                    f'"{ps.title}"',
                    ps.start_time.isoformat(),
                    ps.end_time.isoformat(),
                    ps.block_name,
                    f"{ps.score.total_score:.2f}",
                    f"{criteria.get('type', {}).score if 'type' in criteria else 0:.2f}",
                    f"{criteria.get('duration', {}).score if 'duration' in criteria else 0:.2f}",
                    f"{criteria.get('genre', {}).score if 'genre' in criteria else 0:.2f}",
                    f"{criteria.get('timing', {}).score if 'timing' in criteria else 0:.2f}",
                    f"{criteria.get('strategy', {}).score if 'strategy' in criteria else 0:.2f}",
                    f"{criteria.get('age', {}).score if 'age' in criteria else 0:.2f}",
                    f"{criteria.get('rating', {}).score if 'rating' in criteria else 0:.2f}",
                    f"{criteria.get('filter', {}).score if 'filter' in criteria else 0:.2f}",
                    f"{criteria.get('bonus', {}).score if 'bonus' in criteria else 0:.2f}",
                    str(len(ps.score.forbidden_violations)),
                    str(len(ps.score.mandatory_penalties)),
                ]
            )
            lines.append(line)

        return "\n".join(lines)

    def export_to_json(self, analysis: ChannelAnalysis) -> dict[str, Any]:
        """
        Export analysis to JSON format.

        Args:
            analysis: Channel analysis to export

        Returns:
            JSON-serializable dictionary
        """
        return {
            "channel": {
                "id": analysis.channel_id,
                "name": analysis.channel_name,
            },
            "profile": {
                "id": analysis.profile_id,
                "name": analysis.profile_name,
            },
            "summary": {
                "total_programs": analysis.total_programs,
                "total_score": analysis.total_score,
                "average_score": analysis.average_score,
                "total_violations": len(analysis.forbidden_violations),
                "total_penalties": len(analysis.mandatory_penalties),
            },
            "programs": [
                {
                    "program_id": ps.program_id,
                    "content_id": ps.content_id,
                    "title": ps.title,
                    "start_time": ps.start_time.isoformat(),
                    "end_time": ps.end_time.isoformat(),
                    "block_name": ps.block_name,
                    "position": ps.position,
                    "score": ps.score.to_dict(),
                }
                for ps in analysis.program_scores
            ],
            "violations": analysis.forbidden_violations,
            "penalties": analysis.mandatory_penalties,
            "analyzed_at": analysis.analyzed_at.isoformat(),
        }
