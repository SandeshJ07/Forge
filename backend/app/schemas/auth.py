import re
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")
CODE_PATTERN = re.compile(r"^\d{6}$")


def _validate_username(value: str) -> str:
    if not USERNAME_PATTERN.match(value):
        raise ValueError("Username can only contain letters, numbers, and underscores")
    return value


class SignUpRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=6)

    _check_username = field_validator("username")(_validate_username)


class GoogleSignInRequest(BaseModel):
    # The ID token (a JWT) from Google Sign-In on the device.
    id_token: str = Field(min_length=20, max_length=4096)


class UpdateUsernameRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)

    _check_username = field_validator("username")(_validate_username)


class ChangePasswordRequest(BaseModel):
    # Accounts with a password prove it's them with current_password. Google-only
    # accounts (no password yet) use a code emailed by POST /auth/password/code.
    current_password: str | None = Field(default=None, max_length=200)
    code: str | None = Field(default=None, pattern=CODE_PATTERN.pattern)
    new_password: str = Field(min_length=6, max_length=200)


class PasswordCodeResponse(BaseModel):
    # e.g. "s•••••@gmail.com" — enough to recognise, not the full address.
    sent_to: str


class DeleteAccountRequest(BaseModel):
    # Accounts with a password must re-enter it; Google-only accounts (no
    # password) confirm by typing their username instead.
    password: str | None = Field(default=None, max_length=200)
    confirm_username: str | None = Field(default=None, max_length=30)


class UsernameResponse(BaseModel):
    username: str


class SignUpResponse(BaseModel):
    message: str = "Verification code sent. Check your email."
    email: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(pattern=CODE_PATTERN.pattern)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class SignInRequest(BaseModel):
    # Accepts either a username or an email address in the same field —
    # the backend figures out which by checking for "@".
    identifier: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: UUID
    username: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(pattern=CODE_PATTERN.pattern)
    new_password: str = Field(min_length=6)
