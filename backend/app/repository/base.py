"""Base repository with generic CRUD helpers."""
from __future__ import annotations
from typing import Generic, List, Optional, Type, TypeVar
from sqlalchemy.orm import Session
from app.core.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], db: Session):
        self.model = model
        self.db = db

    def get(self, id: int) -> Optional[ModelType]:
        return self.db.get(self.model, id)

    def get_locked(self, id: int) -> Optional[ModelType]:
        """Fetch a row with a DB-level write lock (SELECT ... FOR UPDATE).

        Used for read-modify-write flows (approvals, cancellations, balance
        updates) so two concurrent requests can't both read the same stale
        status/balance and double-apply a state transition.
        """
        return (
            self.db.query(self.model)
            .filter(self.model.id == id)
            .with_for_update()
            .first()
        )

    def get_all(self, skip: int = 0, limit: int = 20) -> List[ModelType]:
        return self.db.query(self.model).offset(skip).limit(limit).all()

    def count(self) -> int:
        return self.db.query(self.model).count()

    def create(self, obj: ModelType) -> ModelType:
        self.db.add(obj)
        self.db.flush()   # get ID without committing — outer service commits
        self.db.refresh(obj)
        return obj

    def delete(self, obj: ModelType) -> None:
        self.db.delete(obj)
        self.db.flush()

    def save(self) -> None:
        """Commit the current transaction."""
        self.db.commit()
