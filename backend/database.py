# database.py
# Sets up the MySQL connection using SQLAlchemy.
# Supports both local MySQL and cloud MySQL providers such as Aiven.

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config import settings


# ---------------------------------------------------------
# Database SSL configuration
# ---------------------------------------------------------
# Local MySQL:
#   DB_SSL_MODE=disabled
#
# Aiven / Cloud MySQL:
#   DB_SSL_MODE=required
#
# SSL is enabled through PyMySQL when required.
# This keeps the same database.py working in both environments.

DB_SSL_MODE = os.getenv("DB_SSL_MODE", "disabled").strip().lower()

connect_args = {}

if DB_SSL_MODE == "required":
    connect_args["ssl"] = {}


# ---------------------------------------------------------
# SQLAlchemy Engine
# ---------------------------------------------------------
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args=connect_args,
)


# ---------------------------------------------------------
# Database Session
# ---------------------------------------------------------
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ---------------------------------------------------------
# Base model
# ---------------------------------------------------------
Base = declarative_base()


# ---------------------------------------------------------
# FastAPI database dependency
# ---------------------------------------------------------
def get_db():
    """Gives each request its own database session and
    closes it when the request is finished."""

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()