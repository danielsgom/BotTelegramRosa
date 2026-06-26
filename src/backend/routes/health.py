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

# Resolve frontend paths relative to this file's location
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(_BACKEND_DIR)), "frontend")
FRONTEND_INDEX = os.path.join(_FRONTEND_DIR, "index.html")


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
    if os.path.exists(FRONTEND_INDEX):
        return FileResponse(FRONTEND_INDEX)
    return JSONResponse({"message": "Frontend not found. API is running on /docs"})
