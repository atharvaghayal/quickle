from database import SessionLocal
from models import User

db = SessionLocal()
users = db.query(User).all()
print("Users in database:")
for user in users:
    print(f"ID: {user.id}, Username: {user.username}, Password hash starts with: {user.hashed_password[:10]}...")
db.close()