"""
Configuration module for BotTelegramRosa
Handles all configuration from environment variables
"""

from pydantic import BaseSettings
from typing import Optional
from functools import lru_cache
import os

# .env is in the project root (two levels up from src/backend/)
_ENV_FILE = os.path.join(os.path.dirname(__file__), "..", "..", ".env")


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Application
    APP_NAME: str = "BotTelegramRosa"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "your-secret-key-change-in-production"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = True

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_WEBHOOK_URL: Optional[str] = None
    TELEGRAM_WEBHOOK_PATH: str = "/webhook/telegram"

    # Stripe
    STRIPE_API_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_WEBHOOK_PATH: str = "/webhook/stripe"

    # Database
    DATABASE_URL: str = "sqlite:///./bot.db"
    DATABASE_ECHO: bool = False

    # Security
    API_TOKEN_HEADER: str = "X-API-Token"
    ADMIN_TOKEN: str = "admin-token-change-this"

    # Scheduling
    MESSAGE_SENDING_INTERVAL: float = 2.0  # hours (accepts decimals, e.g. 0.0167 ≈ 1 min)
    CHECK_SCHEDULE_EVERY: int = 60  # seconds

    # Server URLs
    SERVER_URL: str = "http://localhost:8000"  # URL base para archivos

    # VIP Channel
    VIP_CHANNEL_INVITE_LINK: str = "https://t.me/+"  # Will be configured

    # Language Detection
    DEFAULT_LANGUAGE: str = "es"

    # File Upload
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB

    # Pagination
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 100

    class Config:
        env_file = _ENV_FILE
        env_file_encoding = "utf-8"
        case_sensitive = True

    @property
    def SUPPORTED_LANGUAGES(self) -> list:
        """Supported languages for message translation"""
        return ["es", "en", "fr", "de", "it", "pt", "ru"]

    @property
    def ALLOWED_EXTENSIONS(self) -> list:
        """Allowed file extensions for uploads"""
        return ["jpg", "jpeg", "png", "gif", "webp"]

    @property
    def CORS_ORIGINS(self) -> list:
        """CORS allowed origins"""
        return ["*"]


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
