"""Application configuration with environment variable loading."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "SmarTunarr"
    app_version: str = "0.1.0"
    debug: bool = False
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    # Database
    database_url: str = Field(
        default="sqlite+aiosqlite:///./smartunarr.db",
        description="SQLite database URL with async driver",
    )

    # Plex
    plex_url: str = Field(default="", description="Plex server URL")
    plex_token: str = Field(default="", description="Plex authentication token")

    # TMDB
    tmdb_api_key: str = Field(default="", description="TMDB API key")
    tmdb_rate_limit: int = Field(default=40, description="TMDB requests per 10 seconds")

    # Tunarr
    tunarr_url: str = Field(default="", description="Tunarr server URL")
    tunarr_username: str = Field(default="", description="Tunarr username")
    tunarr_password: str = Field(default="", description="Tunarr password")

    # Ollama
    ollama_url: str = Field(default="http://localhost:11434", description="Ollama server URL")
    ollama_default_model: str = Field(default="llama3.2", description="Default Ollama model")

    # Security
    secret_key: str = Field(
        default="change-me-in-production-use-openssl-rand-hex-32",
        description="Secret key for encryption",
    )

    # Server
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8080, description="Server port")

    @property
    def async_database_url(self) -> str:
        """Get async-compatible database URL."""
        if self.database_url.startswith("sqlite:///"):
            return self.database_url.replace("sqlite:///", "sqlite+aiosqlite:///")
        return self.database_url


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
