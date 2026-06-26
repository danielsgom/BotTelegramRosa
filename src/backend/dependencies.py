"""
Shared FastAPI dependencies for BotTelegramRosa.
Import from here instead of importing directly from database/config.
"""

import logging
from fastapi import HTTPException, Request, status

from config import get_settings
from database import get_db  # re-exported for convenience

__all__ = ["verify_api_token", "get_full_file_url", "get_db"]

logger = logging.getLogger(__name__)
settings = get_settings()


def verify_api_token(request: Request) -> str:
    """FastAPI dependency — validates the X-API-Token header."""
    token = request.headers.get(settings.API_TOKEN_HEADER)
    if not token or token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API token",
        )
    return token


def get_full_file_url(file_path: str) -> str:
    """Convert a relative file path to an absolute HTTP URL."""
    if not file_path:
        return file_path
    if file_path.startswith("http://") or file_path.startswith("https://"):
        return file_path
    if file_path.startswith("/"):
        return f"{settings.SERVER_URL}{file_path}"
    return f"{settings.SERVER_URL}/uploads/{file_path}"
