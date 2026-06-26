"""
Stripe payment links CRUD routes.
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy.orm import Session

from database import StripLink, get_db
from dependencies import verify_api_token
from utils import datetime_to_iso_madrid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stripe-links", tags=["stripe-links"])


@router.get("")
async def get_stripe_links(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        links = db.query(StripLink).all()
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
                    "name_translations": json.loads(link.name_translations) if link.name_translations else {},
                    "created_at": datetime_to_iso_madrid(link.created_at),
                }
                for link in links
            ],
        }
    except Exception as e:
        logger.error(f"Error getting stripe links: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_stripe_link(
    name: str = Form(...),
    url: str = Form(...),
    language: Optional[str] = Form(default=None),
    duration_days: int = Form(default=0),
    stripe_link_id: str = Form(default=""),
    name_es: str = Form(default=""),
    name_en: str = Form(default=""),
    name_pt: str = Form(default=""),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        existing = db.query(StripLink).filter(StripLink.name == name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Link name already exists")

        translations = {}
        if name_es:
            translations["es"] = name_es
        if name_en:
            translations["en"] = name_en
        if name_pt:
            translations["pt"] = name_pt

        link = StripLink(
            name=name,
            url=url,
            language=language or None,
            duration_days=duration_days,
            stripe_link_id=stripe_link_id.strip() or None,
            name_translations=json.dumps(translations) if translations else None,
        )
        db.add(link)
        db.commit()
        db.refresh(link)

        logger.info(f"Stripe link created: {link.id} ({name})")
        return {"success": True, "link_id": link.id, "name": link.name, "url": link.url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating stripe link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{link_id}")
async def update_stripe_link(
    link_id: int,
    name: str = Form(...),
    url: str = Form(...),
    language: Optional[str] = Form(default=None),
    duration_days: int = Form(default=0),
    stripe_link_id: str = Form(default=""),
    name_es: str = Form(default=""),
    name_en: str = Form(default=""),
    name_pt: str = Form(default=""),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        link = db.query(StripLink).filter(StripLink.id == link_id).first()
        if not link:
            raise HTTPException(status_code=404, detail="Link not found")

        translations = {}
        if name_es:
            translations["es"] = name_es
        if name_en:
            translations["en"] = name_en
        if name_pt:
            translations["pt"] = name_pt

        link.name = name
        link.url = url
        link.language = language or None
        link.duration_days = duration_days
        link.stripe_link_id = stripe_link_id.strip() or None
        link.name_translations = json.dumps(translations) if translations else None
        db.commit()
        db.refresh(link)

        logger.info(f"Stripe link updated: {link.id}")
        return {"success": True, "link_id": link.id, "name": link.name, "url": link.url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating stripe link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{link_id}")
async def delete_stripe_link(
    link_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        link = db.query(StripLink).filter(StripLink.id == link_id).first()
        if not link:
            raise HTTPException(status_code=404, detail="Link not found")

        db.delete(link)
        db.commit()

        logger.info(f"Stripe link deleted: {link_id}")
        return {"success": True, "message": "Link deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting stripe link: {e}")
        raise HTTPException(status_code=500, detail=str(e))
