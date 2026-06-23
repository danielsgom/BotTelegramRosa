"""
Message Batch Scheduler
Handles automatic message sending from batches at configurable intervals
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import Message, MessageBatch, MessageSent, BatchScheduleState, User, get_db
from bot import telegram_bot
from config import get_settings
import asyncio

logger = logging.getLogger(__name__)
settings = get_settings()


class BatchMessageScheduler:

    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.is_running = False
        self.job_id = "batch_message_sender"
        self.hours_interval = float(settings.MESSAGE_SENDING_INTERVAL)

    def start(self):
        if self.is_running:
            return
        try:
            self.scheduler.start()
            self.is_running = True
            logger.info("Batch message scheduler started")
            self.schedule_batch_sender()
        except Exception as e:
            logger.error(f"Error starting scheduler: {e}")

    def stop(self):
        if not self.is_running:
            return
        try:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("Batch message scheduler stopped")
        except Exception as e:
            logger.error(f"Error stopping scheduler: {e}")

    def schedule_batch_sender(self):
        try:
            try:
                self.scheduler.remove_job(self.job_id)
            except Exception:
                pass

            if not self.is_running:
                return

            start_date = None
            try:
                db = next(get_db())
                state = db.query(BatchScheduleState).first()
                db.close()
                if state and state.next_send_at:
                    if state.next_send_at > datetime.utcnow():
                        start_date = state.next_send_at
                        logger.info(f"[Scheduler] Resuming timer — next send at {start_date.strftime('%H:%M:%S')}")
                    else:
                        logger.info("[Scheduler] Missed send window — firing immediately")
            except Exception as e:
                logger.warning(f"[Scheduler] Could not read next_send_at: {e}")

            trigger = IntervalTrigger(
                hours=self.hours_interval,
                start_date=start_date
            )
            self.scheduler.add_job(
                self._send_next_batch_message_task,
                trigger,
                id=self.job_id,
                name="Send next batch message",
                replace_existing=True
            )
            logger.info(f"[Scheduler] Job scheduled every {self.hours_interval}h")
        except Exception as e:
            logger.error(f"Error scheduling batch sender: {e}")

    def _send_next_batch_message_task(self):
        try:
            bot_loop = telegram_bot.loop
            if bot_loop and bot_loop.is_running():
                future = asyncio.run_coroutine_threadsafe(
                    self._async_send_next_batch_message(), bot_loop
                )
                future.result(timeout=60)
            else:
                logger.warning("[Scheduler] Bot loop not available, using fallback loop")
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(self._async_send_next_batch_message())
                loop.close()
        except Exception as e:
            logger.error(f"Error in batch send task: {e}")

    async def _async_send_next_batch_message(self):
        try:
            db = next(get_db())
            users = db.query(User).filter(User.is_active == True).all()

            if not users:
                db.close()
                return

            sent = failed = skipped = vip_paused = 0

            for user in users:
                try:
                    if user.is_vip:
                        if user.vip_expires_at is None:
                            vip_paused += 1
                            continue
                        elif user.vip_expires_at > datetime.utcnow():
                            vip_paused += 1
                            continue
                        else:
                            user.is_vip = False
                            user.vip_expires_at = None
                            user.current_batch_id = None
                            user.current_message_step = 0

                    msg_data = telegram_bot._get_next_message_for_user(user, db)
                    if not msg_data:
                        skipped += 1
                        continue

                    success = await telegram_bot.send_message_to_user(
                        user_id=user.telegram_id,
                        text=msg_data["text"],
                        image_url=msg_data["image_url"],
                        buttons=msg_data["buttons"] or None,
                        db=db
                    )

                    if success:
                        user.current_message_step = msg_data["step"]
                        user.current_batch_id = msg_data["batch_id"]
                        user.last_message_at = datetime.utcnow()
                        db.add(MessageSent(message_id=msg_data["id"], user_id=user.id, status="sent"))
                        sent += 1
                    else:
                        failed += 1

                except Exception as e:
                    failed += 1
                    logger.error(f"[Scheduler] Error user {user.telegram_id}: {e}")

            db.commit()

            try:
                state = db.query(BatchScheduleState).first()
                if state:
                    state.last_sent_at = datetime.utcnow()
                    state.next_send_at = datetime.utcnow() + timedelta(hours=self.hours_interval)
                    db.commit()
            except Exception as e:
                logger.warning(f"[Scheduler] Could not persist next_send_at: {e}")

            db.close()
            logger.info(f"[Scheduler] Done — sent={sent} failed={failed} skipped={skipped} vip_paused={vip_paused}")

        except Exception as e:
            logger.error(f"[Scheduler] Fatal error: {e}", exc_info=True)
            try:
                db.close()
            except Exception:
                pass

    def initialize_schedule(self):
        try:
            db = next(get_db())
            state = db.query(BatchScheduleState).first()
            if not state:
                batch = db.query(MessageBatch).order_by(MessageBatch.order).first()
                if batch:
                    state = BatchScheduleState(current_batch_id=batch.id, current_message_index=0)
                    db.add(state)
                    db.commit()
            db.close()
        except Exception as e:
            logger.error(f"Error initializing schedule: {e}")

    def get_schedule_state(self):
        try:
            db = next(get_db())
            state = db.query(BatchScheduleState).first()
            db.close()
            return state
        except Exception as e:
            logger.error(f"Error getting schedule state: {e}")
            return None

    def get_scheduled_jobs(self) -> list:
        return [
            {
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            }
            for job in self.scheduler.get_jobs()
        ]


message_scheduler = BatchMessageScheduler()


def get_scheduler() -> BatchMessageScheduler:
    return message_scheduler
