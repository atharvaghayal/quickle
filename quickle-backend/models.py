# --- File: models.py ---

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    """
    Defines the 'users' table structure.
    """
    __tablename__ = "users"

    # Primary Key
    id = Column(Integer, primary_key=True, index=True)
    
    # Username (Used for login/email field in frontend)
    username = Column(String(20), unique=True, index=True, nullable=False)
    
    # Securely Hashed Password
    hashed_password = Column(String, nullable=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Optional: You can add more user fields here (e.g., score, total_wins, etc.)