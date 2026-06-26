"""
Database module for BotTelegramRosa
Defines all database models and connection
"""

from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, Float, ForeignKey, Table, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)
from config import get_settings

settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=settings.DATABASE_ECHO
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(Integer, unique=True, index=True, nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    username = Column(String(100), unique=True, index=True, nullable=True)
    language = Column(String(10), default="es")
    is_active = Column(Boolean, default=True)
    is_vip = Column(Boolean, default=False)
    vip_expires_at = Column(DateTime, nullable=True)
    vip_message_sent_at = Column(DateTime, nullable=True)
    joined_at = Column(DateTime, default=datetime.utcnow, index=True)
    last_message_at = Column(DateTime, default=datetime.utcnow)
    current_batch_id = Column(Integer, ForeignKey("message_batches.id"), nullable=True)
    current_message_step = Column(Integer, default=0)
    send_error = Column(String(500), nullable=True)
    send_error_at = Column(DateTime, nullable=True)

    payments = relationship("Payment", back_populates="user")
    messages_received = relationship("MessageSent", back_populates="user")

    def __repr__(self):
        return f"<User {self.telegram_id}: {self.username or self.first_name}>"


class MessageBatch(Base):
    __tablename__ = "message_batches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    order = Column(Integer, default=1, index=True)
    is_active = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("Message", back_populates="batch", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MessageBatch {self.id}: {self.name}>"


class StripLink(Base):
    __tablename__ = "strip_links"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True, index=True)
    url = Column(String(500), nullable=False)
    language = Column(String(10), nullable=True, index=True)
    name_translations = Column(Text, nullable=True)
    duration_days = Column(Integer, default=0)
    stripe_link_id = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<StripLink {self.id}: {self.name} ({self.language or 'all'})>"


message_strip_link = Table(
    'message_strip_link',
    Base.metadata,
    Column('message_id', Integer, ForeignKey('messages.id', ondelete='CASCADE'), primary_key=True),
    Column('strip_link_id', Integer, ForeignKey('strip_links.id', ondelete='CASCADE'), primary_key=True)
)


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("message_batches.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False, index=True)
    text = Column(Text, nullable=False)
    text_translations = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    sequence_order = Column(Integer, default=1)
    language = Column(String(10), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("MessageBatch", back_populates="messages")
    strip_links = relationship("StripLink", secondary=message_strip_link, cascade="all, delete")
    messages_sent = relationship("MessageSent", back_populates="message", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Message {self.id}: {self.title}>"


class MessageSent(Base):
    __tablename__ = "messages_sent"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    telegram_message_id = Column(Integer, nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow, index=True)
    status = Column(String(20), default="sent")
    error_message = Column(Text, nullable=True)

    message = relationship("Message", back_populates="messages_sent")
    user = relationship("User", back_populates="messages_received")

    def __repr__(self):
        return f"<MessageSent {self.id}: user={self.user_id} message={self.message_id}>"


class BatchScheduleState(Base):
    __tablename__ = "batch_schedule_state"

    id = Column(Integer, primary_key=True, index=True)
    current_batch_id = Column(Integer, ForeignKey("message_batches.id"), nullable=False, index=True)
    current_message_index = Column(Integer, default=0)
    last_sent_at = Column(DateTime, nullable=True)
    next_send_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    current_batch = relationship("MessageBatch")

    def __repr__(self):
        return f"<BatchScheduleState batch_id={self.current_batch_id} msg_index={self.current_message_index}>"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    stripe_payment_id = Column(String(100), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD")
    status = Column(String(20), default="pending")
    vip_link = Column(String(500), nullable=True)
    vip_link_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)
    webhook_data = Column(Text, nullable=True)

    user = relationship("User", back_populates="payments")

    def __repr__(self):
        return f"<Payment {self.stripe_payment_id}: user={self.user_id} status={self.status}>"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    admin_id = Column(String(100), nullable=True)
    resource_type = Column(String(50))
    resource_id = Column(Integer)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<AuditLog {self.id}: {self.action}>"


class VipConfig(Base):
    __tablename__ = "vip_config"

    id = Column(Integer, primary_key=True, default=1)
    text_translations = Column(Text, nullable=True)
    button_text_translations = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    invite_url = Column(String(500), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<VipConfig invite_url={self.invite_url}>"


class PredefinedAsset(Base):
    __tablename__ = "predefined_assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True, index=True)
    asset_type = Column(String(50), nullable=False)  # 'audio', 'image', 'video', 'link'
    file_url = Column(String(500), nullable=True)  # Para archivos
    link_url = Column(String(500), nullable=True)  # Para links
    category = Column(String(100), nullable=True, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<PredefinedAsset {self.id}: {self.name} ({self.asset_type})>"


class UserMessage(Base):
    __tablename__ = "user_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=True)  # Texto del mensaje
    message_type = Column(String(50), default="text")  # 'text', 'audio', 'image', 'video', 'link'
    sent_by = Column(String(20), nullable=False)  # 'user' o 'admin'
    attachment_url = Column(String(500), nullable=True)  # URL del archivo
    attachment_file_id = Column(String(500), nullable=True)  # Telegram file_id para audios/imágenes
    telegram_message_id = Column(Integer, nullable=True)  # ID del mensaje en Telegram
    status = Column(String(20), default="sent")  # 'sent', 'delivered', 'failed'
    is_read = Column(Boolean, default=False, index=True)  # Leído por el admin
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    read_at = Column(DateTime, nullable=True)  # Cuándo fue leído
    delivered_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    user = relationship("User")

    def __repr__(self):
        return f"<UserMessage {self.id}: user={self.user_id} type={self.message_type}>"


class QuickMessage(Base):
    """Predefined messages for quick sending in 3 languages"""
    __tablename__ = "quick_messages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)  # Name/identifier for admin
    text_es = Column(Text, nullable=False)      # Spanish text
    text_en = Column(Text, nullable=False)      # English text
    text_pt = Column(Text, nullable=False)      # Portuguese text
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<QuickMessage {self.id}: {self.name}>"


class MessageBlock(Base):
    """A named block containing multiple ordered message steps (each in 3 languages)"""
    __tablename__ = "message_blocks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)  # e.g. "Bienvenida Pack 1"
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    steps = relationship("MessageBlockStep", back_populates="block",
                        cascade="all, delete-orphan", order_by="MessageBlockStep.step_order")

    def __repr__(self):
        return f"<MessageBlock {self.id}: {self.name}>"


class MessageBlockStep(Base):
    """A single step within a MessageBlock (one Telegram message) with ES/EN/PT text"""
    __tablename__ = "message_block_steps"

    id = Column(Integer, primary_key=True, index=True)
    block_id = Column(Integer, ForeignKey("message_blocks.id", ondelete="CASCADE"), nullable=False, index=True)
    step_order = Column(Integer, nullable=False, default=1)  # 1, 2, 3... within a block
    text_es = Column(Text, nullable=False)
    text_en = Column(Text, nullable=False)
    text_pt = Column(Text, nullable=False)

    block = relationship("MessageBlock", back_populates="steps")

    def __repr__(self):
        return f"<MessageBlockStep {self.id}: block={self.block_id} step={self.step_order}>"


def init_db():
    Base.metadata.create_all(bind=engine)


def run_migrations():
    migrations = [
        ("messages",    "language",             "VARCHAR(10)"),
        ("strip_links", "language",             "VARCHAR(10)"),
        ("users",       "current_batch_id",     "INTEGER"),
        ("users",       "current_message_step", "INTEGER DEFAULT 0"),
        ("messages",    "text_translations",    "TEXT"),
        ("strip_links", "name_translations",    "TEXT"),
        ("strip_links", "duration_days",        "INTEGER DEFAULT 0"),
        ("strip_links", "stripe_link_id",       "VARCHAR(100)"),
        ("users",       "vip_message_sent_at",  "DATETIME"),
        ("user_messages", "is_read",            "BOOLEAN DEFAULT 0"),
        ("user_messages", "read_at",            "DATETIME"),
        # Send-error tracking: flag blocked/forbidden users
        ("users",         "send_error",          "VARCHAR(500)"),
        ("users",         "send_error_at",       "DATETIME"),
    ]
    
    # Create quick_messages table if not exists
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS quick_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(200) NOT NULL,
                    text_es TEXT NOT NULL,
                    text_en TEXT NOT NULL,
                    text_pt TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
            logger.info("[Migration] quick_messages table created or already exists")
    except Exception as e:
        logger.warning(f"[Migration] quick_messages table error: {e}")
    
    # Create message_blocks table if not exists
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS message_blocks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(200) NOT NULL,
                    description TEXT,
                    category VARCHAR(100),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
            logger.info("[Migration] message_blocks table created or already exists")
    except Exception as e:
        logger.warning(f"[Migration] message_blocks table error: {e}")
    
    # Create message_block_steps table if not exists
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS message_block_steps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    block_id INTEGER NOT NULL,
                    step_order INTEGER NOT NULL DEFAULT 1,
                    text_es TEXT NOT NULL,
                    text_en TEXT NOT NULL,
                    text_pt TEXT NOT NULL,
                    FOREIGN KEY (block_id) REFERENCES message_blocks(id) ON DELETE CASCADE
                )
            """))
            conn.commit()
            logger.info("[Migration] message_block_steps table created or already exists")
    except Exception as e:
        logger.warning(f"[Migration] message_block_steps table error: {e}")
    
    with engine.connect() as conn:
        for table, col, definition in migrations:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {definition}"))
                conn.commit()
                logger.info(f"[Migration] Added column '{col}' to '{table}'")
            except Exception as e:
                # Column might already exist, that's ok
                pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
