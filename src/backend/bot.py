"""
Telegram Bot Handler
Manages all bot interactions with users
"""

import logging
import os
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, InputMediaPhoto, InputFile
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler
from telegram.error import TelegramError
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import User, Message, MessageSent, UserMessage, get_db
from language import LanguageDetector, get_message_template
from config import get_settings
import asyncio
from typing import Optional
import json
import threading
import time

logger = logging.getLogger(__name__)
settings = get_settings()


class TelegramBot:
    """Telegram bot handler"""

    def __init__(self):
        self.application: Optional[Application] = None
        self.bot_token = settings.TELEGRAM_BOT_TOKEN
        self.polling_thread = None
        self.loop: Optional[asyncio.AbstractEventLoop] = None  # polling thread's event loop
        self._send_errors: dict = {}  # {telegram_id: error_str} — last error per user

    async def start(self):
        """Start the bot"""
        if not self.bot_token:
            logger.error("TELEGRAM_BOT_TOKEN not configured")
            return

        # Start polling thread - Application will be created inside the thread
        self.polling_thread = threading.Thread(target=self._start_polling_thread, daemon=True)
        self.polling_thread.start()
        logger.info("Telegram bot started (polling in background thread)")

    def _start_polling_thread(self):
        """Start polling in a background thread - creates Application inside this thread's event loop"""
        try:
            # Wait for any previous bot connections to expire on Telegram's side
            # Telegram long-polling holds connections for up to 30 seconds
            logger.info("Waiting 5s for previous connections to expire...")
            time.sleep(5)
            
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.add_signal_handler = lambda *args, **kwargs: None
            self.loop = loop  # expose to scheduler so it can submit coroutines here

            # Build Application INSIDE this thread so it uses the correct event loop
            application = Application.builder().token(self.bot_token).build()

            # Add handlers - capture ALL message types
            application.add_handler(CommandHandler("start", self.start_command))
            application.add_handler(CommandHandler("help", self.help_command))
            application.add_handler(CommandHandler("status", self.status_command))
            # Text messages
            application.add_handler(MessageHandler(filters.TEXT, self.handle_message))
            # Voice/audio messages
            application.add_handler(MessageHandler(filters.VOICE, self.handle_voice))
            # Photo messages
            application.add_handler(MessageHandler(filters.PHOTO, self.handle_photo))
            # Video messages
            application.add_handler(MessageHandler(filters.VIDEO, self.handle_video))
            # Document/file messages
            application.add_handler(MessageHandler(filters.Document.ALL, self.handle_document))
            application.add_handler(CallbackQueryHandler(self.handle_callback))
            logger.info("Bot handlers registered")

            self.application = application

            logger.info("✅ Bot polling ACTIVE - listening for /start and messages...")
            loop.run_until_complete(application.run_polling(
                allowed_updates=None,
                drop_pending_updates=True
            ))

        except Exception as e:
            logger.error(f"Error in polling thread: {type(e).__name__}: {e}")
        finally:
            logger.info("Polling thread ended")

    async def stop(self):
        """Stop the bot"""
        if self.application:
            await self.application.stop()
            await self.application.shutdown()
            logger.info("Telegram bot stopped")

    def _get_next_message_for_user(self, user, db):
        """
        Get the next message data for a user based on their language and current step.
        Handles batch rotation and language fallback (user language → null → any).
        Returns a dict with message data and next step info, or None if nothing available.
        """
        from database import MessageBatch, BatchScheduleState

        # Determine which batch the user is in — must be an active batch
        batch_id = user.current_batch_id

        # If the user's current batch is inactive or unset, move to first active batch
        if batch_id:
            current_batch = db.query(MessageBatch).filter(
                MessageBatch.id == batch_id,
                MessageBatch.is_active == True
            ).first()
            if not current_batch:
                batch_id = None  # Batch was deactivated, reset

        if not batch_id:
            first_active = db.query(MessageBatch).filter(
                MessageBatch.is_active == True
            ).order_by(MessageBatch.order).first()
            if first_active:
                batch_id = first_active.id
                user.current_batch_id = batch_id
                user.current_message_step = 0
        if not batch_id:
            return None

        def steps_in_batch(bid):
            rows = db.execute(
                text("SELECT DISTINCT sequence_order FROM messages WHERE batch_id = :bid ORDER BY sequence_order"),
                {"bid": bid}
            ).fetchall()
            return [r[0] for r in rows]

        steps = steps_in_batch(batch_id)
        if not steps:
            return None

        current_step = user.current_message_step or 0
        next_steps = [s for s in steps if s > current_step]

        if not next_steps:
            # Batch exhausted — rotate to next active batch, wrap to first active if none
            active_batches = db.query(MessageBatch).filter(
                MessageBatch.is_active == True
            ).order_by(MessageBatch.order).all()

            if not active_batches:
                return None

            current_batch = db.query(MessageBatch).filter(MessageBatch.id == batch_id).first()
            current_order = current_batch.order if current_batch else 0

            # Pick next active batch with higher order, or wrap to first active
            next_batch = next(
                (b for b in active_batches if b.order > current_order),
                active_batches[0]  # wrap to first active batch
            )

            batch_id = next_batch.id
            user.current_batch_id = batch_id
            user.current_message_step = 0
            steps = steps_in_batch(batch_id)
            if not steps:
                return None
            next_steps = steps
            logger.info(f"  Batch rotation → batch={batch_id} '{next_batch.name}' (user {user.telegram_id})")

        next_step = next_steps[0]

        # One message per step (translations stored in text_translations JSON)
        msg = db.query(Message).filter(
            Message.batch_id == batch_id,
            Message.sequence_order == next_step
        ).first()

        if not msg:
            return None

        # Resolve translated text: text_translations JSON → user.language → 'es' → text
        import json as _json
        text_out = msg.text
        if msg.text_translations:
            try:
                trans = _json.loads(msg.text_translations)
                text_out = trans.get(user.language) or trans.get('es') or msg.text
            except Exception:
                pass

        # Resolve translated link names + append client_reference_id for purchase tracking
        buttons = []
        for lnk in msg.strip_links:
            link_name = lnk.name
            if lnk.name_translations:
                try:
                    name_trans = _json.loads(lnk.name_translations)
                    link_name = name_trans.get(user.language) or name_trans.get('es') or lnk.name
                except Exception:
                    pass
            # client_reference_id = telegram_id only (Stripe returns it in webhook)
            # duration_days is resolved via session.payment_link → StripLink.stripe_link_id
            sep = '&' if '?' in lnk.url else '?'
            url_with_ref = f"{lnk.url}{sep}client_reference_id={user.telegram_id}"
            buttons.append({"text": link_name, "url": url_with_ref})

        return {
            "id": msg.id,
            "title": msg.title,
            "text": text_out,
            "image_url": msg.image_url if msg.image_url and msg.image_url.strip() else None,
            "buttons": buttons,
            "step": next_step,
            "batch_id": batch_id,
        }

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command - sends next batch message for this user"""
        logger.info(f"/start ← user {update.effective_user.id if update.effective_user else '?'}")
        try:
            user = update.effective_user
            chat_id = update.effective_chat.id

            # Detect language
            language = LanguageDetector.detect_combined(
                user.language_code if user else None,
                fallback=settings.DEFAULT_LANGUAGE
            )

            # Save or update user
            db = next(get_db())
            db_user = db.query(User).filter(User.telegram_id == user.id).first()
            if not db_user:
                db_user = User(
                    telegram_id=user.id,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    username=user.username,
                    language=language,
                    is_active=True
                )
                db.add(db_user)
                logger.info(f"  New user registered: {user.id} lang={language}")
            else:
                # Re-registration: overwrite everything (no recovery)
                db_user.first_name = user.first_name
                db_user.last_name = user.last_name
                db_user.username = user.username
                db_user.language = language
                db_user.is_active = True
                db_user.is_vip = False
                db_user.vip_expires_at = None
                db_user.current_batch_id = None
                db_user.current_message_step = 0
                db_user.last_message_at = datetime.utcnow()
                logger.info(f"  User re-registered: {user.id} lang={language} — sequence reset")
            db.commit()

            # Get next message for this user
            msg_data = self._get_next_message_for_user(db_user, db)

            if msg_data:
                success = await self.send_message_to_user(
                    user_id=chat_id,
                    text=msg_data["text"],
                    image_url=msg_data["image_url"],
                    buttons=msg_data["buttons"] or None,
                    db=None,
                    user_db_id=db_user.id,
                    message_type="text"
                )
                if success:
                    db_user.current_message_step = msg_data["step"]
                    db_user.current_batch_id = msg_data["batch_id"]
                    db_user.last_message_at = datetime.utcnow()
                    db.add(MessageSent(message_id=msg_data["id"], user_id=db_user.id, status="sent"))
                    db.commit()
                    logger.info(f"  Sent to {user.id}: batch={msg_data['batch_id']} step={msg_data['step']} '{msg_data['title']}'")
                else:
                    logger.warning(f"  Send failed for user {user.id}")
            else:
                await context.bot.send_message(
                    chat_id=chat_id,
                    text="👋 ¡Hola! Pronto recibirás mensajes con ofertas especiales."
                )
                logger.info(f"  No batch message available for user {user.id}")
            db.close()

        except Exception as e:
            logger.error(f"Error in start_command: {e}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="❌ Error occurred. Please try again."
            )

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command"""
        help_text = """
🤖 **BotTelegramRosa Help**

*Available Commands:*
/start - Start the bot
/help - Show this message
/status - Check your status
/subscribe - Subscribe to messages
/unsubscribe - Unsubscribe from messages

*Features:*
📬 Receive messages every 2 hours
💳 Payment links for premium access
🎁 VIP channel access after payment
🌐 Multi-language support

For more help, visit our support panel.
        """
        await update.message.reply_text(help_text, parse_mode="Markdown")

    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /status command"""
        try:
            user_id = update.effective_user.id
            db = next(get_db())

            user = db.query(User).filter(User.telegram_id == user_id).first()
            db.close()

            if not user:
                status_text = "❌ User not found. Use /start to register."
            else:
                vip_status = "✅ VIP" if user.is_vip else "⭕ Regular"
                status_text = f"""
