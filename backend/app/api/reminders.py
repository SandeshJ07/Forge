import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.services.reminders import dispatch_due_reminders, push_enabled, send_push

router = APIRouter(prefix="/reminders", tags=["reminders"])
settings = get_settings()


class PushConfig(BaseModel):
    enabled: bool
    public_key: str | None


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=200)
    auth: str = Field(min_length=1, max_length=100)


class PushSubscriptionIn(BaseModel):
    """The browser's PushSubscription.toJSON() (expirationTime is ignored)."""

    endpoint: str = Field(min_length=1, max_length=1000, pattern=r"^https://")
    keys: PushKeys


class UnsubscribeIn(BaseModel):
    endpoint: str = Field(min_length=1, max_length=1000)


@router.get("/push-config", response_model=PushConfig)
def get_push_config() -> PushConfig:
    """The VAPID public key the browser subscribes with; enabled=False when the server isn't set up for push."""
    return PushConfig(enabled=push_enabled(), public_key=settings.vapid_public_key or None)


@router.post("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
def subscribe(
    body: PushSubscriptionIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    subscription = db.query(PushSubscription).filter(PushSubscription.endpoint == body.endpoint).one_or_none()
    if subscription is None:
        subscription = PushSubscription(endpoint=body.endpoint)
        db.add(subscription)
    # Re-subscribing (or another account on the same browser) takes the subscription over.
    subscription.user_id = current_user.id
    subscription.p256dh = body.keys.p256dh
    subscription.auth = body.keys.auth
    db.commit()


@router.post("/subscriptions/remove", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(
    body: UnsubscribeIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == body.endpoint, PushSubscription.user_id == current_user.id
    ).delete()
    db.commit()


@router.post("/test", status_code=status.HTTP_204_NO_CONTENT)
def send_test(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    """Sends a test reminder to this user's browsers right away."""
    if not push_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Push reminders aren't set up on the server.")
    subscriptions = db.query(PushSubscription).filter(PushSubscription.user_id == current_user.id).all()
    if not subscriptions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Turn on reminders on this device first.")
    payload = {"title": "Reminders are on ✅", "body": "You'll get a nudge like this at your gym time.", "url": "/"}
    for subscription in subscriptions:
        if not send_push(subscription, payload):
            db.delete(subscription)
    db.commit()


@router.post("/dispatch")
def dispatch(x_cron_secret: str = Header(default=""), db: Session = Depends(get_db)) -> dict:
    """Called by a cron every few minutes: sends every gym reminder that's due."""
    expected = settings.reminder_cron_secret
    if not expected or not secrets.compare_digest(x_cron_secret, expected):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return {"reminded": dispatch_due_reminders(db, datetime.now(timezone.utc))}
