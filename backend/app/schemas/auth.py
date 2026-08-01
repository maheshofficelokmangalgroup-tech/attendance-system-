"""Pydantic v2 DTOs — Auth flows."""
from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import validate_password_strength


class LoginRequest(BaseModel):
    # Accepts either a real email address or a username (e.g. "Rohan@YRK").
    # Kept as a plain string (not EmailStr) specifically so username-style
    # logins aren't rejected at the validation layer.
    email: str = Field(min_length=1)
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    refresh_token: str
    user: "UserInToken"


class UserInToken(BaseModel):
    id: int
    email: str
    role: str           # slug
    role_name: str
    # employee_id is the internal employees.id PK — never show this to users.
    # employee_code is the human-facing ID (e.g. "009") from the HR sheet.
    employee_id: int | None
    employee_code: str | None
    full_name: str | None

    model_config = {"from_attributes": True}


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_must_be_strong(cls, v: str) -> str:
        if not validate_password_strength(v):
            raise ValueError(
                "Password must be at least 8 characters and include uppercase, "
                "lowercase, digit, and special character"
            )
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_must_be_strong(cls, v: str) -> str:
        if not validate_password_strength(v):
            raise ValueError(
                "Password must be at least 8 characters and include uppercase, "
                "lowercase, digit, and special character"
            )
        return v
