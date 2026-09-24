"""
Database engine and session management.
Uses SQLite with NullPool for Docker-friendly concurrency.
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session

from config import DATABASE_URL

# SQLite-specific: use StaticPool for single-file DB with concurrent access
# Enable WAL mode for better read concurrency
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
    poolclass=StaticPool,
    echo=False,
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable WAL mode and foreign keys for SQLite."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.close()


SessionLocal = sessionmaker(class_=Session, autocommit=False, autoflush=False, bind=engine)


def get_session():
    """Dependency for FastAPI route injection."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def init_db():
    """Create all tables. Called at startup."""
    SQLModel.metadata.create_all(engine)


def auto_migrate():
    """
    Add missing columns to existing tables.
    This is a lightweight migration strategy for SQLite —
    checks each model field and ALTERs the table if the column is missing.
    """
    from sqlalchemy import inspect, text
    from models import (
        Player, Match, ParsedReplay, MatchAnalysis,
        ProgressSnapshot, HeroMeta, HeroMatchup,
        ProMeta, ActionItem, UserSettings
    )

    inspector = inspect(engine)
    all_models = [
        Player, Match, ParsedReplay, MatchAnalysis,
        ProgressSnapshot, HeroMeta, HeroMatchup,
        ProMeta, ActionItem, UserSettings
    ]

    with engine.connect() as conn:
        for model in all_models:
            table_name = model.__tablename__
            if not inspector.has_table(table_name):
                continue

            existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
            model_cols = {col.name for col in model.__table__.columns}
            missing = model_cols - existing_cols

            for col_name in missing:
                col = model.__table__.columns[col_name]
                col_type = col.type.compile(dialect=engine.dialect)
                default = ""
                if col.default is not None:
                    default = f" DEFAULT {col.default.arg!r}"
                elif col.nullable:
                    default = " DEFAULT NULL"

                stmt = text(
                    f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}{default}"
                )
                conn.execute(stmt)
                print(f"[migrate] Added column {table_name}.{col_name} ({col_type})")

        conn.commit()
