"""
HTML + plain-text bodies for the emails Forge sends (all of them carry a
6-digit code). One shared layout in the app's colours: dark background, card
surface, orange accent. Email-client safe: table layout, inline styles, no
external CSS or web fonts; the logo is a normal image from APP_URL, so the
wordmark still reads if images are blocked.
"""

from dataclasses import dataclass
from html import escape

from app.core.config import get_settings

settings = get_settings()

# Mirrors frontend/src/constants/theme.ts.
BG = "#0B0E11"
SURFACE = "#161A1F"
SURFACE_ALT = "#1F242B"
BORDER = "#2A3038"
TEXT = "#F5F7FA"
MUTED = "#9AA4B2"
PRIMARY = "#FF5A36"
FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"


@dataclass
class RenderedEmail:
    subject: str
    text: str
    html: str


def _layout(*, preheader: str, heading: str, intro: str, code: str, after: str, footer: str) -> str:
    app_url = settings.app_url.rstrip("/")
    logo = (
        f'<img src="{escape(app_url)}/icon-192.png" width="40" height="40" alt="" '
        f'style="display:block;border:0;border-radius:10px;">'
        if app_url
        else ""
    )
    button = (
        f"""<tr><td align="center" style="padding:8px 32px 28px;">
          <a href="{escape(app_url)}" style="display:inline-block;background:{PRIMARY};color:#FFFFFF;font-family:{FONT};
             font-size:15px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:12px;">Open Forge</a>
        </td></tr>"""
        if app_url
        else ""
    )
    # Digits spaced apart so the code is easy to read and to copy without the spaces.
    spaced_code = "".join(f'<span style="display:inline-block;padding:0 3px;">{d}</span>' for d in escape(code))
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>{escape(heading)}</title>
</head>
<body style="margin:0;padding:0;background:{BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{BG}" style="background:{BG};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
      <tr><td style="padding:0 4px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          {f'<td style="padding-right:10px;vertical-align:middle;">{logo}</td>' if logo else ''}
          <td style="vertical-align:middle;font-family:{FONT};font-size:22px;font-weight:800;color:{TEXT};letter-spacing:-0.3px;">Forge</td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="{SURFACE}" style="background:{SURFACE};border:1px solid {BORDER};border-top:4px solid {PRIMARY};border-radius:20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:28px 32px 8px;font-family:{FONT};">
            <h1 style="margin:0 0 10px;font-size:22px;line-height:28px;font-weight:800;color:{TEXT};">{escape(heading)}</h1>
            <p style="margin:0;font-size:15px;line-height:22px;color:{MUTED};">{escape(intro)}</p>
          </td></tr>
          <tr><td align="center" style="padding:20px 32px;">
            <div style="background:{SURFACE_ALT};border:1px solid {BORDER};border-radius:14px;padding:18px 12px;
                        font-family:'SF Mono', Menlo, Consolas, 'Courier New', monospace;font-size:34px;line-height:40px;
                        font-weight:700;letter-spacing:2px;color:{PRIMARY};">{spaced_code}</div>
          </td></tr>
          <tr><td style="padding:0 32px 20px;font-family:{FONT};">
            <p style="margin:0;font-size:14px;line-height:21px;color:{MUTED};">{escape(after)}</p>
          </td></tr>
          {button}
        </table>
      </td></tr>
      <tr><td style="padding:20px 8px 0;font-family:{FONT};font-size:12px;line-height:18px;color:{MUTED};text-align:center;">
        {escape(footer)}<br>Forge — your training, compounding.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""


def _email(*, subject: str, heading: str, intro: str, code: str, after: str, footer: str) -> RenderedEmail:
    text = f"{heading}\n\n{intro}\n\n    {code}\n\n{after}\n\n{footer}\n"
    if settings.app_url:
        text += f"\nOpen Forge: {settings.app_url}\n"
    html = _layout(preheader=f"Your code is {code}", heading=heading, intro=intro, code=code, after=after, footer=footer)
    return RenderedEmail(subject=subject, text=text, html=html)


def verification_email(code: str) -> RenderedEmail:
    minutes = settings.email_code_expire_minutes
    return _email(
        subject="Verify your Forge account",
        heading="Confirm your email",
        intro="Welcome to Forge! Enter this code in the app to verify your email and finish creating your account.",
        code=code,
        after=f"The code expires in {minutes} minutes.",
        footer="If you didn't create a Forge account, you can ignore this email.",
    )


def password_reset_email(code: str) -> RenderedEmail:
    minutes = settings.email_code_expire_minutes
    return _email(
        subject="Reset your Forge password",
        heading="Reset your password",
        intro="Enter this code in the app along with your new password.",
        code=code,
        after=f"The code expires in {minutes} minutes.",
        footer="If you didn't ask to reset your password, you can ignore this email — your password stays the same.",
    )


def set_password_email(code: str) -> RenderedEmail:
    minutes = settings.email_code_expire_minutes
    return _email(
        subject="Set a password for your Forge account",
        heading="Set a password",
        intro="Enter this code in Forge's Settings with your new password. You'll then be able to sign in with your "
        "email or username as well as with Google.",
        code=code,
        after=f"The code expires in {minutes} minutes.",
        footer="If you didn't ask for this, you can ignore this email — nothing changes without the code.",
    )
