from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import Chat, User
from app.auth import get_current_user


# Define the Pydantic model for the request body
class QuestionRequest(BaseModel):
    question: str


router = APIRouter(prefix="/chats", tags=["Chats"])


@router.post("/")
def ask_question(
    request: QuestionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Simulating ML Model Response
    answer = f"ML Model's response to: {request.question}"

    chat = Chat(user_id=user.id, question=request.question, answer=answer)
    db.add(chat)
    db.commit()
    db.refresh(chat)

    return {"question": request.question, "answer": answer}


@router.get("/history")
def get_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    history = (
        db.query(Chat)
        .filter(Chat.user_id == user.id)
        # .order_by(Chat.id.desc())
        .limit(15)
        .all()
    )
    return history
