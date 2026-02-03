"""Database indexes for performance optimization."""

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Index definitions per table
INDEXES = {
    "profiles": [
        ("idx_profiles_name", "CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(name)"),
        (
            "idx_profiles_created_at",
            "CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC)",
        ),
        (
            "idx_profiles_updated_at",
            "CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at DESC)",
        ),
    ],
    "contents": [
        (
            "idx_contents_plex_key",
            "CREATE INDEX IF NOT EXISTS idx_contents_plex_key ON contents(plex_key)",
        ),
        ("idx_contents_type", "CREATE INDEX IF NOT EXISTS idx_contents_type ON contents(type)"),
        ("idx_contents_title", "CREATE INDEX IF NOT EXISTS idx_contents_title ON contents(title)"),
        (
            "idx_contents_library_id",
            "CREATE INDEX IF NOT EXISTS idx_contents_library_id ON contents(library_id)",
        ),
    ],
    "content_meta": [
        (
            "idx_content_meta_content_id",
            "CREATE INDEX IF NOT EXISTS idx_content_meta_content_id ON content_meta(content_id)",
        ),
        (
            "idx_content_meta_tmdb_id",
            "CREATE INDEX IF NOT EXISTS idx_content_meta_tmdb_id ON content_meta(tmdb_id)",
        ),
    ],
    "channels": [
        (
            "idx_channels_tunarr_id",
            "CREATE INDEX IF NOT EXISTS idx_channels_tunarr_id ON channels(tunarr_id)",
        ),
        ("idx_channels_name", "CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name)"),
    ],
    "programs": [
        (
            "idx_programs_channel_id",
            "CREATE INDEX IF NOT EXISTS idx_programs_channel_id ON programs(channel_id)",
        ),
        (
            "idx_programs_content_id",
            "CREATE INDEX IF NOT EXISTS idx_programs_content_id ON programs(content_id)",
        ),
        (
            "idx_programs_start_time",
            "CREATE INDEX IF NOT EXISTS idx_programs_start_time ON programs(start_time)",
        ),
        (
            "idx_programs_channel_start",
            "CREATE INDEX IF NOT EXISTS idx_programs_channel_start ON programs(channel_id, start_time)",
        ),
    ],
    "scoring_results": [
        (
            "idx_scoring_channel_id",
            "CREATE INDEX IF NOT EXISTS idx_scoring_channel_id ON scoring_results(channel_id)",
        ),
        (
            "idx_scoring_profile_id",
            "CREATE INDEX IF NOT EXISTS idx_scoring_profile_id ON scoring_results(profile_id)",
        ),
        (
            "idx_scoring_program_id",
            "CREATE INDEX IF NOT EXISTS idx_scoring_program_id ON scoring_results(program_id)",
        ),
        (
            "idx_scoring_total_score",
            "CREATE INDEX IF NOT EXISTS idx_scoring_total_score ON scoring_results(total_score DESC)",
        ),
    ],
    "history_entries": [
        (
            "idx_history_type",
            "CREATE INDEX IF NOT EXISTS idx_history_type ON history_entries(type)",
        ),
        (
            "idx_history_status",
            "CREATE INDEX IF NOT EXISTS idx_history_status ON history_entries(status)",
        ),
        (
            "idx_history_channel_id",
            "CREATE INDEX IF NOT EXISTS idx_history_channel_id ON history_entries(channel_id)",
        ),
        (
            "idx_history_profile_id",
            "CREATE INDEX IF NOT EXISTS idx_history_profile_id ON history_entries(profile_id)",
        ),
        (
            "idx_history_started_at",
            "CREATE INDEX IF NOT EXISTS idx_history_started_at ON history_entries(started_at DESC)",
        ),
        (
            "idx_history_type_status",
            "CREATE INDEX IF NOT EXISTS idx_history_type_status ON history_entries(type, status)",
        ),
    ],
    "services": [
        (
            "idx_services_service_type",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type)",
        ),
    ],
}


