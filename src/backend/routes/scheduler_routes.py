"""
Scheduler status routes.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from dependencies import verify_api_token
from scheduler import message_scheduler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])


@router.get("/jobs")
async def get_scheduled_jobs(token: str = Depends(verify_api_token)):
    try:
        jobs = message_scheduler.get_scheduled_jobs()
        return {"success": True, "jobs": jobs}
    except Exception as e:
        logger.error(f"Error fetching scheduler jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))
