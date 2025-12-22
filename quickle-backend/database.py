# --- File: database.py ---

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. DATABASE URL
# Use 'sqlite:///./users.db' for a local file-based SQLite database
# For production (PostgreSQL), this would be 'postgresql://user:pass@host:port/dbname'
SQLALCHEMY_DATABASE_URL = "sqlite:///./users.db"

# 2. CREATE ENGINE
# connect_args={'check_same_thread': False} is needed only for SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# 3. SESSION MAKER
# The SessionLocal instance is the actual database session.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. BASE CLASS
# Base is used to inherit from to create each database model (table)
Base = declarative_base()

# Dependency: Generator function to get a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()