"""Notifications API router — /api/v1/notifications"""
import math
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.notification_service import NotificationService
from app.schemas.common import APIResponse, PaginatedResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    body: str
    type: str
    is_read: bool
    created_at: datetime
    model_config = {"from_attributes": True}


@router.get("", response_model=PaginatedResponse[NotificationResponse], summary="List logged-in user's notifications")
def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = NotificationService(db)
    skip = (page - 1) * page_size
    items, total = svc.list_user_notifications(user_id=current_user.id, skip=skip, limit=page_size)
    return PaginatedResponse(
        data=[NotificationResponse.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


@router.post("/{id}/read", response_model=APIResponse[bool], summary="Mark a single notification as read")
def mark_read(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = NotificationService(db)
    success = svc.mark_read(notification_id=id, user_id=current_user.id)
    return APIResponse(data=success, message="Notification marked as read")


@router.post("/read-all", response_model=APIResponse[int], summary="Mark all notifications as read")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = NotificationService(db)
    count = svc.mark_all_read(user_id=current_user.id)
    return APIResponse(data=count, message=f"Marked {count} notifications as read")