👤 **Your Status**

Name: {user.first_name}
Language: {user.language.upper()}
Status: {vip_status}
Joined: {user.joined_at.strftime('%Y-%m-%d')}
Active: {'Yes ✅' if user.is_active else 'No ❌'}
                """

            await update.message.reply_text(status_text, parse_mode="Markdown")

        except Exception as e:
            logger.error(f"Error in status_command: {e}")

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle regular text messages"""
        try:
            user = update.effective_user
            message_text = update.message.text or ""
            db = next(get_db())

            db_user = db.query(User).filter(User.telegram_id == user.id).first()
            if db_user:
                db_user.last_message_at = datetime.utcnow()
                db.commit()
                
                user_msg = UserMessage(
                    user_id=db_user.id,
                    content=message_text,
                    message_type="text",
                    sent_by="user",
                    status="delivered",
                    delivered_at=datetime.utcnow()
                )
                db.add(user_msg)
                db.commit()
                logger.info(f"Text message from user {user.id}: {message_text[:50]}")

            db.close()
        except Exception as e:
            logger.error(f"Error handling text message: {e}")

    async def handle_voice(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle voice/audio messages"""
        try:
            user = update.effective_user
            db = next(get_db())

            db_user = db.query(User).filter(User.telegram_id == user.id).first()
            if db_user:
                db_user.last_message_at = datetime.utcnow()
                db.commit()
                
                # Try to get file info
                voice = update.message.voice
                duration = voice.duration if voice else 0
                
                user_msg = UserMessage(
                    user_id=db_user.id,
                    content=f"🎵 Voice message ({duration}s)",
                    message_type="audio",
                    sent_by="user",
                    status="delivered",
                    delivered_at=datetime.utcnow()
                )
                db.add(user_msg)
                db.commit()
                logger.info(f"Voice message from user {user.id}")

            db.close()
        except Exception as e:
            logger.error(f"Error handling voice message: {e}")

    async def handle_photo(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle photo messages"""
        try:
            user = update.effective_user
            db = next(get_db())

            db_user = db.query(User).filter(User.telegram_id == user.id).first()
            if db_user:
                db_user.last_message_at = datetime.utcnow()
                db.commit()
                
                caption = update.message.caption or "🖼️ Photo"
                
                user_msg = UserMessage(
                    user_id=db_user.id,
                    content=caption,
                    message_type="image",
                    sent_by="user",
                    status="delivered",
                    delivered_at=datetime.utcnow()
                )
                db.add(user_msg)
                db.commit()
                logger.info(f"Photo from user {user.id}: {caption[:50]}")

            db.close()
        except Exception as e:
            logger.error(f"Error handling photo: {e}")

    async def handle_video(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle video messages"""
        try:
            user = update.effective_user
            db = next(get_db())

            db_user = db.query(User).filter(User.telegram_id == user.id).first()
            if db_user:
                db_user.last_message_at = datetime.utcnow()
                db.commit()
                
                caption = update.message.caption or "🎬 Video"
                
                user_msg = UserMessage(
                    user_id=db_user.id,
                    content=caption,
                    message_type="video",
                    sent_by="user",
                    status="delivered",
                    delivered_at=datetime.utcnow()
                )
                db.add(user_msg)
                db.commit()
                logger.info(f"Video from user {user.id}: {caption[:50]}")

            db.close()
        except Exception as e:
            logger.error(f"Error handling video: {e}")

    async def handle_document(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle document/file messages"""
        try:
            user = update.effective_user
            db = next(get_db())

            db_user = db.query(User).filter(User.telegram_id == user.id).first()
            if db_user:
                db_user.last_message_at = datetime.utcnow()
                db.commit()
                
                doc = update.message.document
                file_name = doc.file_name if doc else "File"
                caption = update.message.caption or f"📎 {file_name}"
                
                user_msg = UserMessage(
                    user_id=db_user.id,
                    content=caption,
                    message_type="text",
                    sent_by="user",
                    status="delivered",
                    delivered_at=datetime.utcnow()
                )
                db.add(user_msg)
                db.commit()
                logger.info(f"Document from user {user.id}: {file_name}")

            db.close()
        except Exception as e:
            logger.error(f"Error handling document: {e}")

    async def handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle inline button callbacks"""
        query = update.callback_query
        try:
            await query.answer()
            # Implement callback handling logic here
        except Exception as e:
            logger.error(f"Error handling callback: {e}")

    async def send_message_to_user(
        self,
        user_id: int,
        text: str,
        image_url: Optional[str] = None,
        buttons: Optional[list] = None,
        db: Optional[Session] = None,
        user_db_id: Optional[int] = None,
        message_type: str = "text"
    ) -> bool:
        """
        Send message to user
        
        Args:
            user_id: Telegram user ID
            text: Message text
            image_url: Optional image URL
            buttons: Optional inline buttons list
            db: Database session for recording
            user_db_id: Database user ID for saving to chat history
            message_type: Type of message (text, image, etc.)
            
        Returns:
            Success status
        """
        try:
            if not self.application:
                logger.error("Bot not initialized")
                return False

            # Create inline keyboard if buttons provided
            reply_markup = None
            if buttons:
                keyboard = []
                for button in buttons:
                    keyboard.append([
                        InlineKeyboardButton(button["text"], url=button["url"])
                    ])
                reply_markup = InlineKeyboardMarkup(keyboard)

            # Send message
            telegram_msg_id = None
            if image_url and image_url.strip():
                # Local path: send as binary file; remote URL: send directly
                if image_url.startswith("http://") or image_url.startswith("https://"):
                    photo = image_url
                else:
                    abs_path = os.path.join(settings.BASE_DIR if hasattr(settings, 'BASE_DIR') else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), image_url.lstrip("/"))
                    if not os.path.exists(abs_path):
                        logger.warning(f"Image not found on disk: {abs_path}, sending text only")
                        abs_path = None
                    photo = open(abs_path, "rb") if abs_path else None

                if photo:
                    message = await self.application.bot.send_photo(
                        chat_id=user_id,
                        photo=photo,
                        caption=text,
                        reply_markup=reply_markup,
                        parse_mode="HTML"
                    )
                    if hasattr(photo, 'close'):
                        photo.close()
                    telegram_msg_id = message.message_id
                else:
                    message = await self.application.bot.send_message(
                        chat_id=user_id,
                        text=text,
                        reply_markup=reply_markup,
                        parse_mode="HTML"
                    )
                    telegram_msg_id = message.message_id
            else:
                message = await self.application.bot.send_message(
                    chat_id=user_id,
                    text=text,
                    reply_markup=reply_markup,
                    parse_mode="HTML"
                )
                telegram_msg_id = message.message_id

            # Save to chat history (UserMessage table)
            if user_db_id:
                try:
                    if db is None:
                        db = next(get_db())
                        close_db = True
                    else:
                        close_db = False

                    user_msg = UserMessage(
                        user_id=user_db_id,
                        content=text,
                        message_type=message_type,
                        sent_by="admin",  # System/bot messages shown as admin
                        attachment_url=image_url if image_url else None,
                        status="delivered",
                        telegram_message_id=telegram_msg_id,
                        delivered_at=datetime.utcnow()
                    )
                    db.add(user_msg)
                    db.commit()

                    if close_db:
                        db.close()

                    logger.info(f"Auto message saved to chat history for user {user_db_id}")
                except Exception as e:
                    logger.error(f"Error saving auto message to history: {e}")

            logger.info(f"Message sent to user {user_id}")
            self._send_errors.pop(user_id, None)
            return True

        except TelegramError as e:
            logger.error(f"Telegram error sending message to {user_id}: {e}")
            self._send_errors[user_id] = str(e)
            return False
        except Exception as e:
            logger.error(f"Error sending message to {user_id}: {e}")
            self._send_errors[user_id] = str(e)
            return False

    async def send_bulk_messages(self, message_id: int, db: Session) -> dict:
        """
        Send message to all active users
        
        Args:
            message_id: Message template ID
            db: Database session
            
        Returns:
            Statistics of sending
        """
        stats = {
            "total": 0,
            "sent": 0,
            "failed": 0,
            "errors": []
        }

        try:
            message = db.query(Message).filter(Message.id == message_id).first()
            if not message:
                logger.error(f"Message {message_id} not found")
                return stats

            # Get all active users
            users = db.query(User).filter(User.is_active == True).all()
            stats["total"] = len(users)

            # Parse buttons from stripe_links
            buttons = []
            if message.stripe_links:
                try:
                    links = json.loads(message.stripe_links)
                    for idx, link in enumerate(links, 1):
                        buttons.append({
                            "text": f"💳 Payment {idx}",
                            "url": link["url"]
                        })
                except Exception as e:
                    logger.warning(f"Error parsing stripe links: {e}")

            # Send to each user
            for user in users:
                try:
                    success = await self.send_message_to_user(
                        user_id=user.telegram_id,
                        text=message.text,
                        image_url=message.image_url,
                        buttons=buttons,
                        db=db,
                        user_db_id=user.id,
                        message_type="text"
                    )

                    if success:
                        stats["sent"] += 1
                        # Record in database
                        message_sent = MessageSent(
                            message_id=message.id,
                            user_id=user.id,
                            status="sent"
                        )
                        db.add(message_sent)
                    else:
                        stats["failed"] += 1

                except Exception as e:
                    stats["failed"] += 1
                    stats["errors"].append(f"User {user.telegram_id}: {str(e)}")
                    logger.error(f"Error sending to user {user.telegram_id}: {e}")

            # Update message sending timestamp
            message.last_sent_at = datetime.utcnow()
            db.commit()

            logger.info(f"Bulk send completed: {stats['sent']}/{stats['total']} successful")
            return stats

        except Exception as e:
            logger.error(f"Error in bulk send: {e}")
            return stats

    async def send_manual_message(
        self,
        user_id: int,
        content: Optional[str] = None,
        message_type: str = "text",
        attachment_url: Optional[str] = None
    ) -> Optional[int]:
        """
        Send a manual message to a user (from admin)
        
        Args:
            user_id: Telegram user ID
            content: Message text content
            message_type: Type of message (text, audio, image, video, link)
            attachment_url: URL or local path to the attachment if applicable
            
        Returns:
            Telegram message ID on success, None on failure
        """
        try:
            if not self.application:
                logger.error("Bot not initialized")
                return None

            telegram_msg_id = None

            # Helper function to get file for Telegram (URL or bytes)
            def get_file_for_telegram(url: str):
                """Convert local paths to file bytes, keep external URLs as-is"""
                if not url:
                    return None
                
                # If it's a local path (starts with /uploads/), read as bytes
                if url.startswith("/uploads/"):
                    import os
                    file_path = os.path.join("uploads", url.split("/uploads/")[1])
                    if os.path.exists(file_path):
                        with open(file_path, "rb") as f:
                            return f.read()
                    else:
                        logger.warning(f"Local file not found: {file_path}")
                        return None
                
                # Otherwise, return as-is (could be external URL or file path)
                return url

            # Send based on message type
            if message_type == "text":
                telegram_msg_id = await self.application.bot.send_message(
                    chat_id=user_id,
                    text=content or "📨 New message from admin"
                )
                telegram_msg_id = telegram_msg_id.message_id

            elif message_type == "audio":
                if attachment_url:
                    file_data = get_file_for_telegram(attachment_url)
                    if file_data is not None:
                        telegram_msg_id = await self.application.bot.send_audio(
                            chat_id=user_id,
                            audio=file_data,
                            title="Audio"
                        )
                        telegram_msg_id = telegram_msg_id.message_id

            elif message_type == "image":
                if attachment_url:
                    file_data = get_file_for_telegram(attachment_url)
                    if file_data is not None:
                        telegram_msg_id = await self.application.bot.send_photo(
                            chat_id=user_id,
                            photo=file_data,
                            caption=content or "🖼️ Image from admin"
                        )
                        telegram_msg_id = telegram_msg_id.message_id

            elif message_type == "video":
                if attachment_url:
                    file_data = get_file_for_telegram(attachment_url)
                    if file_data is not None:
                        telegram_msg_id = await self.application.bot.send_video(
                            chat_id=user_id,
                            video=file_data,
                            caption=content or "🎬 Video from admin"
                        )
                        telegram_msg_id = telegram_msg_id.message_id

            logger.info(f"Manual message sent to user {user_id}: type={message_type}")
            return telegram_msg_id

        except TelegramError as e:
            logger.error(f"Telegram error sending manual message to {user_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error sending manual message to {user_id}: {e}")
            return None


# Global bot instance
telegram_bot = TelegramBot()


async def get_bot() -> TelegramBot:
    """Get bot instance"""
    return telegram_bot
