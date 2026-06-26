"""
Stripe webhook route.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from config import get_settings
from database import User, get_db
from stripe_handler import StripeHandler
from routes.vip import send_vip_welcome

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["webhooks"])


@router.post(settings.STRIPE_WEBHOOK_PATH)
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        payload = await request.body()
        sig_header = request.headers.get("stripe-signature")

        relevant_headers = {
            k: v
            for k, v in request.headers.items()
            if k.lower() in ("stripe-signature", "content-type", "user-agent", "content-length")
        }
        logger.info(f"Incoming webhook — headers: {relevant_headers}")
        try:
            body_preview = payload.decode("utf-8")[:2000]
            logger.info(f"Raw body (first 2000 chars): {body_preview}")
        except Exception:
            pass

        event = StripeHandler.verify_webhook_signature(payload, sig_header)
        event_type = event["type"]
        logger.info(f"Webhook received: {event_type}")

        if event_type == "checkout.session.completed":
            payment = StripeHandler.handle_payment_success(event, db)
            if payment:
                user = db.query(User).filter(User.id == payment.user_id).first()
                if user:
                    sent = await send_vip_welcome(user, db)
                    payment.vip_link_sent = sent
                    db.commit()

        elif event_type == "payment_intent.succeeded":
            payment = StripeHandler.handle_payment_success(event, db)
            if payment:
                user = db.query(User).filter(User.id == payment.user_id).first()
                if user:
                    sent = await send_vip_welcome(user, db)
                    payment.vip_link_sent = sent
                    db.commit()

        elif event_type == "payment_intent.payment_failed":
            payment_intent_id = event["data"]["object"]["id"]
            StripeHandler.mark_payment_failed(
                payment_intent_id,
                db,
                reason=event["data"]["object"].get("last_payment_error", {}).get("message"),
            )

        return {"success": True}

    except ValueError as e:
        logger.error(f"Invalid webhook: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error handling webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))
