"""
Message Batches API routes.
Includes batch CRUD, message management within batches, activation, and schedule state.
"""

import json
import logging
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from config import get_settings
from database import BatchScheduleState, Message, MessageBatch, StripLink, User, get_db
from dependencies import verify_api_token
from utils import datetime_to_iso_madrid

from scheduler import message_scheduler

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/batches", tags=["batches"])


# ── NOTE: /schedule/state must be declared BEFORE /{batch_id} to avoid
#    FastAPI treating "schedule" as a path parameter. ─────────────────────────

@router.get("/schedule/state")
async def get_schedule_state(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        state = db.query(BatchScheduleState).first()
        if not state:
            return {"success": True, "state": None}

        batch = db.query(MessageBatch).filter(MessageBatch.id == state.current_batch_id).first()
        messages = (
            db.query(Message)
            .filter(Message.batch_id == state.current_batch_id)
            .order_by(Message.sequence_order)
            .all()
        )

        current_msg = (
            messages[state.current_message_index]
            if state.current_message_index < len(messages)
            else None
        )

        active_users = db.query(User).filter(
            User.is_active == True,
            (User.is_vip == False)
            | ((User.is_vip == True) & (User.vip_expires_at < datetime.utcnow())),
        ).count()

        return {
            "success": True,
            "state": {
                "current_batch": {
                    "id": batch.id,
                    "name": batch.name,
                    "total_messages": len(messages),
                },
                "current_message_index": state.current_message_index,
                "current_message": (
                    {"id": current_msg.id, "title": current_msg.title} if current_msg else None
                ),
                "last_sent_at": datetime_to_iso_madrid(state.last_sent_at),
                "next_send_at": datetime_to_iso_madrid(state.next_send_at),
                "hours_interval": float(settings.MESSAGE_SENDING_INTERVAL),
                "active_users": active_users,
            },
        }
    except Exception as e:
        logger.error(f"Error getting schedule state: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_batch(
    name: str = Form(...),
    description: str = Form(default=""),
    order: int = Form(default=1),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        existing = db.query(MessageBatch).filter(MessageBatch.name == name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Batch name already exists")

        batch = MessageBatch(name=name, description=description, order=order)
        db.add(batch)
        db.commit()
        db.refresh(batch)

        logger.info(f"Batch created: {batch.id} ({name})")
        return {"success": True, "batch_id": batch.id, "name": batch.name, "order": batch.order}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_batches(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
):
    try:
        batches = (
            db.query(MessageBatch).order_by(MessageBatch.order).offset(skip).limit(limit).all()
        )

        result = []
        for batch in batches:
            messages = (
                db.query(Message)
                .filter(Message.batch_id == batch.id)
                .order_by(Message.sequence_order)
                .all()
            )
            result.append({
                "id": batch.id,
                "name": batch.name,
                "description": batch.description,
                "order": batch.order,
                "is_active": batch.is_active,
                "message_count": len(messages),
                "created_at": datetime_to_iso_madrid(batch.created_at),
                "messages": [
                    {
                        "id": msg.id,
                        "title": msg.title,
                        "text": msg.text[:100] + "..." if len(msg.text) > 100 else msg.text,
                        "sequence_order": msg.sequence_order,
                        "image_url": msg.image_url,
                        "strip_links": [
                            {"id": link.id, "name": link.name, "url": link.url}
                            for link in msg.strip_links
                        ],
                    }
                    for msg in messages
                ],
            })

        return {"success": True, "batches": result}

    except Exception as e:
        logger.error(f"Error getting batches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{batch_id}")
async def get_batch(
    batch_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        batch = db.query(MessageBatch).filter(MessageBatch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        messages = (
            db.query(Message)
            .filter(Message.batch_id == batch_id)
            .order_by(Message.sequence_order)
            .all()
        )

        return {
            "success": True,
            "batch": {
                "id": batch.id,
                "name": batch.name,
                "description": batch.description,
                "order": batch.order,
                "is_active": batch.is_active,
                "messages": [
                    {
                        "id": msg.id,
                        "title": msg.title,
                        "text": msg.text,
                        "sequence_order": msg.sequence_order,
                        "image_url": msg.image_url,
                        "stripe_links": msg.stripe_links,
                    }
                    for msg in messages
                ],
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{batch_id}")
async def update_batch(
    batch_id: int,
    name: str = Form(default=None),
    description: str = Form(default=None),
    order: int = Form(default=None),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        batch = db.query(MessageBatch).filter(MessageBatch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        if name:
            batch.name = name
        if description is not None:
            batch.description = description
        if order:
            batch.order = order

        batch.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(batch)

        logger.info(f"Batch {batch_id} updated")
        return {"success": True, "batch": {"id": batch.id, "name": batch.name}}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{batch_id}")
async def delete_batch(
    batch_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        batch = db.query(MessageBatch).filter(MessageBatch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        db.query(Message).filter(Message.batch_id == batch_id).delete()
        db.delete(batch)
        db.commit()

        logger.info(f"Batch {batch_id} deleted")
        return {"success": True, "message": "Batch deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{batch_id}/activate")
async def activate_batch(
    batch_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        batch = db.query(MessageBatch).filter(MessageBatch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        db.query(MessageBatch).update({MessageBatch.is_active: False})
        batch.is_active = True
        batch.updated_at = datetime.utcnow()
        db.commit()

        state = db.query(BatchScheduleState).first()
        if not state:
            state = BatchScheduleState(current_batch_id=batch_id, current_message_index=0)
            db.add(state)
        else:
            state.current_batch_id = batch_id
            state.current_message_index = 0
        db.commit()

        logger.info(f"Batch {batch_id} activated")
        return {"success": True, "message": f"Batch {batch.name} is now active"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{batch_id}/messages")
async def get_batch_messages(
    batch_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        batch = db.query(MessageBatch).filter(MessageBatch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        messages = (
            db.query(Message)
            .filter(Message.batch_id == batch_id)
            .order_by(Message.sequence_order)
            .all()
        )

        return {
            "success": True,
            "batch_id": batch_id,
            "messages": [
                {
                    "id": msg.id,
                    "batch_id": msg.batch_id,
                    "title": msg.title,
                    "text": msg.text,
                    "text_translations": json.loads(msg.text_translations) if msg.text_translations else {},
                    "image_url": msg.image_url,
                    "strip_links": [
                        {
                            "id": link.id,
                            "name": link.name,
                            "url": link.url,
                            "name_translations": json.loads(link.name_translations) if link.name_translations else {},
                        }
                        for link in msg.strip_links
                    ],
                    "sequence_order": msg.sequence_order,
                    "created_at": datetime_to_iso_madrid(msg.created_at),
                }
                for msg in messages
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting batch messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{batch_id}/messages")
async def add_message_to_batch(
    batch_id: int,
    title: str = Form(...),
    text_es: str = Form(...),
    text_en: str = Form(default=""),
    text_pt: str = Form(default=""),
    sequence_order: int = Form(default=1),
    language: Optional[str] = Form(default=None),
    strip_link_ids: str = Form(default="[]"),
    image: Optional[UploadFile] = File(None),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        batch = db.query(MessageBatch).filter(MessageBatch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        image_url = None
        if image:
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            filename = f"{datetime.utcnow().timestamp()}_{image.filename}"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(await image.read())
            image_url = f"/uploads/{filename}"

        try:
            link_ids = json.loads(strip_link_ids)
        except json.JSONDecodeError:
            link_ids = []

        translations = {"es": text_es}
        if text_en:
            translations["en"] = text_en
        if text_pt:
            translations["pt"] = text_pt

        message = Message(
            batch_id=batch_id,
            title=title,
            text=text_es,
            text_translations=json.dumps(translations),
            image_url=image_url,
            sequence_order=sequence_order,
            language=language or None,
        )

        if link_ids:
            links = db.query(StripLink).filter(StripLink.id.in_(link_ids)).all()
            message.strip_links = links

        db.add(message)
        db.commit()
        db.refresh(message)

        logger.info(f"Message added to batch {batch_id}: {message.id}")
        return {"success": True, "message_id": message.id, "title": message.title}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding message to batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{batch_id}/messages/{message_id}")
async def update_message_in_batch(
    batch_id: int,
    message_id: int,
    title: str = Form(default=None),
    text_es: str = Form(default=None),
    text_en: str = Form(default=""),
    text_pt: str = Form(default=""),
    sequence_order: int = Form(default=None),
    strip_link_ids: str = Form(default=None),
    image: Optional[UploadFile] = File(None),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        message = db.query(Message).filter(
            Message.id == message_id, Message.batch_id == batch_id
        ).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        if title:
            message.title = title
        if text_es:
            translations = {"es": text_es}
            if text_en:
                translations["en"] = text_en
            if text_pt:
                translations["pt"] = text_pt
            message.text = text_es
            message.text_translations = json.dumps(translations)
        if sequence_order:
            message.sequence_order = sequence_order
        if strip_link_ids is not None:
            try:
                link_ids = json.loads(strip_link_ids)
                links = (
                    db.query(StripLink).filter(StripLink.id.in_(link_ids)).all()
                    if link_ids
                    else []
                )
                message.strip_links = links
            except json.JSONDecodeError:
                pass
        if image:
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            filename = f"{datetime.utcnow().timestamp()}_{image.filename}"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(await image.read())
            message.image_url = f"/uploads/{filename}"

        message.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(message)

        logger.info(f"Message {message_id} updated in batch {batch_id}")
        return {"success": True, "message": {"id": message.id, "title": message.title}}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{batch_id}/messages/{message_id}")
async def delete_message_from_batch(
    batch_id: int,
    message_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        message = db.query(Message).filter(
            Message.id == message_id, Message.batch_id == batch_id
        ).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        db.delete(message)
        db.commit()

        logger.info(f"Message {message_id} deleted from batch {batch_id}")
        return {"success": True, "message": "Message deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Manual send endpoint ────────────────────────────────────────────────────

@router.post("/send-next")
async def send_next_batch_message_manual(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    """Manually trigger sending the next batch message to all active non-VIP users."""
    try:
        await message_scheduler.send_next_batch_message_manual()
        return {"success": True, "message": "Batch message send triggered manually"}
    except Exception as e:
        logger.error(f"Error in manual batch send: {e}")
        raise HTTPException(status_code=500, detail=str(e))
