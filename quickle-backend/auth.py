from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta
import re
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from sqlalchemy import exc

# Import OAuth components
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware

# Import database components
from .database import get_db, engine
from .models import Base, User 

# Initialize database tables
Base.metadata.create_all(bind=engine)

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- OAuth Configuration ---
oauth = OAuth()

# Google Config
oauth.register(
    name='google',
    client_id='GOOGLE_CLIENT_ID',
    client_secret='GOOGLE_CLIENT_SECRET',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

# GitHub Config
oauth.register(
    name='github',
    client_id='GITHUB_CLIENT_ID',
    client_secret='GITHUB_CLIENT_SECRET',
    access_token_url='https://github.com/login/oauth/access_token',
    authorize_url='https://github.com/login/oauth/authorize',
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'user:email'}
)

# --- Schemas ---
class UserAuth(BaseModel):
    username: str
    password: str

# --- Helper Functions ---
def get_user(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

# --- Traditional Login/Signup Routes ---

@auth_router.post("/signup")
async def signup(user: UserAuth, db: Session = Depends(get_db)):
    if get_user(db, user.username):
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = pwd_context.hash(user.password)
    new_user = User(username=user.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully"}

@auth_router.post("/login")
async def login(user: UserAuth, response: Response, db: Session = Depends(get_db)):
    db_user = get_user(db, user.username)
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    response.set_cookie(
        key="session_id", value=str(db_user.id),
        httponly=True, samesite="Lax", max_age=2592000
    )
    return {"message": "Login successful"}

# --- OAuth Routes ---

@auth_router.get("/oauth/{provider}/login")
async def start_oauth_login(provider: str, request: Request):
    # This redirects the user to Google or GitHub's login page
    redirect_uri = f"http://localhost:8000/api/auth/oauth/{provider}/callback"
    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(status_code=400, detail="Invalid provider")
    return await client.authorize_redirect(request, redirect_uri)

@auth_router.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str, request: Request, response: Response, db: Session = Depends(get_db)):
    client = oauth.create_client(provider)
    try:
        token = await client.authorize_access_token(request)
    except Exception:
        raise HTTPException(status_code=401, detail="OAuth authentication failed")
    
    # Extract unique identifier based on provider
    if provider == 'google':
        user_info = token.get('userinfo')
        # We'll use their email as their unique username in our DB
        username = user_info['email']
    else: # github
        resp = await client.get('user', token=token)
        user_info = resp.json()
        username = user_info['login']

    # Check if user exists in our DB, if not, create a "Social User"
    db_user = get_user(db, username)
    if not db_user:
        # We store a placeholder password since they log in via OAuth
        db_user = User(username=username, hashed_password="OAUTH_USER_EXTERNAL")
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

    # Set the session cookie so the frontend knows they are logged in
    response.set_cookie(
        key="session_id", value=str(db_user.id),
        httponly=True, samesite="Lax", max_age=2592000
    )
    
    # Redirect the user back to your React frontend
    return RedirectResponse(url="http://localhost:3000")

@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("session_id")
    return {"message": "Logged out"}