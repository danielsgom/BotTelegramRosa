"""
Shared fixtures and test environment setup for the BotTelegramRosa backend.

Important: module-level code runs before any test import, so env vars and
sys.modules patches must be set here before the app is imported.
"""

import os
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

# ── 1. Add src/backend to sys.path so app modules are importable ─────────────
sys.path.insert(0, str(Path(__file__).parent.parent))

# ── 2. Set environment variables BEFORE importing any app module ─────────────
os.environ["ADMIN_TOKEN"] = "admin123"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["DATABASE_ECHO"] = "False"
os.environ["TELEGRAM_BOT_TOKEN"] = "test-bot-token"
os.environ["STRIPE_API_KEY"] = "sk_test_placeholder"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_placeholder"
os.environ["SERVER_URL"] = "http://localhost:8000"

# ── 3. Mock bot and scheduler modules BEFORE importing app modules ────────────
_mock_bot = MagicMock()
_mock_bot.start = AsyncMock(return_value=None)
_mock_bot.stop = AsyncMock(return_value=None)
_mock_bot.send_bulk_messages = AsyncMock(return_value={"sent": 0, "failed": 0})
_mock_bot.send_message = AsyncMock(return_value=None)

_bot_module = types.ModuleType("bot")
_bot_module.telegram_bot = _mock_bot
sys.modules["bot"] = _bot_module

_mock_scheduler = MagicMock()
_scheduler_module = types.ModuleType("scheduler")
_scheduler_module.message_scheduler = _mock_scheduler
sys.modules["scheduler"] = _scheduler_module

# ── 4. Clear lru_cache so settings pick up the env vars set above ─────────────
from config import get_settings  # noqa: E402

get_settings.cache_clear()

# ── 5. Import app dependencies ────────────────────────────────────────────────
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from database import Base, get_db  # noqa: E402

# ── 6. Create a test-only in-memory engine (StaticPool keeps a single DB) ─────
_TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestSession = sessionmaker(autocommit=False, autoflush=False, bind=_TEST_ENGINE)
Base.metadata.create_all(bind=_TEST_ENGINE)

# ── 7. Import the FastAPI app AFTER all patching is complete ──────────────────
from main import app  # noqa: E402


# Default get_db override (replaced per test by the `client` fixture)
def _default_test_db():
    db = _TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _default_test_db


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_db():
    """Drop and recreate all tables before each test to guarantee isolation."""
    Base.metadata.drop_all(bind=_TEST_ENGINE)
    Base.metadata.create_all(bind=_TEST_ENGINE)
    yield


@pytest.fixture
def test_db(reset_db):
    """Provide a database session for direct DB manipulation within tests."""
    db = _TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def auth_headers():
    """Authorization headers matching the test ADMIN_TOKEN."""
    return {"X-API-Token": "admin123"}


@pytest.fixture
def client(test_db):
    """
    FastAPI TestClient with get_db overridden to share the test session.

    Both route handlers and test code operate on the same SQLAlchemy session,
    so data written by either side is immediately visible to the other.
    """

    def _override():
        yield test_db

    app.dependency_overrides[get_db] = _override
    c = TestClient(app)
    yield c
    app.dependency_overrides[get_db] = _default_test_db
