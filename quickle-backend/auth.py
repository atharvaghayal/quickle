import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel
from typing import Optional
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# 1. LOAD ENVIRONMENT VARIABLES
# Explicitly find the .env file in the current folder
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

# 2. ABSOLUTE IMPORTS (No dots, to prevent ImportError)
from database import get_db
from models import User

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])

# 3. PASSWORD HASHING
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 4. SCHEMAS
class UserAuth(BaseModel):
    username: str  # Matches frontend 'payload' key
    password: str

# 6. HELPER FUNCTIONS
def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

# --- TRADITIONAL AUTH ROUTES ---

@auth_router.post("/signup")
async def signup(user: UserAuth, db: Session = Depends(get_db)):
    if get_user_by_username(db, user.username):
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_pwd = pwd_context.hash(user.password)
    new_user = User(username=user.username, hashed_password=hashed_pwd, provider='local')
    db.add(new_user)
    db.commit()
    return {"message": "User created successfully"}

@auth_router.post("/login")
async def login(user: UserAuth, response: Response, db: Session = Depends(get_db)):
    db_user = get_user_by_username(db, user.username)
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Set the session cookie
    response.set_cookie(
        key="session_id", value=str(db_user.id),
        httponly=True, samesite="Lax", max_age=2592000
    )
    return {"message": "Login successful"}

# --- SESSION CHECK ROUTE (Fixes frontend loading) ---

@auth_router.get("/me")
async def get_me(request: Request, db: Session = Depends(get_db)):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return {"user": None}

    user = db.query(User).filter(User.id == int(session_id)).first()
    if not user:
        return {"user": None}

    return {"user": {"id": user.id, "username": user.username, "provider": user.provider}}

@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("session_id")
    return {"message": "Logged out"}