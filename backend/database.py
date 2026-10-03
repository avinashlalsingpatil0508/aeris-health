# database.py
# Sets up the connection to the MySQL database using SQLAlchemy.

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Gives each request its own database session, and closes it when done."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
