from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.auth import (
    hash_password,
    create_access_token,
    verify_password,
    get_current_user,
)
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/users", tags=["Users"])


# Define the Pydantic models for request body validation
class UserSignup(BaseModel):
    name: str
    email: str
    password: str
    bio: Optional[str] = ""  # bio is optional
    explanation_level: Optional[int] = 1  # explanation_level is optional, default is 1


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    bio: Optional[str]
    explanation_level: Optional[int]

    class Config:
        from_attributes = True


@router.post("/signup")
def signup(
    user: UserSignup,
    db: Session = Depends(get_db),
):
    # Check if the email already exists
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already taken")

    # Hash the password
    hashed_password = hash_password(user.password)

    # Create a new User object from the validated data
    new_user = User(
        name=user.name,
        email=user.email,
        password=hashed_password,
        bio=user.bio,
        explanation_level=user.explanation_level,
    )

    # Add the new user to the database and commit the transaction
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User created successfully"}


@router.post("/login")
def login(
    user: UserLogin,
    db: Session = Depends(get_db),
):
    # Check if the user exists in the database
    user_in_db = db.query(User).filter(User.email == user.email).first()

    if not user_in_db or not verify_password(user.password, user_in_db.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    # Create and return the JWT token
    token = create_access_token({"sub": user_in_db.email})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_current_user_details(
    current_user: User = Depends(get_current_user),  # Get user from auth dependency
):
    return current_user
