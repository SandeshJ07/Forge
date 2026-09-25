import logging
import re
import secrets
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import email_index, keyed_hash
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import RateLimiter
from app.core.security import (
    InvalidTokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    DeleteAccountRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleSignInRequest,
    PasswordCodeResponse,
    RefreshRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    SignInRequest,
    SignUpRequest,
    SignUpResponse,
    TokenResponse,
    UpdateUsernameRequest,
    UsernameResponse,
    VerifyEmailRequest,
)
from app.services.email import (
    EmailSendError,
    send_password_reset_code,
    send_set_password_code,
    send_verification_code,
)
from app.services.email_codes import TooManyCodesRequested, create_code, verify_and_consume_code
from app.services.google_auth import (
    GoogleSignInDisabled,
    GoogleUnreachable,
    InvalidGoogleToken,
    verify_google_id_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
logger = logging.getLogger(__name__)

# Per-IP limits on the unauthenticated routes. The code-checking routes are
# also capped per code (see app/services/email_codes.py); these stop one
# client hammering many accounts or passwords.
sign_in_limit = RateLimiter("sign-in", max_requests=10, window_seconds=60)
sign_up_limit = RateLimiter("sign-up", max_requests=5, window_seconds=600)
code_check_limit = RateLimiter("code-check", max_requests=10, window_seconds=60)
code_send_limit = RateLimiter("code-send", max_requests=5, window_seconds=600)


def _user_by_email(db: Session, email: str) -> User | None:
    # Emails are encrypted at rest; look them up by their keyed hash.
    return db.query(User).filter(User.email_hash == email_index(email)).one_or_none()


EMAIL_UNAVAILABLE = "We couldn't send the email right now. Please try again in a few minutes."


def _send_code_quietly(db: Session, user: User, purpose: str, send) -> None:
    """
    For the resend/forgot routes, which answer 204 so they can't be used to
    probe which emails have accounts: hitting the per-user code cap is
    swallowed the same way a missing account is. A mail-server failure is
    reported (503) though — otherwise the user waits for an email that
    will never come.
    """
    try:
        code = create_code(db, user.id, purpose)
    except TooManyCodesRequested:
        return
    try:
        send(user.email, code)
    except EmailSendError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=EMAIL_UNAVAILABLE) from exc


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user_id=user.id,
        username=user.username,
    )


