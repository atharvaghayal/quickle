from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session
import random

# Import your sub-modules (ensure the dots are correct for package structure)
from .auth import auth_router
from .database import get_db
from .models import User

app = FastAPI(title="Quickle Wordle Backend")

# 1. SESSION MIDDLEWARE (Required for Google/GitHub OAuth state)
# This must come BEFORE the router inclusion
app.add_middleware(SessionMiddleware, secret_key="quickle_secret_1654")

# 2. CORS MIDDLEWARE (Allows your React frontend to talk to this backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. INCLUDE ROUTERS
app.include_router(auth_router)

# --- GAME LOGIC & WORD LIST ---

WORDS = ["REACT", "PYTHON", "SMART", "CLOUD", "LOGIC", "PLATE", "SMILE"]

@app.get("/api/daily-word")
async def get_daily_word():
    # In a real app, this would change based on the date
    return {"word": "REACT"}

@app.post("/api/verify-guess")
async def verify_guess(guess: str):
    target_word = "REACT"
    if guess.upper() == target_word:
        return {"status": "correct"}
    return {"status": "incorrect"}

# 4. USER STATS ENDPOINT (Connected to DB)
@app.get("/api/user/stats")
async def get_stats(request: Request, db: Session = Depends(get_db)):
    # Check for the session cookie we set in auth.py
    session_id = request.cookies.get("session_id")
    
    if not session_id:
        # Return empty stats for anonymous users
        return {
            "gamesPlayed": 0,
            "winPercentage": 0,
            "currentStreak": 0,
            "maxStreak": 0
        }

    # Fetch real data from DB for logged-in users
    user = db.query(User).filter(User.id == int(session_id)).first()
    if not user:
        return {"error": "User not found"}

    # Placeholder: In the next step, we would pull these from a 'UserStats' table
    return {
        "username": user.username,
        "gamesPlayed": 15, 
        "winPercentage": 60,
        "currentStreak": 5,
        "maxStreak": 8
    }

@app.get("/")
async def root():
    return {"message": "Quickle API is running"}