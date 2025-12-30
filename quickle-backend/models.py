from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
# Use an absolute import to match your server startup folder
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    # hashed_password will store BCrypt hashes for manual users
    # or "OAUTH_USER_EXTERNAL" for social users
    hashed_password = Column(String, nullable=False)
    provider = Column(String, nullable=True)  # 'local', 'google', 'github'
    reset_token = Column(String, nullable=True)
    reset_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to stats
    stats = relationship("UserStats", back_populates="owner", uselist=False)
    # Relationship to used words
    used_words = relationship("UsedWords", back_populates="owner")

class UserStats(Base):
    __tablename__ = "user_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)

    games_played = Column(Integer, default=0)
    games_won = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    max_streak = Column(Integer, default=0)
    total_points = Column(Integer, default=0)
    last_played_date = Column(DateTime, nullable=True)

    # Connect back to the user
    owner = relationship("User", back_populates="stats")

class UsedWords(Base):
    __tablename__ = "used_words"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    word = Column(String(5), nullable=False)  # 5-letter words only
    used_at = Column(DateTime, default=datetime.utcnow)

    # Connect back to the user
    owner = relationship("User", back_populates="used_words")