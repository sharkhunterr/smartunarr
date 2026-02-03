"""Main FastAPI application entrypoint."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

settings = get_settings()

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup and shutdown events."""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")

    # Import here to avoid circular imports
    from app.core.scheduler import get_scheduler_manager
    from app.db.database import init_db

    await init_db()
    logger.info("Database initialized")

    # Start scheduler
    scheduler = get_scheduler_manager()
    await scheduler.start()
    logger.info("Scheduler started")

    yield

    # Shutdown
    await scheduler.stop()
    logger.info("Scheduler stopped")
    logger.info(f"Shutting down {settings.app_name}")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Intelligent TV Channel Programming for Tunarr",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    from app.api.routes import (
        ai,
        channels,
        health,
        history,
        jobs,
        logs,
        profiles,
        programming,
        schedules,
        scoring,
        services,
    )

    app.include_router(health.router, tags=["Health"])
    app.include_router(programming.router, prefix="/api/v1", tags=["Programming"])
    app.include_router(scoring.router, prefix="/api/v1", tags=["Scoring"])
    app.include_router(schedules.router, prefix="/api/v1", tags=["Schedules"])
    app.include_router(profiles.router, prefix="/api/v1", tags=["Profiles"])
    app.include_router(channels.router, prefix="/api/v1", tags=["Channels"])
    app.include_router(services.router, prefix="/api/v1", tags=["Services"])
    app.include_router(history.router, prefix="/api/v1", tags=["History"])
    app.include_router(jobs.router, prefix="/api/v1", tags=["Jobs"])
    app.include_router(logs.router, prefix="/api/v1", tags=["Logs"])
    app.include_router(ai.router, prefix="/api/v1", tags=["AI"])

    return app


app = create_app()


def run() -> None:
    """Run the application with uvicorn."""
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    run()
