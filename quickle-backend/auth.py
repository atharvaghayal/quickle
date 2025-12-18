from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta
import re

from passlib.context import CryptContext

from sqlalchemy.orm import Session
from sqlalchemy import exc
from .database import get_db, engine
from .models import Base, User

# Initialize database tables on startup
Base.metadata.create_all(bind=engine)

# ----------------------------------------------------
# 1. SECURITY UTILS & CONFIGURATION
# ----------------------------------------------------

# BCrypt is recommended for password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# Secret key for signing session tokens (Placeholder: use environment variable in production)
SESSION_SECRET = "YOUR_SUPER_SECRET_SESSION_KEY" 
# Token expiry (e.g., 30 days)
SESSION_EXPIRY = timedelta(days=30) 

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# ----------------------------------------------------
# 2. Pydantic Models for Requests & Responses
# ----------------------------------------------------

class SignUpRequest(BaseModel):
    # This field holds the alphanumeric username
    email: str = Field(..., min_length=4, max_length=20, description="Unique alphanumeric username (4-20 chars).")
    password: str = Field(..., min_length=8, description="Must be 8+ chars.")

class LoginRequest(BaseModel):
    email: str
    password: str

# Pydantic model for returning user data (maps DB User to client User)
class UserResponse(BaseModel):
    email: str # This holds the username
    provider: str
    
    class Config:
        # Allows mapping from SQLAlchemy ORM objects (User model)
        from_attributes = True 

# ----------------------------------------------------
# 3. NEW SQLAlchemy CRUD Functions
# ----------------------------------------------------

def get_user_by_username(db: Session, username: str):
    """Fetches a user by their unique username."""
    return db.query(User).filter(User.username == username).first()

def get_user_by_id(db: Session, user_id: int):
    """Fetches a user by their ID."""
    return db.query(User).filter(User.id == user_id).first()

def create_user_db(db: Session, username: str, hashed_password: str):
    """Creates a new user record in the database."""
    db_user = User(
        username=username,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# ----------------------------------------------------
# 4. AUTHENTICATION ROUTER & Dependencies
# ----------------------------------------------------

auth_router = APIRouter(prefix="/auth", tags=["Auth"])

# Dependency to check for active user session using the database
def get_current_user(request: Request, db: Session = Depends(get_db)) -> Optional[UserResponse]:
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    
    try:
        user_id = int(session_id)
        db_user = get_user_by_id(db, user_id)
        
        if db_user:
            # Return Pydantic model needed by the frontend
            return UserResponse(email=db_user.username, provider="local")
        return None
    except ValueError:
        # Session ID was not a valid integer
        return None

# ----------------------------------------------------
# Endpoint: Sign Up (Uses DB)
# ----------------------------------------------------

@auth_router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user_data: SignUpRequest, response: Response, db: Session = Depends(get_db)):
    username = user_data.email
    password = user_data.password

    # Input Validation: Alphanumeric and secure password rules
    if not username.isalnum():
        raise HTTPException(status_code=400, detail="Username must be alphanumeric.")
    if len(username) < 4 or len(username) > 20:
        raise HTTPException(status_code=400, detail="Username must be 4-20 characters long.")
    
    if (len(password) < 8 or 
        not re.search(r'[A-Z]', password) or 
        not re.search(r'[a-z]', password) or 
        not re.search(r'\d', password) or 
        not re.search(r'[!@#$%^&*()]', password)):
        raise HTTPException(status_code=400, 
            detail="Password must be at least 8 characters, include uppercase, lowercase, a digit, and a special character.")

    # Check for existing user (DB READ)
    if get_user_by_username(db, username):
        raise HTTPException(status_code=409, detail="Username already registered.")

    hashed_password = get_password_hash(password)

    try:
        # Store new user (DB WRITE)
        new_user = create_user_db(db, username, hashed_password)
    except exc.IntegrityError:
        # Handles potential race condition if two users sign up simultaneously
        db.rollback()
        raise HTTPException(status_code=409, detail="Username conflict during save.")

    # Successful sign-up implies login: set secure session cookie
    response.set_cookie(
        key="session_id",
        value=str(new_user.id), 
        expires=int(SESSION_EXPIRY.total_seconds()),
        httponly=True,
        secure=True,
        samesite="Lax"
    )
    
    return {"message": "User created and logged in successfully"}

# ----------------------------------------------------
# Endpoint: Log In (Uses DB)
# ----------------------------------------------------

@auth_router.post("/login")
async def login(user_data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    username = user_data.email
    
    # Find user (DB READ)
    user = get_user_by_username(db, username)
    
    if user is None or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, 
                            detail="Invalid username or password.")
    
    # Successful login: set secure session cookie
    response.set_cookie(
        key="session_id",
        value=str(user.id),
        expires=int(SESSION_EXPIRY.total_seconds()),
        httponly=True,
        secure=True,
        samesite="Lax"
    )
    
    # Return user details expected by AuthContext
    return {"user": {"email": user.username, "provider": "local"}}

# ----------------------------------------------------
# Endpoint: Log Out
# ----------------------------------------------------

@auth_router.post("/logout")
async def logout(response: Response):
    # Clear the session cookie
    response.delete_cookie(key="session_id")
    return {"message": "Logged out successfully"}

# ----------------------------------------------------
# Endpoint: Get Current User (Uses DB)
# ----------------------------------------------------

@auth_router.get("/me")
async def get_user_me(user: Optional[UserResponse] = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, 
                            detail="Not authenticated")
    
    # Return user object retrieved by the dependency
    return {"user": user}

# ----------------------------------------------------
# Endpoint: OAuth (Placeholder)
# ----------------------------------------------------

@auth_router.get("/oauth/{provider}/login")
async def start_oauth_login(provider: str):
    # Placeholder: In a real app, this initiates the OAuth flow
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, 
                        detail=f"OAuth login for {provider} is not yet implemented.")