"""
Admin quick messages routes.
"""

import logging

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy.orm import Session

from database import QuickMessage, get_db
from dependencies import verify_api_token
from utils import datetime_to_iso_madrid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/quick-messages", tags=["admin-quick-messages"])


@router.get("")
async def get_quick_messages(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        messages = db.query(QuickMessage).order_by(QuickMessage.created_at.desc()).all()
        return {
            "success": True,
            "messages": [
                {
                    "id": m.id,
                    "name": m.name,
                    "text_es": m.text_es,
                    "text_en": m.text_en,
                    "text_pt": m.text_pt,
                    "created_at": datetime_to_iso_madrid(m.created_at),
                }
                for m in messages
            ],
        }
    except Exception as e:
        logger.error(f"Error getting quick messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_quick_message(
    name: str = Form(...),
    text_es: str = Form(...),
    text_en: str = Form(...),
    text_pt: str = Form(...),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        msg = QuickMessage(name=name, text_es=text_es, text_en=text_en, text_pt=text_pt)
        db.add(msg)
        db.commit()
        db.refresh(msg)
        logger.info(f"Quick message created: {msg.id}")
        return {"success": True, "message_id": msg.id}
    except Exception as e:
        logger.error(f"Error creating quick message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{msg_id}")
async def delete_quick_message(
    msg_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        msg = db.query(QuickMessage).filter(QuickMessage.id == msg_id).first()
        if not msg:
            raise HTTPException(status_code=404, detail="Not found")
        db.delete(msg)
        db.commit()
        logger.info(f"Quick message deleted: {msg_id}")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting quick message {msg_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
