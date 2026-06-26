"""
VIP configuration routes and shared VIP welcome helper.
"""

import json
import logging
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from bot import telegram_bot
from config import get_settings
from database import User, VipConfig, get_db
from dependencies import verify_api_token

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/vip-config", tags=["vip"])


@router.get("")
async def get_vip_config(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    cfg = db.query(VipConfig).filter(VipConfig.id == 1).first()
    if not cfg:
        return {
            "success": True,
            "config": {
                "text_translations": {},
                "button_text_translations": {},
                "image_url": None,
                "invite_url": "",
            },
        }
    return {
        "success": True,
        "config": {
            "text_translations": json.loads(cfg.text_translations) if cfg.text_translations else {},
            "button_text_translations": json.loads(cfg.button_text_translations) if cfg.button_text_translations else {},
            "image_url": cfg.image_url,
            "invite_url": cfg.invite_url or "",
        },
    }


@router.post("")
async def save_vip_config(
    text_es: str = Form(default=""),
    text_en: str = Form(default=""),
    text_pt: str = Form(default=""),
    button_es: str = Form(default=""),
    button_en: str = Form(default=""),
    button_pt: str = Form(default=""),
    invite_url: str = Form(default=""),
    image: Optional[UploadFile] = File(default=None),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        cfg = db.query(VipConfig).filter(VipConfig.id == 1).first()
        if not cfg:
            cfg = VipConfig(id=1)
            db.add(cfg)

        texts = {}
        if text_es:
            texts["es"] = text_es
        if text_en:
            texts["en"] = text_en
        if text_pt:
            texts["pt"] = text_pt
        cfg.text_translations = json.dumps(texts)

        buttons = {}
        if button_es:
            buttons["es"] = button_es
        if button_en:
            buttons["en"] = button_en
        if button_pt:
            buttons["pt"] = button_pt
        cfg.button_text_translations = json.dumps(buttons)

        cfg.invite_url = invite_url.strip() or None

        if image and image.filename:
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            filename = f"vip_{datetime.utcnow().timestamp()}_{image.filename}"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(await image.read())
            cfg.image_url = f"/uploads/{filename}"

        db.commit()
        logger.info("VIP config saved")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error saving VIP config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Shared helper (imported by webhooks.py) ────────────────────────────────

async def send_vip_welcome(user: User, db) -> bool:
    """Send the VIP welcome message to a user based on VipConfig. Returns True if sent."""
    try:
        cfg = db.query(VipConfig).filter(VipConfig.id == 1).first()
        if not cfg:
            logger.warning("No VipConfig found — skipping VIP welcome message")
            return False

        texts = json.loads(cfg.text_translations) if cfg.text_translations else {}
        lang = user.language or "es"
        text = texts.get(lang) or texts.get("es") or ""
        if not text:
            logger.warning("VipConfig has no text — skipping VIP welcome message")
            return False

        buttons = None
        if cfg.invite_url:
            btn_texts = json.loads(cfg.button_text_translations) if cfg.button_text_translations else {}
            btn_label = btn_texts.get(lang) or btn_texts.get("es") or "Acceder al grupo VIP"
            buttons = [{"text": btn_label, "url": cfg.invite_url}]

        image_url = cfg.image_url
        if image_url and image_url.startswith("/uploads/"):
            image_url = os.path.join(settings.UPLOAD_DIR, os.path.basename(image_url))

        success = await telegram_bot.send_message_to_user(
            user_id=user.telegram_id,
            text=text,
            image_url=image_url,
            buttons=buttons,
        )
        if success:
            user.vip_message_sent_at = datetime.utcnow()
            logger.info(f"VIP welcome message sent to {user.telegram_id}")
        return success
    except Exception as e:
        logger.error(f"Error sending VIP welcome message: {e}")
        return False
