from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: UUID
