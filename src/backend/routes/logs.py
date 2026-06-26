"""
In-memory log viewer route.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from dependencies import verify_api_token
from logging_config import mem_handler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("")
async def get_logs(
    limit: int = 200,
    level: Optional[str] = None,
    token: str = Depends(verify_api_token),
):
    entries = mem_handler.get(limit)
    if level:
        entries = [e for e in entries if e["level"] == level.upper()]
    return {"success": True, "count": len(entries), "logs": entries}
