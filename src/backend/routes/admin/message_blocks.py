"""
Admin message blocks routes — CRUD and block delivery to users.
"""

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from bot import telegram_bot
from database import MessageBlock, MessageBlockStep, User, UserMessage, get_db
from dependencies import verify_api_token
from schemas import BlockStepInput, CreateBlockInput
from utils import datetime_to_iso_madrid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/message-blocks", tags=["admin-message-blocks"])


@router.get("")
async def get_message_blocks(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        blocks = db.query(MessageBlock).order_by(MessageBlock.created_at.desc()).all()
        return {
            "success": True,
            "blocks": [
                {
                    "id": b.id,
                    "name": b.name,
                    "description": b.description,
                    "category": b.category,
                    "created_at": datetime_to_iso_madrid(b.created_at),
                    "steps": [
                        {
                            "id": s.id,
                            "step_order": s.step_order,
                            "text_es": s.text_es,
                            "text_en": s.text_en,
                            "text_pt": s.text_pt,
                        }
                        for s in b.steps
                    ],
                }
                for b in blocks
            ],
        }
    except Exception as e:
        logger.error(f"Error getting message blocks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{block_id}")
async def get_message_block(
    block_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    block = db.query(MessageBlock).filter(MessageBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    return {
        "success": True,
        "block": {
            "id": block.id,
            "name": block.name,
            "description": block.description,
            "category": block.category,
            "created_at": datetime_to_iso_madrid(block.created_at),
            "steps": [
                {
                    "id": s.id,
                    "step_order": s.step_order,
                    "text_es": s.text_es,
                    "text_en": s.text_en,
                    "text_pt": s.text_pt,
                }
                for s in block.steps
            ],
        },
    }


@router.post("")
async def create_message_block(
    data: CreateBlockInput,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        if not data.name or not data.steps:
            raise HTTPException(status_code=400, detail="Name and steps required")

        block = MessageBlock(name=data.name, description=data.description, category=data.category)
        db.add(block)
        db.commit()
        db.refresh(block)

        for step_data in data.steps:
            step = MessageBlockStep(
                block_id=block.id,
                step_order=step_data.step_order,
                text_es=step_data.text_es,
                text_en=step_data.text_en,
                text_pt=step_data.text_pt,
            )
            db.add(step)
        db.commit()

        logger.info(f"Message block created: {block.id} with {len(data.steps)} steps")
        return {"success": True, "block_id": block.id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating message block: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{block_id}")
async def update_message_block(
    block_id: int,
    data: CreateBlockInput,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        block = db.query(MessageBlock).filter(MessageBlock.id == block_id).first()
        if not block:
            raise HTTPException(status_code=404, detail="Block not found")

        block.name = data.name
        block.description = data.description
        block.category = data.category

        for step in list(block.steps):
            db.delete(step)

        for step_data in data.steps:
            step = MessageBlockStep(
                block_id=block.id,
                step_order=step_data.step_order,
                text_es=step_data.text_es,
                text_en=step_data.text_en,
                text_pt=step_data.text_pt,
            )
            db.add(step)

        db.commit()
        db.refresh(block)

        logger.info(f"Message block {block_id} updated")
        return {"success": True, "block_id": block.id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating message block {block_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{block_id}")
async def delete_message_block(
    block_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        block = db.query(MessageBlock).filter(MessageBlock.id == block_id).first()
        if not block:
            raise HTTPException(status_code=404, detail="Block not found")

        db.delete(block)
        db.commit()

        logger.info(f"Message block {block_id} deleted")
        return {"success": True, "message": "Block deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting message block {block_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{block_id}/send/{user_id}")
async def send_message_block_to_user(
    block_id: int,
    user_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        block = db.query(MessageBlock).filter(MessageBlock.id == block_id).first()
        if not block:
            raise HTTPException(status_code=404, detail="Block not found")

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        steps = sorted(block.steps, key=lambda s: s.step_order)
        if not steps:
            raise HTTPException(status_code=400, detail="Block has no steps")

        user_lang = user.language or "es"
        if user_lang not in ("es", "en", "pt"):
            user_lang = "en"

        results = []
        for step in steps:
            text = getattr(step, f"text_{user_lang}", step.text_es)
            success = await telegram_bot.send_message_to_user(
                user_id=user.telegram_id,
                text=text,
                db=None,
                user_db_id=None,
                message_type="text",
            )
            if success:
                user_msg = UserMessage(
                    user_id=user.id,
                    content=text,
                    message_type="text",
                    sent_by="admin",
                    status="delivered",
                    delivered_at=datetime.utcnow(),
                )
                db.add(user_msg)
                db.commit()
            results.append({"step": step.step_order, "success": success})
            await asyncio.sleep(0.4)

        sent_count = sum(1 for r in results if r["success"])
        logger.info(f"Block {block_id} sent to user {user_id}: {sent_count}/{len(steps)} delivered")
        return {"success": True, "sent": sent_count, "total": len(steps), "results": results}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending block {block_id} to user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
