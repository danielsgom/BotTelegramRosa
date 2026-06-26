"""
Admin Stripe links read-only route (used by admin panel).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import StripLink, get_db
from dependencies import verify_api_token
from utils import datetime_to_iso_madrid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/stripe-links", tags=["admin-stripe-links"])


@router.get("")
async def get_admin_stripe_links(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        links = db.query(StripLink).order_by(StripLink.created_at.desc()).all()
        return {
            "success": True,
            "links": [
                {
                    "id": link.id,
                    "name": link.name,
                    "url": link.url,
                    "language": link.language,
                    "duration_days": link.duration_days or 0,
                    "stripe_link_id": link.stripe_link_id or "",
                    "created_at": datetime_to_iso_madrid(link.created_at),
                }
                for link in links
            ],
        }
    except Exception as e:
        logger.error(f"Error getting admin stripe links: {e}")
        raise HTTPException(status_code=500, detail=str(e))
