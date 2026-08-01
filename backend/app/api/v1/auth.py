"""Auth router — /api/v1/auth"""
from typing import Optional
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.auth_service import AuthService
from app.schemas.auth import (
    LoginRequest, TokenResponse, RefreshRequest,
    LogoutRequest, ForgotPasswordRequest, ResetPasswordRequest,
    ChangePasswordRequest,
)
from app.schemas.common import APIResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _get_client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else request.client.host if request.client else None


@router.post("/login", response_model=APIResponse[TokenResponse], summary="Employee / admin login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    svc = AuthService(db)
    data = svc.login(
        payload,
        ip_address=_get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    return APIResponse(data=data)


@router.post("/refresh", response_model=APIResponse[TokenResponse], summary="Rotate refresh token")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    svc = AuthService(db)
    data = svc.refresh(payload.refresh_token)
    return APIResponse(data=data)


@router.post("/logout", response_model=APIResponse[None], summary="Revoke refresh token")
def logout(
    payload: LogoutRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = AuthService(db)
    svc.logout(payload.refresh_token, current_user.id, ip_address=_get_client_ip(request))
    return APIResponse(message="Logged out successfully")


@router.post("/forgot-password", response_model=APIResponse[None], summary="Request password reset")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    svc = AuthService(db)
    # Token returned here only in dev — production would email it
    token = svc.forgot_password(payload.email)
    return APIResponse(
        message="If that email exists, a reset link has been sent",
        data=None,
    )


@router.post("/reset-password", response_model=APIResponse[None], summary="Reset password with token")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    svc = AuthService(db)
    svc.reset_password(payload.token, payload.new_password)
    return APIResponse(message="Password reset successfully")


@router.post("/change-password", response_model=APIResponse[None], summary="Change own password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = AuthService(db)
    svc.change_password(current_user, payload.current_password, payload.new_password)
    return APIResponse(message="Password changed successfully")


@router.get("/me", response_model=APIResponse, summary="Get current user info")
def me(current_user: User = Depends(get_current_user)):
    from app.schemas.auth import UserInToken
    employee = current_user.employee
    return APIResponse(
        data=UserInToken(
            id=current_user.id,
            email=current_user.email,
            role=current_user.role.slug,
            role_name=current_user.role.name,
            employee_id=current_user.employee_id,
            employee_code=employee.employee_code if employee else None,
            full_name=employee.full_name if employee else None,
        )
    )
