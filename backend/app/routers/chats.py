from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field  # Import Field
from app.database import get_db
from app.models import (
    Chat,
    User,
)  # Assuming Chat model has id, user_id, question, answer, timestamp
from app.auth import get_current_user
from app.ml_model import get_llm  # Import the dependency to get the loaded model
from llama_cpp import Llama  # Import Llama for type hinting
from typing import List, Dict, Any  # For type hinting history
import traceback  # For detailed error logging


# Define the Pydantic model for the request body
class QuestionRequest(BaseModel):
    question: str


# Define the Pydantic model for the response body for the POST request
# Ensure it includes the ID
class ChatResponse(BaseModel):
    id: int  # Include the ID field
    question: str
    answer: str

    class Config:
        orm_mode = True  # Enable ORM mode


# Define the Pydantic model for a single history item (for GET /history)
class HistoryItem(BaseModel):
    id: int
    question: str
    answer: str
    # Add timestamp or other fields if needed from your Chat model
    # timestamp: datetime

    class Config:
        orm_mode = True  # Enable ORM mode


# Initialize the API router
router = APIRouter(prefix="/chats", tags=["Chats"])


# Use the ChatResponse model for the POST endpoint's response
@router.post("/", response_model=ChatResponse)
def ask_question(
    request: QuestionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    llm: Llama = Depends(get_llm),  # Inject the loaded Llama instance
):
    """
    Handles a user's question, gets a response from the LLM,
    saves the interaction, and returns the interaction including its ID.
    """
    print(f"Received question from user {user.id}: {request.question}")

    # --- Fetch Recent History for Context ---
    try:
        recent_history = (
            db.query(Chat)
            .filter(Chat.user_id == user.id)
            .order_by(Chat.id.desc())
            .limit(5)
            .all()
        )
        recent_history.reverse()
    except Exception as e:
        print(f"Warning: Could not fetch chat history for context: {e}")
        recent_history = []

    # --- Prepare messages for the LLM ---
    system_prompt = (
        "You are a helpful AI assistant specialized in explaining concepts clearly. "
        "Before providing the final answer, please outline your reasoning step-by-step "
        "as a 'chain-of-thought'. Clearly mark the final answer by prefixing it with "
        "'Final Answer:'. Maintain a conversational tone."
    )
    messages = [{"role": "system", "content": system_prompt}]
    for chat_item in recent_history:
        messages.append({"role": "user", "content": chat_item.question})
        messages.append({"role": "assistant", "content": chat_item.answer})
    messages.append({"role": "user", "content": request.question})

    # --- Generate LLM Response ---
    try:
        print(f"Sending {len(messages)} messages to LLM...")
        completion = llm.create_chat_completion(
            messages=messages,
            max_tokens=1024,
            temperature=0.7,
        )
        if completion and completion.get("choices") and len(completion["choices"]) > 0:
            assistant_response = completion["choices"][0]["message"]["content"].strip()
            print("LLM response received.")
        else:
            assistant_response = "Sorry, I couldn't generate a response."
            print(f"LLM returned an empty/invalid response: {completion}")
            # Still save the interaction, but maybe log the failure more prominently
    except Exception as e:
        print(f"ERROR: An error occurred during LLM inference: {e}")
        print(traceback.format_exc())  # Log full traceback
        raise HTTPException(
            status_code=500, detail="Failed to get response from ML model."
        )

    # --- Save to Database ---
    new_chat_record = None  # Initialize
    try:
        print("Saving interaction to database...")
        new_chat_record = Chat(  # Assign to a variable
            user_id=user.id, question=request.question, answer=assistant_response
        )
        db.add(new_chat_record)
        db.commit()
        db.refresh(new_chat_record)  # Refresh to get the ID assigned by the DB
        print(f"Chat interaction {new_chat_record.id} saved.")
    except Exception as e:
        db.rollback()
        print(f"ERROR: Failed to save chat interaction to database: {e}")
        print(traceback.format_exc())  # Log full traceback
        raise HTTPException(status_code=500, detail="Failed to save chat history.")

    # --- Return Response (including the ID) ---
    # FastAPI will automatically use the ChatResponse model structure
    # because new_chat_record is a SQLAlchemy model instance and orm_mode=True
    if new_chat_record:
        return new_chat_record
    else:
        # Should not happen if DB save was successful, but as a fallback
        raise HTTPException(
            status_code=500, detail="Failed create/retrieve chat record after saving."
        )


# Use List[HistoryItem] for the GET /history endpoint
@router.get("/history", response_model=List[HistoryItem])
def get_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Fetches the recent chat history for the logged-in user."""
    try:
        history = (
            db.query(Chat)
            .filter(Chat.user_id == user.id)
            .order_by(Chat.id.desc())
            .limit(20)
            .all()
        )
        return history
    except Exception as e:
        print(f"ERROR: Failed to fetch chat history for user {user.id}: {e}")
        print(traceback.format_exc())  # Log full traceback
        raise HTTPException(status_code=500, detail="Could not retrieve chat history.")
