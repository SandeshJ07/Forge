import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

import httpx

from app.core.config import get_settings
from app.services.email_templates import (
    RenderedEmail,
    password_reset_email,
    set_password_email,
    verification_email,
)

settings = get_settings()


logger = logging.getLogger(__name__)


class EmailSendError(Exception):
    """The mail server couldn't be reached or refused the message. Callers turn this into a user-facing 503."""


def _print_fallback(to_address: str, subject: str, body: str) -> None:
    # Local dev without an email provider configured: log the code instead of
    # failing, so sign-up/reset flows stay testable. Deliberate, not an error path.
    print(f"[email:dev-fallback] to={to_address} subject={subject!r}\n{body}")


def _send_smtp(to_address: str, email: RenderedEmail) -> None:
    message = MIMEMultipart("alternative")
    message["Subject"] = email.subject
    message["From"] = formataddr((settings.email_from_name, settings.smtp_from_address))
    message["To"] = to_address
    # Plain text first, HTML last: clients show the last part they can render.
    message.attach(MIMEText(email.text, "plain", "utf-8"))
    message.attach(MIMEText(email.html, "html", "utf-8"))

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
        logger.exception("Failed to send %r email via %s:%s", email.subject, settings.smtp_host, settings.smtp_port)
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


def _send_brevo(to_address: str, email: RenderedEmail) -> None:
    _post(
        "Brevo",
        "https://api.brevo.com/v3/smtp/email",
        {"api-key": settings.email_api_key, "accept": "application/json"},
        {
            "sender": {"name": settings.email_from_name, "email": settings.smtp_from_address},
            "to": [{"email": to_address}],
            "subject": email.subject,
            "htmlContent": email.html,
            "textContent": email.text,
        },
        email.subject,
    )


def _send_resend(to_address: str, email: RenderedEmail) -> None:
    _post(
        "Resend",
        "https://api.resend.com/emails",
        {"Authorization": f"Bearer {settings.email_api_key}"},
        {
            "from": formataddr((settings.email_from_name, settings.smtp_from_address)),
            "to": [to_address],
            "subject": email.subject,
            "html": email.html,
            "text": email.text,
        },
        email.subject,
    )


def _send(to_address: str, email: RenderedEmail) -> None:
    provider = settings.email_provider
    if provider == "smtp":
        if not settings.smtp_host:
            return _print_fallback(to_address, email.subject, email.text)
        return _send_smtp(to_address, email)
    if not settings.email_api_key:
        return _print_fallback(to_address, email.subject, email.text)
    if provider == "brevo":
        return _send_brevo(to_address, email)
    return _send_resend(to_address, email)


def send_verification_code(to_address: str, code: str) -> None:
    _send(to_address, verification_email(code))


def send_set_password_code(to_address: str, code: str) -> None:
    _send(to_address, set_password_email(code))


def send_password_reset_code(to_address: str, code: str) -> None:
    _send(to_address, password_reset_email(code))
