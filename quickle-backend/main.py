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
from database import get_db
from models import User

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

# 6. USER STATS ENDPOINT
@app.get("/api/user/stats")
async def get_stats(request: Request, db: Session = Depends(get_db)):
    session_id = request.cookies.get("session_id")
    
    if not session_id:
        return {
            "gamesPlayed": 0,
            "winPercentage": 0,
            "currentStreak": 0,
            "maxStreak": 0,
            "is_logged_in": False
        }

    user = db.query(User).filter(User.id == int(session_id)).first()
    if not user:
        return {"error": "User not found"}

    return {
        "username": user.username,
        "gamesPlayed": 15, 
        "winPercentage": 60,
        "currentStreak": 5,
        "maxStreak": 8,
        "is_logged_in": True
    }

@app.get("/")
async def root():
    return {"message": "Quickle API is running"}