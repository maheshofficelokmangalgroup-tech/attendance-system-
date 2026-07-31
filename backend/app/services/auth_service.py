"""
Auth service — login, refresh, logout, forgot/reset password, change password.
All business logic lives here; routers only parse request + return response.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    verify_password, hash_password, create_access_token,
    create_refresh_token, hash_token,
    create_password_reset_token, decode_password_reset_token,
)
from app.models.user import User, RefreshToken
from app.repository.user_repo import UserRepository, RefreshTokenRepository
from app.repository.audit_repo import AuditRepository
from app.schemas.auth import LoginRequest, TokenResponse, UserInToken


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.token_repo = RefreshTokenRepository(db)
        self.audit_repo = AuditRepository(db)

    # ------------------------------------------------------------------
    # Login
    # ------------------------------------------------------------------

    def login(
        self,
        payload: LoginRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> TokenResponse:
        user = self.user_repo.get_by_email(payload.email)
        if not user or not verify_password(payload.password, user.password_hash):
            # Log the failed attempt before raising
            self.audit_repo.log(
                user_id=user.id if user else None,
                action="login_failed",
                ip_address=ip_address,
                user_agent=user_agent,
            )
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )

        tokens = self._issue_tokens(user)
        self.user_repo.update_last_login(user)
        self.audit_repo.log(
            user_id=user.id,
            action="login",
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.commit()
        return tokens

    # ------------------------------------------------------------------
    # Refresh
    # ------------------------------------------------------------------

    def refresh(self, raw_refresh_token: str) -> TokenResponse:
        token_hash = hash_token(raw_refresh_token)
        stored = self.token_repo.get_by_hash(token_hash)
        if not stored:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )
        # Rotate: revoke old, issue new
        self.token_repo.revoke(stored)
        user = self.user_repo.get_with_role(stored.user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or deactivated",
            )
        tokens = self._issue_tokens(user)
        self.db.commit()
        return tokens

    # ------------------------------------------------------------------
    # Logout
    # ------------------------------------------------------------------

    def logout(
        self,
        raw_refresh_token: str,
        user_id: int,
        ip_address: Optional[str] = None,
    ) -> None:
        token_hash = hash_token(raw_refresh_token)
        stored = self.token_repo.get_by_hash(token_hash)
        if stored:
            self.token_repo.revoke(stored)
        self.audit_repo.log(
            user_id=user_id,
            action="logout",
            ip_address=ip_address,
        )
        self.db.commit()

    # ------------------------------------------------------------------
    # Forgot / Reset password
    # ------------------------------------------------------------------

    def forgot_password(self, email: str) -> str:
        """
        Returns a reset token (or a stub URL in dev).
        In production this token would be sent via email — the notification
        service (Phase 5) handles delivery.
        """
        user = self.user_repo.get_by_email(email)
        if not user:
            # Don't reveal whether the email exists — return same response
            return ""
        token = create_password_reset_token(user.id)
        return token

    def reset_password(self, token: str, new_password: str) -> None:
        from jose import JWTError
        try:
            user_id = decode_password_reset_token(token)
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token",
            )
        user = self.user_repo.get(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        user.password_hash = hash_password(new_password)
        # Revoke all refresh tokens on password reset
        self.token_repo.revoke_all_for_user(user.id)
        self.audit_repo.log(user_id=user.id, action="password_reset")
        self.db.commit()

    def change_password(self, user: User, current_password: str, new_password: str) -> None:
        if not verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        user.password_hash = hash_password(new_password)
        self.token_repo.revoke_all_for_user(user.id)
        self.audit_repo.log(user_id=user.id, action="password_changed")
        self.db.commit()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _issue_tokens(self, user: User) -> TokenResponse:
        """Create access + refresh token pair and persist the refresh token."""
        employee = user.employee
        extra_claims = {
            "role": user.role.slug,
            "role_name": user.role.name,
            "employee_id": user.employee_id,
        }
        access_token = create_access_token(user.id, extra_claims=extra_claims)
        raw_refresh, hashed_refresh = create_refresh_token()

        refresh_entry = RefreshToken(
            user_id=user.id,
            token_hash=hashed_refresh,
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self.token_repo.create(refresh_entry)

        return TokenResponse(
            access_token=access_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            refresh_token=raw_refresh,
            user=UserInToken(
                id=user.id,
                email=user.email,
                role=user.role.slug,
                role_name=user.role.name,
                employee_id=user.employee_id,
                full_name=employee.full_name if employee else None,
            ),
        )
