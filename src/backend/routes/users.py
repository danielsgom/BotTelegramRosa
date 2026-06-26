"""
Users API routes.
"""

import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import Message, MessageBatch, MessageSent, Payment, User, get_db
from dependencies import verify_api_token
from utils import datetime_to_iso_madrid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
async def get_users(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
):
    try:
        q = db.query(User)
        if status == "error":
            q = q.filter(User.send_error != None)  # noqa: E711
        elif status == "active":
            q = q.filter(User.is_active == True, User.send_error == None)  # noqa: E711,E712
        users = q.order_by(User.joined_at.desc()).offset(skip).limit(limit).all()

        result = []
        for u in users:
            messages_sent = db.query(MessageSent).filter(MessageSent.user_id == u.id).count()
            batch_name = None
            if u.current_batch_id:
                batch = db.query(MessageBatch).filter(MessageBatch.id == u.current_batch_id).first()
                batch_name = batch.name if batch else None

            result.append({
                "id": u.id,
                "telegram_id": u.telegram_id,
                "first_name": u.first_name or "",
                "last_name": u.last_name or "",
                "username": u.username or "",
                "language": u.language or "es",
                "is_active": u.is_active,
                "is_vip": u.is_vip,
                "vip_expires_at": datetime_to_iso_madrid(u.vip_expires_at),
                "vip_days_remaining": (
                    max(0, (u.vip_expires_at - datetime.utcnow()).days)
                    if u.is_vip and u.vip_expires_at
                    else (-1 if u.is_vip else 0)
                ),
                "vip_message_sent_at": datetime_to_iso_madrid(u.vip_message_sent_at),
                "current_batch_id": u.current_batch_id,
                "current_batch_name": batch_name,
                "current_message_step": u.current_message_step or 0,
                "messages_sent_count": messages_sent,
                "joined_at": datetime_to_iso_madrid(u.joined_at),
                "last_message_at": datetime_to_iso_madrid(u.last_message_at),
                "send_error": u.send_error,
                "send_error_at": datetime_to_iso_madrid(u.send_error_at),
            })

        return {"success": True, "count": len(result), "users": result}

    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{user_id}/resume-sequence")
async def resume_user_sequence(
    user_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.is_vip = False
        user.vip_expires_at = None
        user.current_batch_id = None
        user.current_message_step = 0
        db.commit()
        logger.info(f"Sequence resumed for user {user.telegram_id}")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resuming sequence: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
async def get_user(
    user_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        payments = db.query(Payment).filter(Payment.user_id == user_id).all()

        return {
            "success": True,
            "user": {
                "id": user.id,
                "telegram_id": user.telegram_id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "username": user.username,
                "language": user.language,
                "is_active": user.is_active,
                "is_vip": user.is_vip,
                "vip_expires_at": datetime_to_iso_madrid(user.vip_expires_at),
                "joined_at": datetime_to_iso_madrid(user.joined_at),
                "last_message_at": datetime_to_iso_madrid(user.last_message_at),
                "payments_count": len(payments),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/messages")
async def get_user_messages(
    user_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        sent_records = (
            db.query(MessageSent)
            .filter(MessageSent.user_id == user_id)
            .order_by(MessageSent.sent_at.desc())
            .limit(50)
            .all()
        )

        user_lang = user.language or "es"
        result = []
        for record in sent_records:
            msg = db.query(Message).filter(Message.id == record.message_id).first()
            if not msg:
                continue

            text_out = msg.text
            if msg.text_translations:
                try:
                    trans = json.loads(msg.text_translations)
                    text_out = trans.get(user_lang) or trans.get("es") or msg.text
                except Exception:
                    pass

            links = []
            for lnk in msg.strip_links:
                link_name = lnk.name
                if lnk.name_translations:
                    try:
                        name_trans = json.loads(lnk.name_translations)
                        link_name = name_trans.get(user_lang) or name_trans.get("es") or lnk.name
                    except Exception:
                        pass
                links.append({"name": link_name, "url": lnk.url, "language": lnk.language})

            result.append({
                "sent_at": datetime_to_iso_madrid(record.sent_at),
                "status": record.status,
                "message_id": msg.id,
                "title": msg.title,
                "text": text_out,
                "image_url": msg.image_url if msg.image_url and msg.image_url.strip() else None,
                "language": user_lang,
                "sequence_order": msg.sequence_order,
                "links": links,
            })

        return {"success": True, "user_id": user_id, "total": len(result), "messages": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}")
async def update_user(
    user_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    username: Optional[str] = None,
    language: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_vip: Optional[bool] = None,
    clear_error: Optional[bool] = None,
):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        if username is not None:
            user.username = username or None
        if language is not None:
            user.language = language
        if is_active is not None:
            user.is_active = is_active
        if is_vip is not None:
            user.is_vip = is_vip
        if clear_error:
            user.send_error = None
            user.send_error_at = None
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.is_active = False
        db.commit()

        logger.info(f"User {user_id} deactivated")
        return {"success": True, "message": "User deactivated"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail=str(e))
