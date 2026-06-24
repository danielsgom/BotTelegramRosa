"""
API Routes for BotTelegramRosa
Main FastAPI application setup
"""

from fastapi import FastAPI, Depends, HTTPException, status, Request, File, UploadFile, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import logging
import os
import json
from typing import List, Optional

from config import get_settings
from database import init_db, run_migrations, get_db, User, Message, MessageBatch, BatchScheduleState, MessageSent, Payment, StripLink, VipConfig
from bot import telegram_bot
from scheduler import message_scheduler
from stripe_handler import StripeHandler
from language import LanguageDetector, get_message_template
from utils import convert_to_madrid_time, datetime_to_iso_madrid

logger = logging.getLogger(__name__)
settings = get_settings()

# ── In-memory log buffer (last 500 entries, thread-safe via deque) ──────────
from collections import deque
import threading

class _MemHandler(logging.Handler):
    def __init__(self, maxlen=500):
        super().__init__()
        self._buf = deque(maxlen=maxlen)
        self._lock = threading.Lock()

    def emit(self, record):
        from datetime import datetime
        with self._lock:
            self._buf.appendleft({
                "ts":    datetime.fromtimestamp(record.created).strftime("%H:%M:%S"),
                "level": record.levelname,
                "name":  record.name,
                "msg":   record.getMessage(),
            })

    def get(self, limit=200):
        with self._lock:
            return list(self._buf)[:limit]

_mem_handler = _MemHandler()
_mem_handler.setLevel(logging.DEBUG)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logging.getLogger().addHandler(_mem_handler)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
init_db()


# ─── Utility Functions ───────────────────────────────────────────────────────
def verify_api_token(request: Request) -> str:
    """Verify API token"""
    token = request.headers.get(settings.API_TOKEN_HEADER)
    if not token or token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API token"
        )
    return token


# ─── Health Check ───────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat()
    }


