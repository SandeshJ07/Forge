"""
Gym reminders over web push. A cron calls POST /reminders/dispatch every few
minutes; each call sends today's reminder to every user whose local reminder
time has just passed on one of their chosen weekdays, once per local day.
The native app schedules its own local notifications instead.
"""

import json
import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.profile import UserProfile
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)
settings = get_settings()

WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
# Covers a cron that runs every 5-15 minutes, or one that was late (e.g. waking a sleeping server).
# Later than this after the chosen time, the reminder is skipped rather than sent stale.
SEND_WINDOW = timedelta(minutes=45)


def push_enabled() -> bool:
    return bool(settings.vapid_public_key and settings.vapid_private_key)


def reminder_due(profile: UserProfile, now_utc: datetime) -> date | None:
    """The user's local date if their reminder should go out now, else None."""
    if not profile.gym_reminder_time or not profile.gym_reminder_days:
        return None
    try:
        zone = ZoneInfo(profile.timezone or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        zone = ZoneInfo("UTC")
    local = now_utc.astimezone(zone)
    if WEEKDAYS[local.weekday()] not in profile.gym_reminder_days:
        return None
    if profile.gym_reminder_last_sent == local.date():
        return None
    hour, minute = (int(part) for part in profile.gym_reminder_time.split(":"))
    due_at = local.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if not (due_at <= local < due_at + SEND_WINDOW):
        return None
    return local.date()


def send_push(subscription: PushSubscription, payload: dict) -> bool:
    """Sends one push. Returns False when the subscription is gone and should be deleted."""
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            ttl=60 * 60,
        )
        return True
    except WebPushException as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in (404, 410):  # unsubscribed or expired
            return False
        logger.warning("Web push failed (%s) for subscription %s", status, subscription.id)
        return True


def reminder_payload(profile: UserProfile) -> dict:
    return {
        "title": "Time to train 💪",
        "body": "Your workout is waiting — open Forge to start today's session.",
        "url": "/workout/new",
        "tag": "forge-gym-reminder",
    }


def dispatch_due_reminders(db: Session, now_utc: datetime) -> int:
    """Sends every due reminder; returns how many users were reminded."""
    if not push_enabled():
        return 0
    profiles = (
        db.query(UserProfile)
        .filter(UserProfile.gym_reminder_time.is_not(None), UserProfile.gym_reminder_days != [])
        .all()
    )
    reminded = 0
    for profile in profiles:
        local_day = reminder_due(profile, now_utc)
        if local_day is None:
            continue
        subscriptions = db.query(PushSubscription).filter(PushSubscription.user_id == profile.user_id).all()
        if not subscriptions:
            continue
        payload = reminder_payload(profile)
        for subscription in subscriptions:
            if not send_push(subscription, payload):
                db.delete(subscription)
        profile.gym_reminder_last_sent = local_day
        db.commit()
        reminded += 1
    return reminded
