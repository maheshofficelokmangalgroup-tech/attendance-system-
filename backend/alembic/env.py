"""Alembic env.py — reads DATABASE_URL from app settings."""
import sys
import os
from logging.config import fileConfig

from sqlalchemy import create_engine, pool
from alembic import context

# Add backend/ to sys.path so app imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.core.database import Base

# Import all models so Alembic autogenerate sees every table
import app.models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# The DB URL is passed straight to SQLAlchemy below rather than through
# `config.set_main_option()` / alembic.ini, because a URL-encoded password
# (e.g. "@" -> "%40") contains "%", which ConfigParser's interpolation
# treats as special syntax and rejects.


def run_migrations_offline() -> None:
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(settings.DATABASE_URL, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
