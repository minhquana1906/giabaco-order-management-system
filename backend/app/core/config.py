"""Application settings loaded from environment."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")

    database_url: str
    session_secret: str
    admin_username: str
    admin_password_hash: str
    public_base_url: str = "http://127.0.0.1:8000"
    cookie_secure: bool = True
    admin_host: str | None = None
    spa_dir: str | None = None


@lru_cache
def get_settings() -> Settings:
    """Return cached settings."""
    return Settings()
