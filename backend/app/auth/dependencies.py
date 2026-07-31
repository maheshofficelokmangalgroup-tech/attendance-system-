"""
FastAPI dependency functions for authentication and RBAC.

Usage in route handlers:
    @router.get("/employees")
    def list_employees(
        current_user: User = Depends(get_current_user),
        _: None = Depends(require_permission("view", "employee")),
        db: Session = Depends(get_db),
    ):
        ...
"""
from typing import Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.auth.rbac import role_has_permission

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Validate Bearer token and return the authenticated User.
    Raises 401 if token is missing, expired, or tampered.
    Raises 403 if the user account is deactivated.
    """
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        user_id: int = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    return user


def require_permission(action: str, resource: str) -> Callable:
    """
    Factory that returns a FastAPI dependency enforcing a specific permission.

    Example:
        Depends(require_permission("create", "employee"))
    """
    def _check(current_user: User = Depends(get_current_user)) -> User:
        role_slug = current_user.role.slug if current_user.role else ""
        if not role_has_permission(role_slug, action, resource):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {action}:{resource}",
            )
        return current_user

    # Give the dependency a unique __name__ so FastAPI's OpenAPI schema
    # shows the correct security requirement per endpoint
    _check.__name__ = f"require_{action}_{resource}"
    return _check


def get_current_active_employee(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Convenience dependency: ensures the logged-in user has an employee record.
    Raises 403 if the user is a system-only account without an employee link.
    """
    if current_user.employee_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not linked to an employee record",
        )
    return current_user
