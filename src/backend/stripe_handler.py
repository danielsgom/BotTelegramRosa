"""
Stripe payment handler
Manages payment verification, webhooks, and VIP link generation
"""

import stripe
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import Payment, User, Message, StripLink
from config import get_settings
import logging
import json
from typing import Optional

logger = logging.getLogger(__name__)
settings = get_settings()

stripe.api_key = settings.STRIPE_API_KEY


class StripeHandler:

    @staticmethod
    def verify_webhook_signature(payload: bytes, sig_header: str) -> dict:
        try:
            event = stripe.Webhook.construct_event(
                payload,
                sig_header,
                settings.STRIPE_WEBHOOK_SECRET
            )
            return event
        except ValueError as e:
            logger.error(f"Invalid payload: {e}")
            raise ValueError("Invalid webhook payload")
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid signature: {e}")
            raise ValueError("Invalid webhook signature")

    @staticmethod
    def handle_payment_success(event: dict, db: Session) -> Optional[Payment]:
        try:
            session = event["data"]["object"]

            logger.info(
                f"[Stripe] Session dump — id={session.get('id')} "
                f"payment_link={session.get('payment_link')} "
                f"client_reference_id={session.get('client_reference_id')!r} "
                f"status={session.get('status')} "
                f"amount={session.get('amount_total')} {session.get('currency')}"
            )

            client_ref = session.get("client_reference_id") or ""
            if not client_ref:
                logger.warning(f"[Stripe] No client_reference_id in webhook")
                return None

            try:
                telegram_id = int(client_ref.strip())
            except (ValueError, TypeError):
                logger.error(f"[Stripe] Invalid client_reference_id: {client_ref!r}")
                return None

            user = db.query(User).filter(User.telegram_id == telegram_id).first()
            if not user:
                logger.warning(f"[Stripe] User not found for telegram_id={telegram_id}")
                return None

            duration_days = 0
            strip_link = None
            stripe_payment_link_id = session.get("payment_link")
            if stripe_payment_link_id:
                strip_link = db.query(StripLink).filter(
                    StripLink.stripe_link_id == stripe_payment_link_id
                ).first()
                if strip_link:
                    duration_days = strip_link.duration_days or 0

            payment_intent_id = session.get("payment_intent") or session.get("id")
            amount = (session.get("amount_total") or 0) / 100
            currency = session.get("currency", "eur").upper()

            stripe_data = {
                "event_type": event.get("type"),
                "event_id": event.get("id"),
                "session_id": session.get("id"),
                "payment_link": session.get("payment_link"),
                "amount_total": session.get("amount_total"),
                "currency": session.get("currency"),
                "client_reference_id": client_ref,
            }

            existing = db.query(Payment).filter(
                Payment.stripe_payment_id == payment_intent_id
            ).first()
            if existing:
                existing.status = "completed"
                existing.completed_at = datetime.utcnow()
                existing.webhook_data = json.dumps(stripe_data)
            else:
                existing = Payment(
                    stripe_payment_id=payment_intent_id,
                    user_id=user.id,
                    amount=amount,
                    currency=currency,
                    status="completed",
                    completed_at=datetime.utcnow(),
                    webhook_data=json.dumps(stripe_data)
                )
                db.add(existing)

            user.is_vip = True
            if duration_days > 0:
                user.vip_expires_at = datetime.utcnow() + timedelta(days=duration_days)
            else:
                user.vip_expires_at = None

            user.current_batch_id = None
            user.current_message_step = 0

            db.commit()
            db.refresh(existing)
            return existing

        except Exception as e:
            logger.error(f"[Stripe] Error handling payment success: {e}", exc_info=True)
            db.rollback()
            return None

    @staticmethod
    def generate_vip_link(payment: Payment, db: Session) -> str:
        try:
            vip_link = settings.VIP_CHANNEL_INVITE_LINK
            payment.vip_link = vip_link
            payment.vip_link_sent = False
            db.commit()
            return vip_link
        except Exception as e:
            logger.error(f"Error generating VIP link: {e}")
            return ""

    @staticmethod
    def mark_payment_failed(payment_intent_id: str, db: Session, reason: str = None):
        try:
            payment = db.query(Payment).filter(
                Payment.stripe_payment_id == payment_intent_id
            ).first()
            if payment:
                payment.status = "failed"
                db.commit()
        except Exception as e:
            logger.error(f"Error marking payment failed: {e}")