async def create_indexes(session: AsyncSession) -> dict[str, int]:
    """
    Create all defined indexes.

    Args:
        session: Database session

    Returns:
        Dictionary with count of created indexes per table
    """
    results: dict[str, int] = {}

    for table, index_defs in INDEXES.items():
        created = 0
        for index_name, create_sql in index_defs:
            try:
                await session.execute(text(create_sql))
                logger.debug(f"Created index: {index_name}")
                created += 1
            except Exception as e:
                logger.warning(f"Failed to create index {index_name}: {e}")

        results[table] = created

    await session.commit()
    total = sum(results.values())
    logger.info(f"Created {total} database indexes")

    return results


async def drop_indexes(session: AsyncSession) -> int:
    """
    Drop all custom indexes.

    Args:
        session: Database session

    Returns:
        Number of dropped indexes
    """
    dropped = 0

    for _table, index_defs in INDEXES.items():
        for index_name, _ in index_defs:
            try:
                await session.execute(text(f"DROP INDEX IF EXISTS {index_name}"))
                logger.debug(f"Dropped index: {index_name}")
                dropped += 1
            except Exception as e:
                logger.warning(f"Failed to drop index {index_name}: {e}")

    await session.commit()
    logger.info(f"Dropped {dropped} database indexes")

    return dropped


async def analyze_tables(session: AsyncSession) -> None:
    """
    Run ANALYZE on all tables to update query planner statistics.

    Args:
        session: Database session
    """
    for table in INDEXES.keys():
        try:
            await session.execute(text(f"ANALYZE {table}"))
            logger.debug(f"Analyzed table: {table}")
        except Exception as e:
            logger.warning(f"Failed to analyze table {table}: {e}")

    await session.commit()
    logger.info("Database tables analyzed")


async def get_index_stats(session: AsyncSession) -> list[dict[str, str]]:
    """
    Get information about existing indexes.

    Args:
        session: Database session

    Returns:
        List of index information dictionaries
    """
    try:
        result = await session.execute(
            text("""
                SELECT name, tbl_name, sql
                FROM sqlite_master
                WHERE type = 'index' AND sql IS NOT NULL
                ORDER BY tbl_name, name
            """)
        )
        rows = result.fetchall()

        return [
            {
                "name": row[0],
                "table": row[1],
                "sql": row[2],
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Failed to get index stats: {e}")
        return []


async def vacuum_database(session: AsyncSession) -> None:
    """
    Run VACUUM to optimize database file.

    Note: VACUUM cannot run inside a transaction in SQLite.

    Args:
        session: Database session
    """
    try:
        # Need raw connection for VACUUM
        connection = await session.connection()
        raw_conn = await connection.get_raw_connection()

        # Execute VACUUM outside transaction
        await raw_conn.execute("VACUUM")

        logger.info("Database vacuumed successfully")
    except Exception as e:
        logger.warning(f"Failed to vacuum database: {e}")


def get_index_recommendations() -> list[dict[str, str]]:
    """
    Get index recommendations for common query patterns.

    Returns:
        List of recommendation dictionaries
    """
    return [
        {
            "table": "programs",
            "recommendation": "Composite index on (channel_id, start_time) for efficient schedule queries",
            "query_pattern": "SELECT * FROM programs WHERE channel_id = ? ORDER BY start_time",
        },
        {
            "table": "history_entries",
            "recommendation": "Composite index on (type, status) for filtered history queries",
            "query_pattern": "SELECT * FROM history_entries WHERE type = ? AND status = ?",
        },
        {
            "table": "scoring_results",
            "recommendation": "Index on total_score DESC for top-score queries",
            "query_pattern": "SELECT * FROM scoring_results ORDER BY total_score DESC LIMIT ?",
        },
        {
            "table": "contents",
            "recommendation": "Index on plex_key for content lookup",
            "query_pattern": "SELECT * FROM contents WHERE plex_key = ?",
        },
    ]
