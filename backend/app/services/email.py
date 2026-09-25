import logging
import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr

import httpx

from app.core.config import get_settings

settings = get_settings()


logger = logging.getLogger(__name__)


class EmailSendError(Exception):
    """The mail server couldn't be reached or refused the message. Callers turn this into a user-facing 503."""


def _print_fallback(to_address: str, subject: str, body: str) -> None:
    # Local dev without an email provider configured: log the code instead of
    # failing, so sign-up/reset flows stay testable. Deliberate, not an error path.
    print(f"[email:dev-fallback] to={to_address} subject={subject!r}\n{body}")


def _send_smtp(to_address: str, subject: str, body: str) -> None:
    message = MIMEText(body)
    message["Subject"] = subject
    message["From"] = formataddr((settings.email_from_name, settings.smtp_from_address))
    message["To"] = to_address

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(settings.smtp_from_address, [to_address], message.as_string())
    except (smtplib.SMTPException, OSError) as exc:
        # OSError covers DNS failures, refused connections and timeouts — and
        # "Network is unreachable" on hosts that block outbound SMTP ports.
        logger.exception("Failed to send %r email via %s:%s", subject, settings.smtp_host, settings.smtp_port)
        raise EmailSendError(str(exc)) from exc


def _post(provider: str, url: str, headers: dict, payload: dict, subject: str) -> None:
    try:
        response = httpx.post(url, headers=headers, json=payload, timeout=15)
    except httpx.HTTPError as exc:
        logger.exception("Failed to send %r email via %s", subject, provider)
        raise EmailSendError(str(exc)) from exc
    if response.status_code >= 300:
        # The body explains what's wrong (unverified sender, bad key, quota); never log the key.
        logger.error("%s rejected %r email: HTTP %s %s", provider, subject, response.status_code, response.text[:500])
        raise EmailSendError(f"{provider} returned HTTP {response.status_code}")


def _send_brevo(to_address: str, subject: str, body: str) -> None:
    _post(
        "Brevo",
        "https://api.brevo.com/v3/smtp/email",
        {"api-key": settings.email_api_key, "accept": "application/json"},
        {
            "sender": {"name": settings.email_from_name, "email": settings.smtp_from_address},
            "to": [{"email": to_address}],
            "subject": subject,
            "textContent": body,
        },
        subject,
    )


def _send_resend(to_address: str, subject: str, body: str) -> None:
    _post(
        "Resend",
        "https://api.resend.com/emails",
        {"Authorization": f"Bearer {settings.email_api_key}"},
        {
            "from": formataddr((settings.email_from_name, settings.smtp_from_address)),
            "to": [to_address],
            "subject": subject,
            "text": body,
        },
        subject,
    )


def _send(to_address: str, subject: str, body: str) -> None:
    provider = settings.email_provider
    if provider == "smtp":
        if not settings.smtp_host:
            return _print_fallback(to_address, subject, body)
        return _send_smtp(to_address, subject, body)
    if not settings.email_api_key:
        return _print_fallback(to_address, subject, body)
    if provider == "brevo":
        return _send_brevo(to_address, subject, body)
    return _send_resend(to_address, subject, body)


def send_verification_code(to_address: str, code: str) -> None:
    _send(
        to_address,
        subject="Verify your Forge account",
        body=(
            f"Your verification code is: {code}\n\n"
            f"Enter this in the app to verify your email. It expires in {settings.email_code_expire_minutes} minutes.\n\n"
            "If you didn't create a Forge account, you can ignore this email."
        ),
    )


def send_password_reset_code(to_address: str, code: str) -> None:
    _send(
        to_address,
        subject="Reset your Forge password",
        body=(
            f"Your password reset code is: {code}\n\n"
            f"Enter this in the app along with your new password. It expires in {settings.email_code_expire_minutes} minutes.\n\n"
            "If you didn't request a password reset, you can ignore this email."
        ),
    )
