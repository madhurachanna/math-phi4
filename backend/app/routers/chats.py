# --- File: app/chats.py ---

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

# Import Integer if defining the model field here or ensure it's imported in models.py
from sqlalchemy import (
    Column,
    Integer,
    String,
)  # Example imports for model definition comment

from pydantic import BaseModel, Field
from app.database import get_db
from app.models import (
    Chat,
    User,
)  # Assuming Chat model and User model are defined
# *** Assumption: Ensure your User model in app/models.py has a field ***
# *** like 'explanation_level: int' to store user preference (1-4).  ***
# *** Example in User model (SQLAlchemy):                             ***
# *** explanation_level = Column(Integer, default=2) # 1:Concise, 2:Detailed, 3:Elaborate, 4:Comprehensive ***

from app.auth import get_current_user
from app.ml_model import get_llm  # Import the dependency to get the loaded model
from llama_cpp import Llama  # Import Llama for type hinting
from typing import List, Dict, Any, Optional  # For type hinting history
import traceback  # For detailed error logging
import logging  # For better logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Pydantic Models ---


class QuestionRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    id: int
    question: str
    answer: str

    class Config:
        orm_mode = True  # Enable ORM mode (compatibility with SQLAlchemy models)


class HistoryItem(BaseModel):
    id: int
    question: str
    answer: str
    # Add timestamp or other fields if needed from your Chat model
    # from datetime import datetime
    # timestamp: Optional[datetime] = None

    class Config:
        orm_mode = True  # Enable ORM mode


# --- System Prompts for Different Explanation Levels ---

# NOTE: Define these prompts clearly based on desired output for each level.

SYSTEM_PROMPT_CONCISE = (  # Level 1
    "You are a math tutor AI. Provide the final answer directly and clearly. "
    "Only include the absolute minimum key steps needed to reach the solution. "
    "Avoid explanations, analogies, or conversational filler. Prefix the final answer with 'Final Answer:'."
)

SYSTEM_PROMPT_DETAILED = (  # Level 2
    "You are a helpful AI math tutor. Explain concepts clearly. "
    "Before providing the final answer, outline your reasoning step-by-step "
    "as a 'chain-of-thought'. Explain *why* each step is taken. "
    "Clearly mark the final answer by prefixing it with 'Final Answer:'. Maintain a slightly conversational tone."
)

SYSTEM_PROMPT_ELABORATE = (  # Level 3
    "You are an explanatory AI math tutor. Your goal is clarity and context. "
    "1. Provide a detailed step-by-step ('chain-of-thought') solution, briefly explaining the mathematical principle behind the main steps. "
    "2. Briefly mention the core mathematical concepts being used (e.g., 'This involves solving a linear equation'). "
    "3. Optionally, point out one common mistake related to this type of problem. "
    "4. Clearly mark the final numerical result by prefixing it with 'Final Answer:'. Maintain an encouraging tone."
)

SYSTEM_PROMPT_COMPREHENSIVE = (  # Level 4
    "You are a comprehensive AI math tutor. Your goal is to ensure deep understanding. "
    "For the given problem: "
    "1. Provide a highly detailed step-by-step ('chain-of-thought') solution, explaining the purpose and the mathematical principle behind each step (e.g., 'applying the additive inverse property'). "
    "2. Discuss the underlying mathematical concepts involved in detail (e.g., define linear equations, properties of equality, inverse operations). "
    "3. Discuss potential alternative approaches or common mistakes related to this type of problem in detail, if applicable. "
    "4. Clearly mark the final numerical result by prefixing it with 'Final Answer:'. Be thorough and educational."
)

# --- API Router ---

router = APIRouter(prefix="/chats", tags=["Chats"])


# --- Endpoint: Ask Question ---


