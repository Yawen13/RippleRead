from fastapi import APIRouter, Query, Request
from pydantic import BaseModel
from typing import Optional

from ..services.notification_service import (
    get_unread_count,
    get_notifications,
    mark_as_read,
    mark_all_read,
    create_platform_notification,
    check_and_notify_vocab_review,
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class PlatformNotificationRequest(BaseModel):
    type: str = "platform"
    title: str
    body: str = ""
    link: str = ""
    min_lexile: Optional[int] = None
    max_lexile: Optional[int] = None
    target_user_id: int = 0


@router.get("/unread-count")
async def unread_count(request: Request):
    try:
        count = get_unread_count(request.state.user_id)
        return {"code": 0, "message": "ok", "data": {"count": count}}
    except Exception as e:
        return {"code": -1, "message": str(e), "data": {"count": 0}}


@router.get("")
async def list_notifications(request: Request, limit: int = Query(20, ge=1, le=50)):
    try:
        check_and_notify_vocab_review(request.state.user_id)
        notifs = get_notifications(request.state.user_id, limit)
        return {"code": 0, "message": "ok", "data": notifs}
    except Exception as e:
        return {"code": -1, "message": str(e), "data": []}


@router.put("/{notif_id}/read")
async def read_notification(notif_id: int, request: Request):
    try:
        mark_as_read(notif_id, request.state.user_id)
        return {"code": 0, "message": "ok"}
    except Exception as e:
        return {"code": -1, "message": str(e)}


@router.post("/mark-all-read")
async def mark_all_notifications_read(request: Request):
    try:
        mark_all_read(request.state.user_id)
        return {"code": 0, "message": "ok"}
    except Exception as e:
        return {"code": -1, "message": str(e)}


@router.post("/platform")
async def send_platform_notification(body: PlatformNotificationRequest, request: Request):
    try:
        create_platform_notification(
            type=body.type,
            title=body.title,
            body=body.body,
            link=body.link,
            target_user_id=body.target_user_id,
            min_lexile=body.min_lexile,
            max_lexile=body.max_lexile,
        )
        return {"code": 0, "message": "Platform notification sent"}
    except Exception as e:
        return {"code": -1, "message": str(e)}
