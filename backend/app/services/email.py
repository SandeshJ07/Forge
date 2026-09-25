import logging
import smtplib
from email.mime.text import MIMEText

from app.core.config import get_settings

settings = get_settings()


logger = logging.getLogger(__name__)


class EmailSendError(Exception):
    """The mail server couldn't be reached or refused the message. Callers turn this into a user-facing 503."""


def _send(to_address: str, subject: str, body: str) -> None:
    if not settings.smtp_host:
        # Local dev without SMTP configured: log the code instead of failing
        # outright, so sign-up/reset flows stay testable without a real
        # mail server. Raises nothing — this is a deliberate fallback, not
        # an error path.
        print(f"[email:dev-fallback] to={to_address} subject={subject!r}\n{body}")
        return

    message = MIMEText(body)
    message["Subject"] = subject
    message["From"] = settings.smtp_from_address
    message["To"] = to_address

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(settings.smtp_from_address, [to_address], message.as_string())
    except (smtplib.SMTPException, OSError) as exc:
        # OSError covers DNS failures, refused connections and timeouts.
        logger.exception("Failed to send %r email via %s:%s", subject, settings.smtp_host, settings.smtp_port)
        raise EmailSendError(str(exc)) from exc


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