@router.post("/", response_model=ChatResponse)
def ask_question(
    request: QuestionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(
        get_current_user
    ),  # Gets authenticated user (with their preferences)
    llm: Llama = Depends(get_llm),  # Inject the loaded Llama instance
):
    """
    Handles a user's math question based on their selected explanation level (stored as 1-4),
    gets a response from the LLM, saves the interaction, and returns it.
    """
    logger.info(f"Received question from user {user.id}: '{request.question}'")

    # --- 1. Determine System Prompt based on User Preference (Integer Level) ---
    # Map integer levels stored in DB (1-4) to system prompts and names
    prompt_mapping = {
        1: (SYSTEM_PROMPT_CONCISE, "Concise"),
        2: (SYSTEM_PROMPT_DETAILED, "Detailed"),
        3: (SYSTEM_PROMPT_ELABORATE, "Elaborate"),
        4: (SYSTEM_PROMPT_COMPREHENSIVE, "Comprehensive"),
    }
    DEFAULT_LEVEL_INT = 2  # Default level integer (Detailed)

    # Get user's preference (assuming 'explanation_level' attribute stores 1, 2, 3, or 4)
    raw_level = getattr(user, "explanation_level", DEFAULT_LEVEL_INT)
    print("raw_level", raw_level)

    try:
        # Ensure the level is an integer
        explanation_level_int = int(raw_level)
    except (ValueError, TypeError):
        logger.warning(
            f"User {user.id} has invalid explanation level format: '{raw_level}'. Defaulting to level {DEFAULT_LEVEL_INT}."
        )
        explanation_level_int = DEFAULT_LEVEL_INT

    # Get the prompt and level name from the mapping, using default if key is invalid/out of range
    system_prompt, level_name = prompt_mapping.get(
        explanation_level_int, prompt_mapping[DEFAULT_LEVEL_INT]
    )

    # Log a warning if the retrieved integer was not a valid key (e.g., 0, 5, etc.)
    if explanation_level_int not in prompt_mapping:
        logger.warning(
            f"User {user.id} had out-of-range explanation level value: {explanation_level_int}. "
            f"Defaulting to level {DEFAULT_LEVEL_INT} ({level_name})."
        )

    logger.info(
        f"Using explanation level: {level_name} (Level {explanation_level_int}) for user {user.id}"
    )

    # --- 2. Fetch Recent History for Context ---
    try:
        recent_history_db = (
            db.query(Chat)
            .filter(Chat.user_id == user.id)
            .order_by(Chat.id.desc())
            .limit(5)  # Limit context window size
            .all()
        )
        recent_history_db.reverse()  # Order from oldest to newest for LLM
        logger.info(
            f"Fetched {len(recent_history_db)} recent history items for user {user.id}."
        )
    except Exception as e:
        logger.warning(f"Could not fetch chat history for user {user.id}: {e}")
        recent_history_db = []

    # --- 3. Prepare messages list for the LLM (ChatML format) ---
    messages = [{"role": "system", "content": system_prompt}]
    for chat_item in recent_history_db:
        # Ensure history items have question and answer before appending
        if chat_item.question and chat_item.answer:
            messages.append({"role": "user", "content": chat_item.question})
            messages.append({"role": "assistant", "content": chat_item.answer})
    messages.append({
        "role": "user",
        "content": request.question,
    })  # Add current question

    # --- 4. Generate LLM Response ---
    try:
        logger.info(f"Sending {len(messages)} messages to LLM for user {user.id}.")
        # Refer to llama-cpp-python documentation for optimal parameters
        completion = llm.create_chat_completion(
            messages=messages,
            max_tokens=1500,  # Adjust based on expected response length for math problems
            temperature=0.5,  # Lower temperature for more deterministic math explanations
            stop=["\nUser:", "<|endoftext|>"],  # Example stop tokens
            # top_p=0.9, # Example Nucleus sampling
        )

        # Validate response structure
        if (
            completion
            and isinstance(completion.get("choices"), list)
            and len(completion["choices"]) > 0
            and isinstance(completion["choices"][0].get("message"), dict)
            and completion["choices"][0]["message"].get("content")
        ):
            assistant_response = completion["choices"][0]["message"]["content"].strip()
            logger.info(f"LLM response received successfully for user {user.id}.")
        else:
            assistant_response = (
                "Sorry, I encountered an issue generating a response. Please try again."
            )
            logger.error(
                f"LLM returned an empty or invalid response structure for user {user.id}: {completion}"
            )
            # Consider not saving this interaction or saving with an error flag

    except Exception as e:
        logger.error(
            f"LLM inference error for user {user.id}: {e}", exc_info=True
        )  # Log full traceback
        # Consider raising HTTPException immediately if LLM fails critically
        # For now, we'll set a generic error message and still attempt to save
        assistant_response = (
            f"Error during response generation. Please try again. (Details: {e})"
        )
        # Optional: raise HTTPException here if preferred
        # raise HTTPException(status_code=500, detail="Failed to get response from ML model.")

    # --- 5. Save Interaction to Database ---
    new_chat_record = None
    try:
        logger.info(f"Attempting to save interaction for user {user.id} to database.")
        new_chat_record = Chat(
            user_id=user.id,
            question=request.question,
            answer=assistant_response,  # Save the generated (or error) response
        )
        db.add(new_chat_record)
        db.commit()
        db.refresh(new_chat_record)  # Get the ID and other DB-generated fields
        logger.info(
            f"Chat interaction {new_chat_record.id} saved successfully for user {user.id}."
        )
    except Exception as e:
        db.rollback()
        logger.error(
            f"Database error saving chat for user {user.id}: {e}", exc_info=True
        )
        # If saving fails, we can't return the ChatResponse structure as defined
        raise HTTPException(
            status_code=500, detail="Failed to save chat interaction history."
        )

    # --- 6. Return Response ---
    # If DB save succeeded, new_chat_record has the required fields (id, question, answer)
    # FastAPI uses the response_model (ChatResponse) and orm_mode to serialize.
    if new_chat_record:
        # Note: Pydantic V2 uses `model_validate` instead of relying solely on orm_mode sometimes
        # Ensure your Pydantic/FastAPI versions work well with orm_mode or adjust serialization
        return new_chat_record
    else:
        # This case should ideally be caught by the HTTPException above, but acts as a safeguard
        logger.error(
            f"Failed to return chat record for user {user.id} after attempting save."
        )
        raise HTTPException(
            status_code=500, detail="Failed create/retrieve chat record after saving."
        )


# --- Endpoint: Get History ---


@router.get("/history", response_model=List[HistoryItem])
def get_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Fetches the recent chat history (e.g., last 20 interactions)
    for the currently logged-in user.
    """
    logger.info(f"Fetching chat history for user {user.id}.")
    try:
        history = (
            db.query(Chat)
            .filter(Chat.user_id == user.id)
            .order_by(Chat.id.desc())
            .limit(20)  # Return a reasonable number of history items
            .all()
        )
        logger.info(f"Returning {len(history)} history items for user {user.id}.")
        # Pydantic V2 might need explicit list comprehension for validation if orm_mode isn't enough
        # return [HistoryItem.model_validate(item) for item in history]
        return history  # Return the list of ORM objects
    except Exception as e:
        logger.error(
            f"Failed to fetch chat history for user {user.id}: {e}", exc_info=True
        )
        raise HTTPException(status_code=500, detail="Could not retrieve chat history.")

