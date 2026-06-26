"""
Admin users routes — user list, chat history, manual messaging, mark-read.
"""

import json
import logging
import os
from datetime import datetime
from typing import Optional

import asyncio

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from bot import telegram_bot
from config import get_settings
from database import PredefinedAsset, StripLink, User, UserMessage, get_db
from dependencies import get_full_file_url, verify_api_token
from utils import datetime_to_iso_madrid

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


@router.get("")
async def get_users_for_messaging(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
):
    try:
        query = db.query(User).order_by(User.last_message_at.desc())

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (User.username.like(search_term))
                | (User.first_name.like(search_term))
                | (User.last_name.like(search_term))
            )

        total = query.count()
        users = query.offset(skip).limit(limit).all()

        result = []
        for u in users:
            unread_count = db.query(UserMessage).filter(
                UserMessage.user_id == u.id,
                UserMessage.sent_by == "user",
                UserMessage.is_read == False,
            ).count()

            last_user_msg = (
                db.query(UserMessage)
                .filter(UserMessage.user_id == u.id, UserMessage.sent_by == "user")
                .order_by(UserMessage.created_at.desc())
                .first()
            )

            last_message_preview = None
            if last_user_msg:
                preview = last_user_msg.content or f"[{last_user_msg.message_type.upper()}]"
                last_message_preview = preview[:50] + "..." if len(preview) > 50 else preview

            result.append({
                "id": u.id,
                "telegram_id": u.telegram_id,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "username": u.username,
                "language": u.language,
                "is_active": u.is_active,
                "is_vip": u.is_vip,
                "unread_count": unread_count,
                "last_message_preview": last_message_preview,
                "joined_at": datetime_to_iso_madrid(u.joined_at),
                "last_message_at": datetime_to_iso_madrid(u.last_message_at),
            })

        return {"success": True, "total": total, "users": result}
    except Exception as e:
        logger.error(f"Error getting users for messaging: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/chat/history")
async def get_user_chat_history(
    user_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
    limit: int = 50,
):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        messages = (
            db.query(UserMessage)
            .filter(UserMessage.user_id == user_id)
            .order_by(UserMessage.created_at.desc())
            .limit(limit)
            .all()
        )
        messages.reverse()

        return {
            "success": True,
            "user": {
                "id": user.id,
                "telegram_id": user.telegram_id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "username": user.username,
                "is_vip": user.is_vip,
            },
            "messages": [
                {
                    "id": m.id,
                    "content": m.content,
                    "type": m.message_type,
                    "sent_by": m.sent_by,
                    "attachment_url": m.attachment_url,
                    "status": m.status,
                    "is_read": m.is_read,
                    "created_at": datetime_to_iso_madrid(m.created_at),
                    "delivered_at": datetime_to_iso_madrid(m.delivered_at),
                }
                for m in messages
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat history for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{user_id}/chat/message")
async def send_manual_message(
    user_id: int,
    content: Optional[str] = Form(None),
    message_type: str = Form(default="text"),
    attachment: Optional[UploadFile] = File(None),
    attachment_url: Optional[str] = Form(None),
    predefined_asset_id: Optional[int] = Form(None),
    strip_link_ids: Optional[str] = Form(None),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # ── Multiple Stripe links ────────────────────────────────────────────
        if strip_link_ids:
            try:
                link_ids = [int(lid.strip()) for lid in strip_link_ids.split(",")]
                links = db.query(StripLink).filter(StripLink.id.in_(link_ids)).all()
                if not links:
                    raise HTTPException(status_code=404, detail="No links found")

                buttons = []
                links_text = []
                for link in links:
                    link_url = link.url
                    separator = "&" if "?" in link_url else "?"
                    link_url += f"{separator}client_reference_id={user.telegram_id}"
                    buttons.append({"text": link.name, "url": link_url})
                    links_text.append(link.name)

                msg_content = "Links: " + ", ".join(links_text)
                user_msg = UserMessage(
                    user_id=user_id,
                    content=msg_content,
                    message_type="link",
                    sent_by="admin",
                    attachment_url=links[0].url if links else None,
                    status="sent",
                )
                db.add(user_msg)
                db.flush()

                try:
                    success = await telegram_bot.send_message_to_user(
                        user.telegram_id,
                        text="💎 Links VIP:",
                        buttons=buttons,
                    )
                    if success:
                        user_msg.status = "delivered"
                        user_msg.delivered_at = datetime.utcnow()
                    else:
                        user_msg.status = "failed"
                except Exception as e:
                    logger.error(f"Failed to send links to user {user_id}: {e}")
                    user_msg.status = "failed"
                    user_msg.error_message = str(e)

                db.commit()
                logger.info(f"Sent {len(links)} payment link(s) to user {user_id}")
                return {"success": True, "message": f"Sent {len(links)} payment link(s)", "count": len(links)}
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid link IDs format")

        file_url = None

        # ── Predefined asset ─────────────────────────────────────────────────
        if predefined_asset_id:
            asset = db.query(PredefinedAsset).filter(PredefinedAsset.id == predefined_asset_id).first()
            if not asset:
                raise HTTPException(status_code=404, detail="Asset not found")
            content = asset.name if not content else content
            message_type = asset.asset_type
            file_url = asset.file_url or asset.link_url

        # ── File upload ──────────────────────────────────────────────────────
        elif attachment:
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            filename = f"{datetime.utcnow().timestamp()}_{attachment.filename}"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(await attachment.read())
            file_url = f"/uploads/{filename}"

        elif attachment_url:
            file_url = attachment_url

        user_msg = UserMessage(
            user_id=user_id,
            content=content,
            message_type=message_type,
            sent_by="admin",
            attachment_url=file_url,
            status="sent",
        )
        db.add(user_msg)
        db.commit()
        db.refresh(user_msg)

        try:
            send_url = file_url
            if file_url and not file_url.startswith("/uploads/"):
                send_url = get_full_file_url(file_url)

            telegram_msg_id = await telegram_bot.send_manual_message(
                user.telegram_id,
                content=content,
                message_type=message_type,
                attachment_url=send_url,
            )

            if telegram_msg_id:
                user_msg.telegram_message_id = telegram_msg_id
                user_msg.status = "delivered"
                user_msg.delivered_at = datetime.utcnow()
                db.commit()
        except Exception as e:
            logger.error(f"Failed to send Telegram message to user {user_id}: {e}")
            user_msg.status = "failed"
            user_msg.error_message = str(e)
            db.commit()

        logger.info(f"Manual message sent to user {user_id}")
        return {"success": True, "message_id": user_msg.id, "status": user_msg.status}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending manual message to user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{user_id}/chat/mark-read")
async def mark_messages_as_read(
    user_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        unread_messages = db.query(UserMessage).filter(
            UserMessage.user_id == user_id,
            UserMessage.sent_by == "user",
            UserMessage.is_read == False,
        ).all()

        for msg in unread_messages:
            msg.is_read = True
            msg.read_at = datetime.utcnow()

        db.commit()
        return {"success": True, "messages_marked_read": len(unread_messages)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking messages as read for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
