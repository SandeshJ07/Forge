"""Verifies Google Sign-In ID tokens sent by the app (POST /auth/google)."""

import logging
from dataclasses import dataclass

import requests
from google.auth.exceptions import TransportError
from google.auth.transport.requests import Request
from google.oauth2 import id_token

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)
_session = requests.Session()


class GoogleSignInDisabled(Exception):
    pass


class InvalidGoogleToken(Exception):
    pass


class GoogleUnreachable(Exception):
    pass


@dataclass
class GoogleIdentity:
    sub: str
    email: str
    name: str | None


def verify_google_id_token(token: str) -> GoogleIdentity:
    """
    Checks the token's signature against Google's published keys, its issuer,
    expiry, and that it was issued to one of our client IDs; then that Google
    has verified the email. Only then is the email trusted to identify a user.
    """
    client_ids = settings.google_client_id_list
    if not client_ids:
        raise GoogleSignInDisabled("Google sign-in isn't set up on this server.")
    try:
        # A fresh token's "issued at" can be a second or two ahead of this server's
        # clock; with the library's default of zero tolerance that fails as "used too early".
        claims = id_token.verify_oauth2_token(
            token, Request(session=_session), audience=client_ids, clock_skew_in_seconds=10
        )
    except TransportError as exc:  # couldn't fetch Google's signing keys
        raise GoogleUnreachable("Couldn't reach Google to check your sign-in. Please try again.") from exc
    except ValueError as exc:
        # e.g. wrong audience (client ID mismatch), expired, bad signature. No secrets in the message.
        logger.warning("Google ID token rejected: %s", exc)
        raise InvalidGoogleToken("Google sign-in failed. Please try again.") from exc
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise InvalidGoogleToken("Google sign-in failed. Please try again.")
    if not claims.get("email") or not claims.get("email_verified"):
        raise InvalidGoogleToken("Your Google account's email isn't verified.")
    return GoogleIdentity(sub=str(claims["sub"]), email=str(claims["email"]), name=claims.get("name"))
