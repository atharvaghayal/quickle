import os
from pathlib import Path
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# 1. LOAD ENVIRONMENT VARIABLES
# Using Path(__file__) ensures the .env is found regardless of where you start uvicorn
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

# DEBUG: Verify the keys are loading (Look in your backend terminal)
print(f"DEBUG: Google ID is {os.getenv('GOOGLE_CLIENT_ID')}")

# 2. IMPORT INTERNAL MODULES
# Using absolute imports (no dots) to prevent 'ImportError'
from auth import auth_router
from database import get_db, engine
from models import User, UserStats, Base

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Quickle Wordle Backend")

# 3. SESSION MIDDLEWARE
# Must be added BEFORE including the auth_router. 
# Uses a fallback key if the .env variable is missing to prevent TypeError.
app.add_middleware(
    SessionMiddleware, 
    secret_key=os.getenv("SESSION_SECRET_KEY", "temporary_dev_secret_123")
)

# 4. CORS MIDDLEWARE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. INCLUDE ROUTERS
app.include_router(auth_router)

# --- GAME LOGIC & WORD LIST ---

WORDS = ["REACT", "PYTHON", "SMART", "CLOUD", "LOGIC", "PLATE", "SMILE"]

@app.get("/api/wordle/daily-word")
async def get_daily_word():
    return {"word": "REACT"}

@app.get("/api/wordle/next-reset")
async def get_next_reset():
    # Placeholder for the time remaining until the next word (in seconds)
    return {"time_remaining_seconds": 3600}

@app.post("/api/wordle/guess")
async def verify_guess(payload: dict):
    guess = payload.get("guess", "").upper()
    target_word = "REACT"
    
    # Simple logic for status array
    status_array = []
    for i, char in enumerate(guess):
        if char == target_word[i]:
            status_array.append("correct")
        elif char in target_word:
            status_array.append("present")
        else:
            status_array.append("absent")
            
    return {
        "status_array": status_array,
        "is_correct": guess == target_word
    }

from pydantic import BaseModel
from datetime import datetime, timedelta

# ... existing code ...

class GameResult(BaseModel):
    won: bool
    points: int

# ... existing code ...

@app.post("/api/user/update-stats")
async def update_stats(result: GameResult, request: Request, db: Session = Depends(get_db)):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return {"error": "Not logged in"}

    user = db.query(User).filter(User.id == int(session_id)).first()
    if not user:
        return {"error": "User not found"}

    stats = user.stats
    if not stats:
        # Create stats if not exists
        stats = UserStats(user_id=user.id)
        db.add(stats)
        db.commit()
        db.refresh(stats)

    today = datetime.utcnow().date()
    yesterday = today - timedelta(days=1)

    # Update games played
    stats.games_played += 1

    # Update points
    stats.total_points += result.points

    # Update win stats
    if result.won:
        stats.games_won += 1
        # Check streak
        if stats.last_played_date and stats.last_played_date.date() == yesterday:
            stats.current_streak += 1
        else:
            stats.current_streak = 1
        if stats.current_streak > stats.max_streak:
            stats.max_streak = stats.current_streak
    else:
        stats.current_streak = 0

    stats.last_played_date = datetime.utcnow()

    db.commit()

    return {"message": "Stats updated"}

@app.get("/api/user/stats")
async def get_stats(request: Request, db: Session = Depends(get_db)):
    session_id = request.cookies.get("session_id")
    
    if not session_id:
        return {
            "times_played": 0,
            "streak": 0,
            "max_streak": 0,
            "win_percentage": 0,
            "total_points": 0,
            "is_logged_in": False
        }

    user = db.query(User).filter(User.id == int(session_id)).first()
    if not user:
        return {"error": "User not found"}

    stats = user.stats
    if not stats:
        return {
            "username": user.username,
            "times_played": 0,
            "streak": 0,
            "max_streak": 0,
            "win_percentage": 0,
            "total_points": 0,
            "is_logged_in": True
        }

    win_percentage = (stats.games_won / stats.games_played * 100) if stats.games_played > 0 else 0

    is_ongoing = stats.last_played_date and stats.last_played_date.date() == datetime.utcnow().date() and stats.current_streak > 0

    return {
        "username": user.username,
        "times_played": stats.games_played,
        "streak": stats.current_streak,
        "max_streak": stats.max_streak,
        "win_percentage": round(win_percentage, 2),
        "total_points": stats.total_points,
        "currentStreakOngoing": is_ongoing,
        "is_logged_in": True
    }

@app.get("/")
async def root():
    return {"message": "Quickle API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)