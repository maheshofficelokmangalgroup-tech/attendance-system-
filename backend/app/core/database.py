from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import NullPool
from typing import Generator

from app.core.config import settings


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,           # SQL logging in dev only
    pool_pre_ping=True,            # detect stale connections
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,             # recycle connections every hour
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ---------------------------------------------------------------------------
# Base model
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    """All ORM models inherit from this — keeps Alembic autogenerate working."""
    pass


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def get_db() -> Generator:
    """
    Yield a DB session and guarantee it closes after the request.
    Usage: `db: Session = Depends(get_db)`
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
