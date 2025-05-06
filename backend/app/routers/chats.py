from fastapi import APIRouter, Depends, HTTPException, Body, Path, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from datetime import datetime

from app.models import User, Chat, ChatSession
from app.database import get_db
from app.auth import get_current_user
from app.ml_model import get_llm
from llama_cpp import Llama
from typing import List, Optional

from pydantic import BaseModel, Field

import logging
import traceback

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SessionListItem(BaseModel):
    id: int
    title: str
    created_at: datetime

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    id: int
    user_id: int
    title: str
    created_at: datetime

    class Config:
        from_attributes = True


class SessionUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)


class MessageBase(BaseModel):
    question: str
    answer: str


class MessageResponse(MessageBase):
    id: int
    session_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class MessageCreateRequest(BaseModel):
    question: str


SYSTEM_PROMPT_CONCISE = (
    "You are a math tutor AI. Provide the final answer directly and clearly. "
    "Only include the absolute minimum key steps needed to reach the solution. "
    "Avoid explanations, analogies, or conversational filler. Prefix the final answer with 'Final Answer:'."
)
SYSTEM_PROMPT_DETAILED = (
    "You are a helpful AI math tutor. Explain concepts clearly. "
    "Before providing the final answer, outline your reasoning step-by-step "
    "as a 'chain-of-thought'. Explain *why* each step is taken. "
    "Clearly mark the final answer by prefixing it with 'Final Answer:'. Maintain a slightly conversational tone."
)
SYSTEM_PROMPT_ELABORATE = (
    "You are an explanatory AI math tutor. Your goal is clarity and context. "
    "1. Provide a detailed step-by-step ('chain-of-thought') solution, briefly explaining the mathematical principle behind the main steps. "
    "2. Briefly mention the core mathematical concepts being used (e.g., 'This involves solving a linear equation'). "
    "3. Optionally, point out one common mistake related to this type of problem. "
    "4. Clearly mark the final numerical result by prefixing it with 'Final Answer:'. Maintain an encouraging tone."
)
SYSTEM_PROMPT_COMPREHENSIVE = (
    "You are a comprehensive AI math tutor. Your goal is to ensure deep understanding. "
    "For the given problem: "
    "1. Provide a highly detailed step-by-step ('chain-of-thought') solution, explaining the purpose and the mathematical principle behind each step (e.g., 'applying the additive inverse property'). "
    "2. Discuss the underlying mathematical concepts involved in detail (e.g., define linear equations, properties of equality, inverse operations). "
    "3. Discuss potential alternative approaches or common mistakes related to this type of problem in detail, if applicable. "
    "4. Clearly mark the final numerical result by prefixing it with 'Final Answer:'. Be thorough and educational."
)


def get_system_prompt_for_user(user: User) -> str:
    """Determines the correct system prompt based on user's explanation level."""
    prompt_mapping = {
        1: (SYSTEM_PROMPT_CONCISE, "Concise"),
        2: (SYSTEM_PROMPT_DETAILED, "Detailed"),
        3: (SYSTEM_PROMPT_ELABORATE, "Elaborate"),
        4: (SYSTEM_PROMPT_COMPREHENSIVE, "Comprehensive"),
    }
    DEFAULT_LEVEL_INT = 2

    raw_level = getattr(user, "explanation_level", DEFAULT_LEVEL_INT)
    explanation_level_int = DEFAULT_LEVEL_INT
    try:
        if raw_level is not None:
            explanation_level_int = int(raw_level)
            if explanation_level_int not in prompt_mapping:
                logger.warning(
                    f"User {user.id} had out-of-range level: {explanation_level_int}. Defaulting."
                )
                explanation_level_int = DEFAULT_LEVEL_INT
        else:
            logger.warning(f"User {user.id} has null explanation level. Defaulting.")
            explanation_level_int = DEFAULT_LEVEL_INT
    except (ValueError, TypeError):
        logger.warning(
            f"User {user.id} has invalid level format: '{raw_level}'. Defaulting."
        )
        explanation_level_int = DEFAULT_LEVEL_INT

    system_prompt, level_name = prompt_mapping[explanation_level_int]
    logger.info(
        f"Using level: {level_name} (Level {explanation_level_int}) for user {user.id}"
    )
    return system_prompt


session_router = APIRouter(prefix="/sessions", tags=["Sessions"])


