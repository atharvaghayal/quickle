from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import random
from typing import Optional

# --- FIX: Changed relative import (.auth) to absolute import (auth) ---
from auth import auth_router 

# --- WORD LIST DEPENDENCY ---
# Ensure this is installed: pip install wordfreq
try:
    from wordfreq import top_n_list
    # Generate a large set of valid 5-letter words
    FIVE_LETTER_WORDS = [w.upper() for w in top_n_list("en", 500000) if len(w) == 5]
    VALID_GUESSES = set(FIVE_LETTER_WORDS) 
    TARGET_WORD_CANDIDATES = FIVE_LETTER_WORDS[:5000] # Use common words for daily word
except Exception as e:
    print(f"FATAL WORD LIST ERROR: {e}. Using small fallback list.")
    # Fallback list if wordfreq or data loading fails
    TARGET_WORD_CANDIDATES = ["QUICK", "LEAVE", "TRAIN", "APPLE", "HOUSE", "POINT"]
    VALID_GUESSES = set(TARGET_WORD_CANDIDATES)


# --- CONFIGURATION (Cleaned) ---
FRONTEND_ORIGIN = "http://localhost:3000"
BACKEND_BASE = "http://localhost:8000"

app = FastAPI()

# --- CORS Configuration ---
origins = [
    FRONTEND_ORIGIN,
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include the Authentication Router ---
app.include_router(auth_router, prefix="/api")

# --- Global Game State & Word Logic ---
TODAY_WORD = ""
GAME_DATE = datetime.now().date()
USED_WORDS = set()


def get_daily_word():
    """Selects a new word if the day changes, ensuring it hasn't been used."""
    global GAME_DATE, TODAY_WORD, USED_WORDS

    current_date = datetime.now().date()
    if current_date != GAME_DATE or not TODAY_WORD:
        GAME_DATE = current_date
        
        available_targets = list(set(TARGET_WORD_CANDIDATES) - USED_WORDS)
        if not available_targets:
            USED_WORDS.clear()
            available_targets = TARGET_WORD_CANDIDATES
        
        TODAY_WORD = random.choice(available_targets)
        USED_WORDS.add(TODAY_WORD)
        print(f"New Daily Word: {TODAY_WORD}")
    
    return TODAY_WORD


def compare_guess(guess: str, target: str):
    """Compares guess against target word and returns an array of statuses."""
    target_letters = list(target.upper())
    guess_letters = list(guess.upper())
    statuses = [0] * 5

    # 1. Check for Green (Exact Match)
    for i in range(5):
        if guess_letters[i] == target_letters[i]:
            statuses[i] = 2
            target_letters[i] = None
            guess_letters[i] = None

    # 2. Check for Yellow (Present in wrong spot)
    for i in range(5):
        if guess_letters[i] is not None:
            try:
                j = target_letters.index(guess_letters[i])
                statuses[i] = 1
                target_letters[j] = None
            except ValueError:
                pass

    status_map = {0: "absent", 1: "present", 2: "correct"}
    return [status_map[s] for s in statuses]


# --- API Endpoints ---

@app.get("/api/wordle/daily-word")
async def get_word():
    """Initial endpoint to get the game status and word for the frontend loss display."""
    word = get_daily_word()
    return {"word_length": 5, "max_guesses": 6, "word": word}


@app.post("/api/wordle/guess")
async def verify_guess(guess_data: dict):
    """Endpoint to verify a user's guess and return the status array."""
    guess = guess_data.get("guess")
    if not guess or len(guess) != 5:
        raise HTTPException(status_code=400, detail="Invalid guess length.")

    guess = guess.upper()

    # --- WORD VALIDITY CHECK ---
    if guess not in VALID_GUESSES:
        raise HTTPException(status_code=422, detail="Word not found in dictionary.")

    target = get_daily_word()
    status_array = compare_guess(guess, target)
    is_correct = all(s == "correct" for s in status_array)

    return {"status_array": status_array, "is_correct": is_correct}


@app.get("/api/wordle/next-reset")
async def get_reset_time():
    """Calculates the time until the next midnight."""
    now = datetime.now()
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    time_remaining_seconds = (midnight - now).total_seconds()
    return {"time_remaining_seconds": int(time_remaining_seconds)}


@app.get("/api/user/stats")
async def get_user_stats(user_id: Optional[int] = None):
    """Placeholder for User Statistics (Anonymous always has user_id=0)."""
    
    # Check if the user is authenticated (user_id is provided or not None)
    is_logged_in = user_id is not None and user_id != 0

    stats = {
        # These are static placeholders for anonymous/unauthenticated users
        "times_played": 15,
        "streak": 5,
        "max_streak": 8,
        "win_percentage": 60.00,
        "is_logged_in": is_logged_in,
    }
    return stats