# ─── Startup & Shutdown ───────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    """Initialize bot and scheduler on startup"""
    try:
        logger.info("Starting up application...")

        # Run DB migrations (safe, idempotent)
        run_migrations()

        # Start bot
        await telegram_bot.start()
        
        # Initialize batch schedule state
        message_scheduler.initialize_schedule()
        
        # Start batch message scheduler
        message_scheduler.start()
        
        logger.info("Application started successfully")
    except Exception as e:
        logger.error(f"Error during startup: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    try:
        logger.info("Shutting down application...")
        
        # Stop scheduler
        message_scheduler.stop()
        
        # Stop bot
        await telegram_bot.stop()
        
        logger.info("Application stopped successfully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


# ─── Messages API ───────────────────────────────────────────────────────────
@app.post("/api/messages")
async def create_message(
    title: str = Form(...),
    text: str = Form(...),
    hours_interval: int = Form(default=2),
    is_active: bool = Form(default=True),
    image: Optional[UploadFile] = File(None),
    stripe_links: str = Form(default="[]"),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Create a new message template"""
    try:
        # Handle image upload
        image_url = None
        if image:
            # Save image to uploads folder
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            filename = f"{datetime.utcnow().timestamp()}_{image.filename}"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)
            
            with open(filepath, "wb") as f:
                f.write(await image.read())
            
            image_url = f"/uploads/{filename}"

        # Parse stripe links
        try:
            links = json.loads(stripe_links)
        except json.JSONDecodeError:
            links = []

        # Create message
        message = Message(
            title=title,
            text=text,
            image_url=image_url,
            stripe_links=json.dumps(links),
            hours_interval=hours_interval,
            is_active=is_active
        )
        db.add(message)
        db.commit()
        db.refresh(message)

        logger.info(f"Message created: {message.id}")

        return {
            "success": True,
            "message_id": message.id,
            "title": message.title
        }

    except Exception as e:
        logger.error(f"Error creating message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/messages")
async def get_messages(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """Get all messages"""
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
                    "created_at": m.created_at.isoformat(),
                    "last_sent_at": m.last_sent_at.isoformat() if m.last_sent_at else None,
                    "image_url": m.image_url
                }
                for m in messages
            ]
        }

    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/messages/{message_id}")
async def get_message(
    message_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Get specific message"""
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
                "created_at": message.created_at.isoformat(),
                "last_sent_at": message.last_sent_at.isoformat() if message.last_sent_at else None
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/messages/{message_id}")
async def update_message(
    message_id: int,
    title: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    hours_interval: Optional[int] = Form(None),
    is_active: Optional[bool] = Form(None),
    stripe_links: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Update a message"""
    try:
        message = db.query(Message).filter(Message.id == message_id).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        # Update fields
        if title:
            message.title = title
        if text:
            message.text = text
        if hours_interval:
            message.hours_interval = hours_interval
        if is_active is not None:
            message.is_active = is_active
        
        # Handle image update
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

        # Reschedule if needed
        if hours_interval:
            message_scheduler.update_schedule(message_id, hours_interval)

        logger.info(f"Message {message_id} updated")

        return {
            "success": True,
            "message_id": message.id,
            "title": message.title
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/messages/{message_id}")
async def delete_message(
    message_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Delete a message"""
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


@app.post("/api/messages/{message_id}/send")
async def send_message_now(
    message_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Send a message immediately to all users"""
    try:
        message = db.query(Message).filter(Message.id == message_id).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        # Send
        stats = await telegram_bot.send_bulk_messages(message_id, db)

        logger.info(f"Message {message_id} sent to {stats['sent']} users")

        return {
            "success": True,
            "stats": stats
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Strip Links API ──────────────────────────────────────────────────────
# Global reusable payment links that can be assigned to multiple messages

@app.get("/api/stripe-links")
async def get_stripe_links(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Get all Stripe payment links"""
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
                    "created_at": link.created_at.isoformat() if link.created_at else None
                }
                for link in links
            ]
        }
    except Exception as e:
        logger.error(f"Error getting stripe links: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/stripe-links")
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
    db: Session = Depends(get_db)
):
    """Create a new Stripe payment link"""
    try:
        # Check if name already exists
        existing = db.query(StripLink).filter(StripLink.name == name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Link name already exists")

        translations = {}
        if name_es: translations["es"] = name_es
        if name_en: translations["en"] = name_en
        if name_pt: translations["pt"] = name_pt

        link = StripLink(
            name=name,
            url=url,
            language=language or None,
            duration_days=duration_days,
            stripe_link_id=stripe_link_id.strip() or None,
            name_translations=json.dumps(translations) if translations else None
        )
        db.add(link)
        db.commit()
        db.refresh(link)

        logger.info(f"Stripe link created: {link.id} ({name})")

        return {
            "success": True,
            "link_id": link.id,
            "name": link.name,
            "url": link.url
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating stripe link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/stripe-links/{link_id}")
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
    db: Session = Depends(get_db)
):
    """Update a Stripe payment link"""
    try:
        link = db.query(StripLink).filter(StripLink.id == link_id).first()
        if not link:
            raise HTTPException(status_code=404, detail="Link not found")

        translations = {}
        if name_es: translations["es"] = name_es
        if name_en: translations["en"] = name_en
        if name_pt: translations["pt"] = name_pt

        link.name = name
        link.url = url
        link.language = language or None
        link.duration_days = duration_days
        link.stripe_link_id = stripe_link_id.strip() or None
        link.name_translations = json.dumps(translations) if translations else None
        db.commit()
        db.refresh(link)

        logger.info(f"Stripe link updated: {link.id}")

        return {
            "success": True,
            "link_id": link.id,
            "name": link.name,
            "url": link.url
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating stripe link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/stripe-links/{link_id}")
async def delete_stripe_link(
    link_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Delete a Stripe payment link"""
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


# ─── Message Batches API ──────────────────────────────────────────────────
# Batches organize messages in sequences. Only one batch is active at a time.
# Messages in active batch are sent one every 2 hours, then rotation continues

@app.post("/api/batches")
async def create_batch(
    name: str = Form(...),
    description: str = Form(default=""),
    order: int = Form(default=1),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Create a new message batch"""
    try:
        # Check if name already exists
        existing = db.query(MessageBatch).filter(MessageBatch.name == name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Batch name already exists")

        batch = MessageBatch(
            name=name,
            description=description,
            order=order
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)

        logger.info(f"Batch created: {batch.id} ({name})")

        return {
            "success": True,
            "batch_id": batch.id,
            "name": batch.name,
            "order": batch.order
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/batches")
async def get_batches(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """Get all batches with their messages"""
    try:
        batches = db.query(MessageBatch).order_by(MessageBatch.order).offset(skip).limit(limit).all()
        
        result = []
        for batch in batches:
            messages = db.query(Message).filter(Message.batch_id == batch.id).order_by(Message.sequence_order).all()
            result.append({
                "id": batch.id,
                "name": batch.name,
                "description": batch.description,
                "order": batch.order,
                "is_active": batch.is_active,
                "message_count": len(messages),
                "created_at": batch.created_at.isoformat(),
                "messages": [
                    {
                        "id": msg.id,
                        "title": msg.title,
                        "text": msg.text[:100] + "..." if len(msg.text) > 100 else msg.text,
                        "sequence_order": msg.sequence_order,
                        "image_url": msg.image_url,
                        "strip_links": [
                            {
                                "id": link.id,
                                "name": link.name,
                                "url": link.url
                            }
                            for link in msg.strip_links
                        ]
                    }
                    for msg in messages
                ]
            })

        return {"success": True, "batches": result}

    except Exception as e:
        logger.error(f"Error getting batches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/batches/{batch_id}")
async def get_batch(
    batch_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Get a specific batch with all its messages"""
    try:
        batch = db.query(MessageBatch).filter(MessageBatch.id == batch_id).first()
        
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        messages = db.query(Message).filter(Message.batch_id == batch_id).order_by(Message.sequence_order).all()

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
                        "stripe_links": msg.stripe_links
                    }
                    for msg in messages
                ]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/batches/{batch_id}")
async def update_batch(
    batch_id: int,
    name: str = Form(default=None),
    description: str = Form(default=None),
    order: int = Form(default=None),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Update a batch"""
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


@app.delete("/api/batches/{batch_id}")
async def delete_batch(
    batch_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Delete a batch and all its messages"""
    try:
        batch = db.query(MessageBatch).filter(MessageBatch.id == batch_id).first()
        
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        # Delete all messages in batch
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


@app.post("/api/batches/{batch_id}/activate")
async def activate_batch(
    batch_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Activate a batch (deactivate all others)"""
    try:
        batch = db.query(MessageBatch).filter(MessageBatch.id == batch_id).first()
        
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        # Deactivate all batches
        db.query(MessageBatch).update({MessageBatch.is_active: False})
        
        # Activate this one
        batch.is_active = True
        batch.updated_at = datetime.utcnow()
        db.commit()

        # Initialize schedule state for this batch
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


@app.get("/api/batches/{batch_id}/messages")
async def get_batch_messages(
    batch_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Get all messages in a batch"""
    try:
        batch = db.query(MessageBatch).filter(MessageBatch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        messages = db.query(Message).filter(Message.batch_id == batch_id).order_by(Message.sequence_order).all()

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
                            "name_translations": json.loads(link.name_translations) if link.name_translations else {}
                        }
                        for link in msg.strip_links
                    ],
                    "sequence_order": msg.sequence_order,
                    "created_at": msg.created_at.isoformat() if msg.created_at else None
                }
                for msg in messages
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting batch messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/batches/{batch_id}/messages")
async def add_message_to_batch(
    batch_id: int,
    title: str = Form(...),
    text_es: str = Form(...),
    text_en: str = Form(default=""),
    text_pt: str = Form(default=""),
    sequence_order: int = Form(default=1),
    language: Optional[str] = Form(default=None),
    strip_link_ids: str = Form(default="[]"),  # JSON array of link IDs
    image: Optional[UploadFile] = File(None),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Add a message to a batch with selected Stripe links"""
    try:
        batch = db.query(MessageBatch).filter(MessageBatch.id == batch_id).first()
        
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        # Handle image upload
        image_url = None
        if image:
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            filename = f"{datetime.utcnow().timestamp()}_{image.filename}"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)
            
            with open(filepath, "wb") as f:
                f.write(await image.read())
            
            image_url = f"/uploads/{filename}"

        # Parse strip link IDs
        try:
            link_ids = json.loads(strip_link_ids)
        except json.JSONDecodeError:
            link_ids = []

        # Create message without stripe_links field
        translations = {"es": text_es}
        if text_en: translations["en"] = text_en
        if text_pt: translations["pt"] = text_pt

        message = Message(
            batch_id=batch_id,
            title=title,
            text=text_es,
            text_translations=json.dumps(translations),
            image_url=image_url,
            sequence_order=sequence_order,
            language=language or None
        )
        
        # Add selected links to message
        if link_ids:
            links = db.query(StripLink).filter(StripLink.id.in_(link_ids)).all()
            message.strip_links = links

        db.add(message)
        db.commit()
        db.refresh(message)

        logger.info(f"Message added to batch {batch_id}: {message.id}")

        return {
            "success": True,
            "message_id": message.id,
            "title": message.title
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding message to batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/batches/{batch_id}/messages/{message_id}")
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
    db: Session = Depends(get_db)
):
    """Update a message in a batch"""
    try:
        message = db.query(Message).filter(
            Message.id == message_id,
            Message.batch_id == batch_id
        ).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        if title:
            message.title = title
        if text_es:
            translations = {"es": text_es}
            if text_en: translations["en"] = text_en
            if text_pt: translations["pt"] = text_pt
            message.text = text_es
            message.text_translations = json.dumps(translations)
        if sequence_order:
            message.sequence_order = sequence_order
        if strip_link_ids is not None:
            try:
                link_ids = json.loads(strip_link_ids)
                links = db.query(StripLink).filter(StripLink.id.in_(link_ids)).all() if link_ids else []
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


@app.delete("/api/batches/{batch_id}/messages/{message_id}")
async def delete_message_from_batch(
    batch_id: int,
    message_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Delete a message from a batch"""
    try:
        message = db.query(Message).filter(
            Message.id == message_id,
            Message.batch_id == batch_id
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


@app.get("/api/batches/schedule/state")
async def get_schedule_state(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Get current batch scheduling state"""
    try:
        state = db.query(BatchScheduleState).first()
        
        if not state:
            return {"success": True, "state": None}

        batch = db.query(MessageBatch).filter(MessageBatch.id == state.current_batch_id).first()
        messages = db.query(Message).filter(Message.batch_id == state.current_batch_id).order_by(Message.sequence_order).all()
        
        current_msg = messages[state.current_message_index] if state.current_message_index < len(messages) else None

        return {
            "success": True,
            "state": {
                "current_batch": {
                    "id": batch.id,
                    "name": batch.name,
                    "total_messages": len(messages)
                },
                "current_message_index": state.current_message_index,
                "current_message": {
                    "id": current_msg.id,
                    "title": current_msg.title
                } if current_msg else None,
                "last_sent_at": state.last_sent_at.isoformat() if state.last_sent_at else None,
                "next_send_at": state.next_send_at.isoformat() if state.next_send_at else None
            }
        }

    except Exception as e:
        logger.error(f"Error getting schedule state: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Users API ───────────────────────────────────────────────────────────
@app.get("/api/users")
async def get_users(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """Get all users with full detail"""
    try:
        users = db.query(User).order_by(User.joined_at.desc()).offset(skip).limit(limit).all()

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
                "vip_expires_at": u.vip_expires_at.isoformat() if u.vip_expires_at else None,
                "vip_days_remaining": (
                    max(0, (u.vip_expires_at - datetime.utcnow()).days)
                    if u.is_vip and u.vip_expires_at else
                    (-1 if u.is_vip else 0)  # -1 = lifetime VIP
                ),
                "vip_message_sent_at": u.vip_message_sent_at.isoformat() if u.vip_message_sent_at else None,
                "current_batch_id": u.current_batch_id,
                "current_batch_name": batch_name,
                "current_message_step": u.current_message_step or 0,
                "messages_sent_count": messages_sent,
                "joined_at": u.joined_at.isoformat() if u.joined_at else None,
                "last_message_at": u.last_message_at.isoformat() if u.last_message_at else None,
            })

        return {"success": True, "count": len(result), "users": result}

    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/users/{user_id}/resume-sequence")
async def resume_user_sequence(
    user_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Manually resume message sequence for a VIP user (expire VIP, reset step)"""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.is_vip = False
        user.vip_expires_at = None
        user.current_batch_id = None
        user.current_message_step = 0
        db.commit()
        logger.info(f"[Admin] Sequence resumed for user {user.telegram_id}")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resuming sequence: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/users/{user_id}")
async def get_user(
    user_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Get specific user"""
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
                "vip_expires_at": user.vip_expires_at.isoformat() if user.vip_expires_at else None,
                "joined_at": user.joined_at.isoformat(),
                "last_message_at": user.last_message_at.isoformat(),
                "payments_count": len(payments)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/users/{user_id}/messages")
async def get_user_messages(
    user_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Get messages sent to a specific user with full content and links, with Madrid timezone"""
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

        result = []
        for record in sent_records:
            msg = db.query(Message).filter(Message.id == record.message_id).first()
            if not msg:
                continue
            links = [
                {"name": lnk.name, "url": lnk.url, "language": lnk.language}
                for lnk in msg.strip_links
            ]
            result.append({
                "sent_at": datetime_to_iso_madrid(record.sent_at),
                "status": record.status,
                "message_id": msg.id,
                "title": msg.title,
                "text": msg.text,
                "image_url": msg.image_url if msg.image_url and msg.image_url.strip() else None,
                "language": msg.language,
                "sequence_order": msg.sequence_order,
                "links": links,
            })

        return {"success": True, "user_id": user_id, "total": len(result), "messages": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    """Deactivate/delete a user"""
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


# ─── Scheduler API ───────────────────────────────────────────────────────
@app.get("/api/scheduler/jobs")
async def get_scheduled_jobs(
    token: str = Depends(verify_api_token)
):
    """Get all scheduled jobs"""
    try:
        jobs = message_scheduler.get_scheduled_jobs()
        
        return {
            "success": True,
            "jobs": jobs
        }

    except Exception as e:
        logger.error(f"Error fetching jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scheduler/jobs")
async def get_scheduler_jobs(
    token: str = Depends(verify_api_token)
):
    """Get scheduled jobs list"""
    try:
        jobs = message_scheduler.get_scheduled_jobs()
        return {"success": True, "jobs": jobs}
    except Exception as e:
        logger.error(f"Error getting scheduler jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── VIP Config ───────────────────────────────────────────────────────────

@app.get("/api/vip-config")
async def get_vip_config(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db)
):
    cfg = db.query(VipConfig).filter(VipConfig.id == 1).first()
    if not cfg:
        return {"success": True, "config": {
            "text_translations": {}, "button_text_translations": {},
            "image_url": None, "invite_url": ""
        }}
    return {"success": True, "config": {
        "text_translations": json.loads(cfg.text_translations) if cfg.text_translations else {},
        "button_text_translations": json.loads(cfg.button_text_translations) if cfg.button_text_translations else {},
        "image_url": cfg.image_url,
        "invite_url": cfg.invite_url or "",
    }}


@app.post("/api/vip-config")
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
    db: Session = Depends(get_db)
):
    try:
        cfg = db.query(VipConfig).filter(VipConfig.id == 1).first()
        if not cfg:
            cfg = VipConfig(id=1)
            db.add(cfg)

        texts = {}
        if text_es: texts["es"] = text_es
        if text_en: texts["en"] = text_en
        if text_pt: texts["pt"] = text_pt
        cfg.text_translations = json.dumps(texts)

        buttons = {}
        if button_es: buttons["es"] = button_es
        if button_en: buttons["en"] = button_en
        if button_pt: buttons["pt"] = button_pt
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
        logger.info("[VipConfig] Saved")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error saving VIP config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _send_vip_welcome(user: User, db) -> bool:
    """Send VIP welcome message to user based on VipConfig. Returns True if sent."""
    try:
        cfg = db.query(VipConfig).filter(VipConfig.id == 1).first()
        if not cfg:
            logger.warning("[VIP] No VipConfig found — skipping welcome message")
            return False

        texts = json.loads(cfg.text_translations) if cfg.text_translations else {}
        lang = user.language or "es"
        text = texts.get(lang) or texts.get("es") or ""
        if not text:
            logger.warning("[VIP] VipConfig has no text — skipping welcome message")
            return False

        buttons = None
        if cfg.invite_url:
            btn_texts = json.loads(cfg.button_text_translations) if cfg.button_text_translations else {}
            btn_label = btn_texts.get(lang) or btn_texts.get("es") or "Acceder al grupo VIP"
            buttons = [{"text": btn_label, "url": cfg.invite_url}]

        image_url = cfg.image_url
        # Resolve relative /uploads/ path to absolute file path
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
            logger.info(f"[VIP] Welcome message sent to {user.telegram_id}")
        return success
    except Exception as e:
        logger.error(f"[VIP] Error sending welcome message: {e}")
        return False


# ─── Stripe Webhook ───────────────────────────────────────────────────────
@app.get("/api/logs")
async def get_logs(
    limit: int = 200,
    level: Optional[str] = None,
    token: str = Depends(verify_api_token)
):
    """Return recent in-memory log entries"""
    entries = _mem_handler.get(limit)
    if level:
        entries = [e for e in entries if e["level"] == level.upper()]
    return {"success": True, "count": len(entries), "logs": entries}


@app.post(settings.STRIPE_WEBHOOK_PATH)
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Stripe webhooks"""
    try:
        payload = await request.body()
        sig_header = request.headers.get("stripe-signature")

        # Log raw headers and body for debugging
        relevant_headers = {
            k: v for k, v in request.headers.items()
            if k.lower() in ("stripe-signature", "content-type", "user-agent", "content-length")
        }
        logger.info(f"[Stripe] Incoming webhook — headers: {relevant_headers}")
        try:
            body_preview = payload.decode("utf-8")[:2000]
            logger.info(f"[Stripe] Raw body (first 2000 chars): {body_preview}")
        except Exception:
            pass

        event = StripeHandler.verify_webhook_signature(payload, sig_header)
        event_type = event["type"]
        logger.info(f"[Stripe] Webhook received: {event_type}")

        # checkout.session.completed fires when a Stripe Payment Link purchase completes
        if event_type == "checkout.session.completed":
            payment = StripeHandler.handle_payment_success(event, db)
            if payment:
                user = db.query(User).filter(User.id == payment.user_id).first()
                if user:
                    sent = await _send_vip_welcome(user, db)
                    payment.vip_link_sent = sent
                    db.commit()

        # Also keep support for direct payment_intent.succeeded (API-based payments)
        elif event_type == "payment_intent.succeeded":
            payment = StripeHandler.handle_payment_success(event, db)
            if payment:
                user = db.query(User).filter(User.id == payment.user_id).first()
                if user:
                    sent = await _send_vip_welcome(user, db)
                    payment.vip_link_sent = sent
                    db.commit()

        elif event_type == "payment_intent.payment_failed":
            payment_intent_id = event["data"]["object"]["id"]
            StripeHandler.mark_payment_failed(
                payment_intent_id,
                db,
                reason=event["data"]["object"].get("last_payment_error", {}).get("message")
            )

        return {"success": True}

    except ValueError as e:
        logger.error(f"Invalid webhook: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error handling webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Static Files & Frontend ───────────────────────────────────────────────
# Get the absolute path to the frontend directory
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BACKEND_DIR), "frontend")
FRONTEND_INDEX = os.path.join(FRONTEND_DIR, "index.html")
FRONTEND_STATIC = os.path.join(FRONTEND_DIR, "static")

@app.get("/")
async def index():
    """Serve frontend"""
    if os.path.exists(FRONTEND_INDEX):
        return FileResponse(FRONTEND_INDEX)
    else:
        return JSONResponse({"message": "Frontend not found. API is running on /docs"})


# Serve static files
if os.path.exists(FRONTEND_STATIC):
    app.mount("/static", StaticFiles(directory=FRONTEND_STATIC), name="static")

# Serve uploads
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD
    )
