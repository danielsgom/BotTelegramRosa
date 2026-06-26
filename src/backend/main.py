"""
BotTelegramRosa — application entry point.

Responsibilities:
  - Configure logging (module-aware format)
  - Build FastAPI instance
  - Register all routers
  - Mount static / uploads directories
  - Startup / shutdown lifecycle
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import get_settings
from database import init_db, run_migrations
from logging_config import setup_logging

# ── Routers ──────────────────────────────────────────────────────────────────
from routes.health import router as health_router
from routes.messages import router as messages_router
from routes.stripe_links import router as stripe_links_router
from routes.batches import router as batches_router
from routes.users import router as users_router
from routes.scheduler_routes import router as scheduler_router
from routes.vip import router as vip_router
from routes.logs import router as logs_router
from routes.webhooks import router as webhooks_router
from routes.admin.users import router as admin_users_router
from routes.admin.assets import router as admin_assets_router
from routes.admin.stripe_links import router as admin_stripe_links_router
from routes.admin.quick_messages import router as admin_quick_messages_router
from routes.admin.message_blocks import router as admin_message_blocks_router

# ── Bot / Scheduler (singletons) ─────────────────────────────────────────────
from bot import telegram_bot
from scheduler import message_scheduler

# ── Logging must be configured before any module logs anything ───────────────
setup_logging()
logger = logging.getLogger(__name__)

settings = get_settings()

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database initialisation ──────────────────────────────────────────────────
init_db()

# ── Register routers ─────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(messages_router)
app.include_router(stripe_links_router)
app.include_router(batches_router)
app.include_router(users_router)
app.include_router(scheduler_router)
app.include_router(vip_router)
app.include_router(logs_router)
app.include_router(webhooks_router)
app.include_router(admin_users_router)
app.include_router(admin_assets_router)
app.include_router(admin_stripe_links_router)
app.include_router(admin_quick_messages_router)
app.include_router(admin_message_blocks_router)

# ── Static file mounts ────────────────────────────────────────────────────────
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_FRONTEND_STATIC = os.path.join(os.path.dirname(_BACKEND_DIR), "frontend", "static")

if os.path.exists(_FRONTEND_STATIC):
    app.mount("/static", StaticFiles(directory=_FRONTEND_STATIC), name="static")

if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


# ── Lifecycle ─────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    try:
        logger.info("Starting up application...")
        run_migrations()
        await telegram_bot.start()
        message_scheduler.initialize_schedule()
        message_scheduler.start()
        logger.info("Application started successfully")
    except Exception as e:
        logger.error(f"Error during startup: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    try:
        logger.info("Shutting down application...")
        message_scheduler.stop()
        await telegram_bot.stop()
        logger.info("Application stopped successfully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


# ── Dev runner ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
    )
