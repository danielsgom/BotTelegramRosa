"""
Messages API routes — standalone (non-batch) messages.
"""

import json
import logging
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from config import get_settings
from database import Message, get_db
from dependencies import verify_api_token
from bot import telegram_bot
from scheduler import message_scheduler
from utils import datetime_to_iso_madrid

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.post("")
async def create_message(
    title: str = Form(...),
    text: str = Form(...),
    hours_interval: int = Form(default=2),
    is_active: bool = Form(default=True),
    image: Optional[UploadFile] = File(None),
    stripe_links: str = Form(default="[]"),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        image_url = None
        if image:
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            filename = f"{datetime.utcnow().timestamp()}_{image.filename}"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(await image.read())
            image_url = f"/uploads/{filename}"

        try:
            links = json.loads(stripe_links)
        except json.JSONDecodeError:
            links = []

        message = Message(
            title=title,
            text=text,
            image_url=image_url,
            stripe_links=json.dumps(links),
            hours_interval=hours_interval,
            is_active=is_active,
        )
        db.add(message)
        db.commit()
        db.refresh(message)

        logger.info(f"Message created: {message.id}")
        return {"success": True, "message_id": message.id, "title": message.title}

    except Exception as e:
        logger.error(f"Error creating message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_messages(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
):
    try:
        messages = db.query(Message).offset(skip).limit(limit).all()
        return {
            "success": True,
            "count": len(messages),
            "messages": [
                {
                    "id": m.id,
                    "title": m.title,
                    "text": m.text[:100] + "..." if len(m.text) > 100 else m.text,
                    "is_active": m.is_active,
                    "hours_interval": m.hours_interval,
                    "created_at": datetime_to_iso_madrid(m.created_at),
                    "last_sent_at": datetime_to_iso_madrid(m.last_sent_at),
                    "image_url": m.image_url,
                }
                for m in messages
            ],
        }
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{message_id}")
async def get_message(
    message_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        return {
            "success": True,
            "message": {
                "id": message.id,
                "title": message.title,
                "text": message.text,
                "image_url": message.image_url,
                "stripe_links": json.loads(message.stripe_links),
                "hours_interval": message.hours_interval,
                "is_active": message.is_active,
                "created_at": datetime_to_iso_madrid(message.created_at),
                "last_sent_at": datetime_to_iso_madrid(message.last_sent_at),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{message_id}")
async def update_message(
    message_id: int,
    title: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    hours_interval: Optional[int] = Form(None),
    is_active: Optional[bool] = Form(None),
    stripe_links: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        if title:
            message.title = title
        if text:
            message.text = text
        if hours_interval:
            message.hours_interval = hours_interval
        if is_active is not None:
            message.is_active = is_active

        if image:
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            filename = f"{datetime.utcnow().timestamp()}_{image.filename}"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(await image.read())
            message.image_url = f"/uploads/{filename}"

        if stripe_links:
            try:
                links = json.loads(stripe_links)
                message.stripe_links = json.dumps(links)
            except json.JSONDecodeError:
                pass

        message.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(message)

        if hours_interval:
            message_scheduler.update_schedule(message_id, hours_interval)

        logger.info(f"Message {message_id} updated")
        return {"success": True, "message_id": message.id, "title": message.title}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{message_id}")
async def delete_message(
    message_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        db.delete(message)
        db.commit()

        logger.info(f"Message {message_id} deleted")
        return {"success": True, "message": "Message deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{message_id}/send")
async def send_message_now(
    message_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        stats = await telegram_bot.send_bulk_messages(message_id, db)
        logger.info(f"Message {message_id} sent to {stats['sent']} users")
        return {"success": True, "stats": stats}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))