@session_router.post("/", response_model=SessionResponse, status_code=201)
def create_session(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new chat session for the logged-in user,
    naming it sequentially (Chat 1, Chat 2, etc.).
    """
    try:
        session_count = (
            db.query(func.count(ChatSession.id))
            .filter(ChatSession.user_id == user.id)
            .scalar()
        )
        next_session_title = f"Chat {session_count + 1}"

        new_session = ChatSession(user_id=user.id, title=next_session_title)

        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        logger.info(
            f"Created new chat session '{next_session_title}' (ID: {new_session.id}) for user {user.id}"
        )
        return new_session
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating session for user {user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create chat session.")


@session_router.get("/", response_model=List[SessionListItem])
def list_sessions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists all chat sessions for the logged-in user, ordered by creation date."""
    try:
        sessions = (
            db.query(ChatSession)
            .filter(ChatSession.user_id == user.id)
            .order_by(desc(ChatSession.created_at))
            .all()
        )
        logger.info(f"Found {len(sessions)} sessions for user {user.id}")
        return sessions
    except Exception as e:
        logger.error(f"Error listing sessions for user {user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve chat sessions.")


@session_router.get("/{session_id}/history", response_model=List[MessageResponse])
def get_session_history(
    session_id: int = Path(
        ..., title="The ID of the session to retrieve history for", ge=1
    ),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, description="Maximum number of messages to return", ge=1),
):
    """Fetches the message history for a specific chat session owned by the user."""
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
        .first()
    )
    if not session:
        logger.warning(f"User {user.id} denied access/not found session {session_id}")
        raise HTTPException(
            status_code=404, detail="Session not found or access denied."
        )

    try:
        history = (
            db.query(Chat)
            .filter(Chat.session_id == session_id)
            .order_by(Chat.timestamp.asc())
            .limit(limit)
            .all()
        )
        logger.info(
            f"Returning {len(history)} history items for session {session_id} (User {user.id})."
        )
        return history
    except Exception as e:
        logger.error(
            f"Failed to fetch history for session {session_id} (User {user.id}): {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="Could not retrieve chat history for this session."
        )


@session_router.post("/{session_id}/messages", response_model=MessageResponse)
def add_message_to_session(
    request: MessageCreateRequest,
    session_id: int = Path(
        ..., title="The ID of the session to add the message to", ge=1
    ),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    llm: Llama = Depends(get_llm),
):
    """Adds a new question/answer pair to a specific chat session."""
    logger.info(
        f"Received question for session {session_id} from user {user.id}: '{request.question}'"
    )

    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=404, detail="Session not found or access denied."
        )

    system_prompt = get_system_prompt_for_user(user)

    try:
        recent_history_db = (
            db.query(Chat)
            .filter(Chat.session_id == session_id)
            .order_by(Chat.timestamp.asc())
            .limit(10)
            .all()
        )
        logger.info(
            f"Fetched {len(recent_history_db)} context items for session {session_id}."
        )
    except Exception as e:
        logger.warning(f"Could not fetch chat history for session {session_id}: {e}")
        recent_history_db = []

    messages = [{"role": "system", "content": system_prompt}]
    for chat_item in recent_history_db:
        if chat_item.question and chat_item.answer:
            messages.append({"role": "user", "content": chat_item.question})
            messages.append({"role": "assistant", "content": chat_item.answer})
    messages.append({"role": "user", "content": request.question})

    assistant_response = "Error: Default response."
    try:
        logger.info(
            f"Sending {len(messages)} messages to LLM for session {session_id}."
        )
        completion = llm.create_chat_completion(
            messages=messages,
            max_tokens=1500,
            temperature=0.5,
            stop=["\nUser:", "<|endoftext|>", "<|user|>"],
        )
        if (
            completion
            and isinstance(completion.get("choices"), list)
            and len(completion["choices"]) > 0
            and isinstance(completion["choices"][0].get("message"), dict)
            and completion["choices"][0]["message"].get("content")
        ):
            assistant_response = completion["choices"][0]["message"]["content"].strip()
            logger.info(f"LLM response received for session {session_id}.")
        else:
            assistant_response = (
                "Sorry, I encountered an issue generating a response. Please try again."
            )
            logger.error(
                f"LLM returned invalid structure for session {session_id}: {completion}"
            )
    except Exception as e:
        logger.error(
            f"LLM inference error for session {session_id}: {e}", exc_info=True
        )
        assistant_response = (
            f"Error during response generation. Please check logs. (Details: {e})"
        )

    new_chat_record = None
    try:
        logger.info(f"Saving interaction to session {session_id} for user {user.id}.")
        new_chat_record = Chat(
            session_id=session_id,
            question=request.question,
            answer=assistant_response,
        )
        db.add(new_chat_record)
        db.commit()
        db.refresh(new_chat_record)
        logger.info(
            f"Chat interaction {new_chat_record.id} saved to session {session_id}."
        )
    except Exception as e:
        db.rollback()
        logger.error(
            f"DB error saving chat to session {session_id}: {e}", exc_info=True
        )
        raise HTTPException(status_code=500, detail="Failed to save chat interaction.")

    if new_chat_record:
        return new_chat_record
    else:
        logger.error(
            f"Failed return chat record for session {session_id} after save attempt."
        )
        raise HTTPException(
            status_code=500, detail="Failed create/retrieve chat record."
        )


@session_router.put("/{session_id}", response_model=SessionResponse)
def update_session_title(
    update_data: SessionUpdateRequest,
    session_id: int = Path(..., title="The ID of the session to update", ge=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates the title of a specific chat session owned by the user."""
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=404, detail="Session not found or access denied."
        )
    try:
        session.title = update_data.title
        db.commit()
        db.refresh(session)
        logger.info(f"Updated title for session {session_id} for user {user.id}")
        return session
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating session {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update session title.")


@session_router.delete("/{session_id}", status_code=204)
def delete_session(
    session_id: int = Path(..., title="The ID of the session to delete", ge=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes a specific chat session and all its messages."""
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=404, detail="Session not found or access denied."
        )
    try:
        db.delete(session)
        db.commit()
        logger.info(f"Deleted session {session_id} for user {user.id}")
        return None
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting session {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete session.")
