from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db

from app.models import User, ChatSession

from app.auth import (
    hash_password,
    create_access_token,
    verify_password,
    get_current_user,
)
from pydantic import BaseModel
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])


class UserSignup(BaseModel):
    name: str
    email: str
    password: str
    bio: Optional[str] = ""
    explanation_level: Optional[int] = 2


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
def signup(user: UserSignup, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = hash_password(user.password)

    new_user = User(
        name=user.name,
        email=user.email,
        password=hashed_password,
        bio=user.bio,
        explanation_level=user.explanation_level
        if user.explanation_level is not None
        else 2,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        logger.info(f"User {new_user.id} ({new_user.email}) created successfully.")

        try:
            session_count = (
                db.query(ChatSession).filter(ChatSession.user_id == new_user.id).count()
            )
            first_session_title = f"Chat {session_count + 1}"
            first_session = ChatSession(user_id=new_user.id, title=first_session_title)
            db.add(first_session)
            db.commit()
            db.refresh(first_session)
            logger.info(
                f"Created default session '{first_session_title}' (ID: {first_session.id}) for user {new_user.id}."
            )
        except Exception as session_e:
            db.rollback()
            logger.error(
                f"Failed to create default session for user {new_user.id}: {session_e}",
                exc_info=True,
            )

        return {"message": "User created successfully"}

    except Exception as e:
        db.rollback()
        logger.error(f"Error during signup for email {user.email}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not create user.")


@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    user_in_db = db.query(User).filter(User.email == user.email).first()

    if not user_in_db or not verify_password(user.password, user_in_db.password):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": user_in_db.email})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_current_user_details(current_user: User = Depends(get_current_user)):
    return current_user
