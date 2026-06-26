"""
Health-check and frontend serving routes.
"""

import logging
import os
from datetime import datetime

from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["health"])

# Resolve frontend index.html — prefers FRONTEND_DIR env var (React build),
# falls back to the legacy Bootstrap frontend.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_LEGACY_INDEX = os.path.join(
    os.path.dirname(os.path.dirname(_BACKEND_DIR)), "frontend", "index.html"
)


def _resolve_index() -> str:
    """Return the path to index.html, respecting the FRONTEND_DIR env var."""
    frontend_dir = os.environ.get("FRONTEND_DIR", "")
    if frontend_dir:
        candidate = os.path.join(frontend_dir, "index.html")
        if os.path.exists(candidate):
            return candidate
    return _LEGACY_INDEX


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/")
async def index():
    index_path = _resolve_index()
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"message": "Frontend not found. API is running on /docs"})