@router.post(
    "/sign-up",
    response_model=SignUpResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(sign_up_limit)],
)
def sign_up(body: SignUpRequest, db: Session = Depends(get_db)) -> SignUpResponse:
    if db.query(User).filter(User.username == body.username).one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That username is already taken")

    email = body.email.strip().lower()
    user = User(
        email=email,
        email_hash=email_index(email),
        username=body.username,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        detail = "That username is already taken" if "username" in str(exc.orig) else "An account with this email already exists"
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
    db.refresh(user)

    code = create_code(db, user.id, "verify_email")
    try:
        send_verification_code(user.email, code)
    except EmailSendError as exc:
        # Undo the sign-up rather than leave an unverified account the user can't
        # finish (and can't re-register, since the email/username are now taken).
        db.delete(user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="We couldn't send your verification email, so your account wasn't created. "
            "Please try again in a few minutes.",
        ) from exc

    return SignUpResponse(email=user.email)


@router.post("/verify-email", response_model=TokenResponse, dependencies=[Depends(code_check_limit)])
def verify_email(body: VerifyEmailRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = _user_by_email(db, body.email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")

    if not verify_and_consume_code(db, user.id, "verify_email", body.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")

    user.is_verified = True
    db.commit()

    return _token_response(user)


@router.post(
    "/resend-verification", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(code_send_limit)]
)
def resend_verification(body: ResendVerificationRequest, db: Session = Depends(get_db)) -> None:
    user = _user_by_email(db, body.email)
    # Deliberately silent on a missing/already-verified account — this
    # response doesn't reveal whether the email exists, same reasoning as
    # forgot-password below.
    if user is not None and not user.is_verified:
        _send_code_quietly(db, user, "verify_email", send_verification_code)


@router.post("/sign-in", response_model=TokenResponse, dependencies=[Depends(sign_in_limit)])
def sign_in(body: SignInRequest, db: Session = Depends(get_db)) -> TokenResponse:
    identifier = body.identifier.strip()
    user = (
        db.query(User)
        .filter(or_(User.email_hash == email_index(identifier), User.username == identifier))
        .one_or_none()
    )

    # Google-only accounts have no password until they set one via "Forgot password".
    if user is None or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before signing in")

    return _token_response(user)


def _username_from_email(db: Session, email: str) -> str:
    """A free username from the email's local part, e.g. sam.lifts@… → sam_lifts (or sam_lifts_4821)."""
    base = re.sub(r"[^a-zA-Z0-9_]", "_", email.split("@")[0]).strip("_")[:20] or "athlete"
    if len(base) < 3:
        base = f"{base}_fit"
    candidate = base
    while db.query(User.id).filter(User.username == candidate).first() is not None:
        candidate = f"{base}_{secrets.randbelow(10_000):04d}"
    return candidate


@router.post("/google", response_model=TokenResponse, dependencies=[Depends(sign_in_limit)])
def sign_in_with_google(body: GoogleSignInRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Signs in (or up) with a Google ID token. Matches, in order: the Google
    account already linked to a user; an existing user with the same email
    (Google has verified it, so it's linked); otherwise a new account.
    """
    try:
        identity = verify_google_id_token(body.id_token)
    except (GoogleSignInDisabled, GoogleUnreachable) as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except InvalidGoogleToken as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    sub_hash = keyed_hash(identity.sub, "google-sub")
    user = db.query(User).filter(User.google_sub_hash == sub_hash).one_or_none()
    if user is None:
        user = _user_by_email(db, identity.email)
        if user is not None:
            if not user.is_verified:
                # Someone registered this email without ever proving they own it;
                # Google just proved this person does. Drop the unproven password
                # so its setter can't get into the real owner's account.
                user.password_hash = None
            user.google_sub_hash = sub_hash
            user.is_verified = True
        else:
            email = identity.email.strip().lower()
            user = User(
                email=email,
                email_hash=email_index(email),
                username=_username_from_email(db, email),
                password_hash=None,
                google_sub_hash=sub_hash,
                is_verified=True,
            )
            db.add(user)
        try:
            db.commit()
        except IntegrityError as exc:  # a parallel request created/linked it first
            db.rollback()
            user = db.query(User).filter(User.google_sub_hash == sub_hash).one_or_none()
            if user is None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Please try again.") from exc
        db.refresh(user)

    return _token_response(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user_id = decode_token(body.refresh_token, expected_type="refresh")
    except InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return _token_response(user)


@router.post(
    "/forgot-password", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(code_send_limit)]
)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)) -> None:
    user = _user_by_email(db, body.email)
    # Always 204, whether or not the email exists — otherwise this endpoint
    # becomes a way to check which emails have accounts.
    if user is not None:
        _send_code_quietly(db, user, "reset_password", send_password_reset_code)


@router.post("/reset-password", response_model=TokenResponse, dependencies=[Depends(code_check_limit)])
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = _user_by_email(db, body.email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")

    if not verify_and_consume_code(db, user.id, "reset_password", body.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")

    user.password_hash = hash_password(body.new_password)
    db.commit()

    return _token_response(user)


@router.patch("/username", response_model=UsernameResponse)
def update_username(
    body: UpdateUsernameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UsernameResponse:
    if body.username == current_user.username:
        return UsernameResponse(username=current_user.username)

    taken = db.query(User).filter(User.username == body.username, User.id != current_user.id).one_or_none()
    if taken is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That username is already taken")

    current_user.username = body.username
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That username is already taken") from exc

    return UsernameResponse(username=current_user.username)


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:1]}{'•' * max(1, min(len(local) - 1, 6))}@{domain}"


@router.post("/password/code", response_model=PasswordCodeResponse, dependencies=[Depends(code_send_limit)])
def send_password_code(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PasswordCodeResponse:
    """Emails a signed-in, Google-only user the code that lets them set a password."""
    if current_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Your account already has a password — change it with your current one."
        )
    try:
        code = create_code(db, current_user.id, "reset_password")
    except TooManyCodesRequested as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    try:
        send_set_password_code(current_user.email, code)
    except EmailSendError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=EMAIL_UNAVAILABLE) from exc
    return PasswordCodeResponse(sent_to=_mask_email(current_user.email))


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(code_check_limit)])
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """
    Changes the password (current password required) or, for Google-only
    accounts, sets the first one (emailed code required). Google sign-in keeps
    working either way.
    """
    if current_user.password_hash:
        if not body.current_password or not verify_password(body.current_password, current_user.password_hash):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your current password isn't right.")
    elif not body.code or not verify_and_consume_code(db, current_user.id, "reset_password", body.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")

    current_user.password_hash = hash_password(body.new_password)
    db.commit()


@router.post("/delete-account", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(sign_in_limit)])
def delete_account(
    body: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """
    Permanently deletes the signed-in user and everything they own. Every
    table references users with ON DELETE CASCADE, so one delete removes
    profile, workouts and sets, measurements, plans, personal records,
    feedback, API keys and email codes; progress-photo files on disk are
    removed here too. Needs the password again (or, for Google-only accounts,
    the username typed out) so an unlocked device alone can't do it.
    """
    if current_user.password_hash:
        if not body.password or not verify_password(body.password, current_user.password_hash):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="That password isn't right.")
    elif (body.confirm_username or "").strip() != current_user.username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Type your username exactly to confirm.")

    user_id = current_user.id
    db.delete(current_user)
    db.commit()

    photo_dir = Path(settings.storage_dir) / "progress_photos" / str(user_id)
    try:
        shutil.rmtree(photo_dir)
    except FileNotFoundError:
        pass
    except OSError:
        # The account is already gone; leftover files are only reachable by that
        # (now deleted) user id, so log for cleanup rather than fail the request.
        logger.exception("Couldn't remove progress photos for deleted user %s", user_id)
