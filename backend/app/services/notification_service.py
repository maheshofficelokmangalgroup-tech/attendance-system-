"""
Multi-Channel Notification Dispatcher — In-App DB, Email (SMTP), and Webhooks.
"""
import smtplib
import ssl
from email.message import EmailMessage

import structlog
import httpx
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.notification import Notification

logger = structlog.get_logger()


class NotificationService:
    def __init__(self, db: Session):
        self.db = db

    def create_in_app(
        self,
        user_id: int,
        title: str,
        body: str,
        type: str = "general",
        employee_id: Optional[int] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> Notification:
        """Persists an in-app notification to the database for mobile/admin display."""
        noti = Notification(
            user_id=user_id,
            employee_id=employee_id,
            title=title,
            body=body,
            type=type,
            meta=meta or {},
            is_read=False,
        )
        self.db.add(noti)
        self.db.flush()
        logger.info("In-App notification created", user_id=user_id, title=title)
        return noti

    def send_email(self, to_email: str, subject: str, body: str) -> bool:
        """
        Sends email via SMTP when SMTP_HOST is configured.
        Falls back to logging-only (dev/test mode) when it isn't, so the
        rest of the notification pipeline keeps working without a mail server.
        """
        if not settings.SMTP_HOST:
            logger.info("SMTP not configured — logging email instead of sending", to=to_email, subject=subject)
            return True

        message = EmailMessage()
        message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(body)

        try:
            context = ssl.create_default_context()
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls(context=context)
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(message)
            logger.info("Email sent", to=to_email, subject=subject)
            return True
        except Exception as e:
            logger.warning("Email send failed", to=to_email, subject=subject, error=str(e))
            return False

    async def send_webhook_async(self, webhook_url: str, payload: Dict[str, Any]) -> bool:
        """Dispatches an HTTP POST payload to configured webhooks (Slack/Teams/HRIS)."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(webhook_url, json=payload)
                return resp.status_code < 400
        except Exception as e:
            logger.warning("Webhook dispatch failed", url=webhook_url, error=str(e))
            return False

    def list_user_notifications(self, user_id: int, skip: int = 0, limit: int = 30) -> Tuple[List[Notification], int]:
        q = self.db.query(Notification).filter(Notification.user_id == user_id)
        total = q.count()
        items = q.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    def mark_read(self, notification_id: int, user_id: int) -> bool:
        noti = (
            self.db.query(Notification)
            .filter(Notification.id == notification_id, Notification.user_id == user_id)
            .first()
        )
        if noti:
            noti.is_read = True
            self.db.commit()
            return True
        return False

    def mark_all_read(self, user_id: int) -> int:
        count = (
            self.db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.is_read == False)  # noqa
            .update({"is_read": True})
        )
        self.db.commit()
        return count
