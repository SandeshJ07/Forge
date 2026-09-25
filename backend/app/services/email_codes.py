import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import keyed_hash
from app.models.email_code import EmailCode

settings = get_settings()

# Wrong guesses allowed against a single code before it's burned.
MAX_ATTEMPTS_PER_CODE = 5
# New codes of one purpose a single user can be issued per rolling hour.
# Together with MAX_ATTEMPTS_PER_CODE this caps guessing at 25/hour per
# account, instead of "request a fresh code, get 5 more guesses" forever.
MAX_CODES_PER_HOUR = 5
# Every email Forge sends carries one of these codes, so these limits cover all
# outgoing mail per account: a pause between any two emails (the app shows a
# matching countdown on its "Resend" buttons — frontend RESEND_COOLDOWN_SECONDS),
# and a daily ceiling across all kinds.
RESEND_COOLDOWN_SECONDS = 60
MAX_CODES_PER_DAY = 10


class TooManyCodesRequested(Exception):
    pass


class CodeCooldown(TooManyCodesRequested):
    """A code was emailed less than RESEND_COOLDOWN_SECONDS ago."""

    def __init__(self, retry_after: int):
        super().__init__(f"Please wait {retry_after} seconds before requesting another code.")
        self.retry_after = retry_after


def _hash_code(code: str) -> str:
    # Keyed, so a leaked table can't be brute-forced (there are only a million 6-digit codes).
    return keyed_hash(code, "email-code")


def generate_code() -> str:
    """6-digit numeric code — easy to type on a phone, unambiguous read aloud."""
    return f"{secrets.randbelow(1_000_000):06d}"


def create_code(db: Session, user_id: UUID, purpose: str) -> str:
    """
    Issues a new code (to be emailed). Raises CodeCooldown if the account was
    sent any code in the last RESEND_COOLDOWN_SECONDS, or TooManyCodesRequested
    past the hourly (per purpose) or daily (all purposes) caps.
    """
    now = datetime.now(timezone.utc)
    last_sent = (
        db.query(EmailCode.created_at)
        .filter(EmailCode.user_id == user_id)
        .order_by(EmailCode.created_at.desc())
        .limit(1)
        .scalar()
    )
    if last_sent is not None:
        wait = RESEND_COOLDOWN_SECONDS - (now - last_sent).total_seconds()
        if wait > 0:
            raise CodeCooldown(int(wait) + 1)
    sent_today = (
        db.query(EmailCode)
        .filter(EmailCode.user_id == user_id, EmailCode.created_at > now - timedelta(days=1))
        .count()
    )
    if sent_today >= MAX_CODES_PER_DAY:
        raise TooManyCodesRequested("You've requested too many codes today. Try again tomorrow.")
    recent_count = (
        db.query(EmailCode)
        .filter(
            EmailCode.user_id == user_id,
            EmailCode.purpose == purpose,
            EmailCode.created_at > now - timedelta(hours=1),
        )
        .count()
    )
    if recent_count >= MAX_CODES_PER_HOUR:
        raise TooManyCodesRequested("Too many codes requested. Try again later.")

    # Only the newest code is ever valid — burn any still-live older ones.
    db.query(EmailCode).filter(
        EmailCode.user_id == user_id,
        EmailCode.purpose == purpose,
        EmailCode.used_at.is_(None),
    ).update({EmailCode.used_at: now}, synchronize_session=False)

    code = generate_code()
    expires_at = now + timedelta(minutes=settings.email_code_expire_minutes)
    db.add(EmailCode(user_id=user_id, purpose=purpose, code_hash=_hash_code(code), expires_at=expires_at))
    db.commit()
    return code


def discard_latest_code(db: Session, user_id: UUID, purpose: str) -> None:
    """Undoes create_code when the email couldn't be sent, so a failed send doesn't start the cooldown or use up the caps."""
    latest = (
        db.query(EmailCode)
        .filter(EmailCode.user_id == user_id, EmailCode.purpose == purpose)
        .order_by(EmailCode.created_at.desc())
        .first()
    )
    if latest is not None:
        db.delete(latest)
        db.commit()


def verify_and_consume_code(db: Session, user_id: UUID, purpose: str, code: str) -> bool:
    """
    Looks up the most recent unused, unexpired code of this purpose for this
    user and marks it used if it matches. Returns False on any mismatch
    (wrong code, expired, already used, too many attempts) without
    distinguishing which, so a guesser can't use the error message to narrow
    down a valid code. Each wrong guess counts against the code; after
    MAX_ATTEMPTS_PER_CODE it's burned and a new one must be requested.
    """
    now = datetime.now(timezone.utc)
    record = (
        db.query(EmailCode)
        .filter(
            EmailCode.user_id == user_id,
            EmailCode.purpose == purpose,
            EmailCode.used_at.is_(None),
            EmailCode.expires_at > now,
        )
        .order_by(EmailCode.created_at.desc())
        .with_for_update()
        .first()
    )
    if record is None:
        return False

    if not secrets.compare_digest(record.code_hash, _hash_code(code.strip())):
        record.attempts += 1
        if record.attempts >= MAX_ATTEMPTS_PER_CODE:
            record.used_at = now
        db.commit()
        return False

    record.used_at = now
    db.commit()
    return True
