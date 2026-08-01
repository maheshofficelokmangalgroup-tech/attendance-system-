"""User + RefreshToken repository."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.user import User, RefreshToken, Role
from app.repository.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, db: Session):
        super().__init__(User, db)

    def get_by_email(self, email: str) -> Optional[User]:
        return (
            self.db.query(User)
            .options(joinedload(User.role), joinedload(User.employee))
            .filter(User.email == email.lower())
            .first()
        )

    def get_by_username_or_email(self, identifier: str) -> Optional[User]:
        """Login lookup: matches either the real email or the username
        (e.g. "Rohan@YRK"), whichever was provided. Username comparison is
        case-insensitive to match how people actually type it."""
        return (
            self.db.query(User)
            .options(joinedload(User.role), joinedload(User.employee))
            .filter(
                (User.email == identifier.lower())
                | (User.username.isnot(None) & (func.lower(User.username) == identifier.lower()))
            )
            .first()
        )

    def get_with_role(self, user_id: int) -> Optional[User]:
        return (
            self.db.query(User)
            .options(joinedload(User.role), joinedload(User.employee))
            .filter(User.id == user_id)
            .first()
        )

    def get_role_by_id(self, role_id: int) -> Optional[Role]:
        return self.db.get(Role, role_id)

    def get_role_by_slug(self, slug: str) -> Optional[Role]:
        return self.db.query(Role).filter(Role.slug == slug).first()

    def update_last_login(self, user: User) -> None:
        user.last_login = datetime.now(timezone.utc)
        self.db.flush()


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    def __init__(self, db: Session):
        super().__init__(RefreshToken, db)

    def get_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        return (
            self.db.query(RefreshToken)
            .filter(
                RefreshToken.token_hash == token_hash,
                RefreshToken.is_revoked == False,  # noqa: E712
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
            .first()
        )

    def revoke(self, token: RefreshToken) -> None:
        token.is_revoked = True
        self.db.flush()

    def revoke_all_for_user(self, user_id: int) -> None:
        """Revoke every active refresh token for a user (e.g. on password change)."""
        self.db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.is_revoked == False,  # noqa: E712
        ).update({"is_revoked": True})
        self.db.flush()
