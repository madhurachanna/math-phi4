from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import Chat, User
from app.auth import get_current_user
from app.ml_model import model, tokenizer  # Import the model and tokenizer
from vllm import SamplingParams

# Define the Pydantic model for the request body
class QuestionRequest(BaseModel):
    question: str

# Initialize the API router with a prefix and tags
router = APIRouter(prefix="/chats", tags=["Chats"])

@router.post("/")
def ask_question(
    request: QuestionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Ensure the ML model and tokenizer are loaded
    if model is None or tokenizer is None:
        raise HTTPException(status_code=500, detail="ML model is not loaded.")

    # Prepare the chat prompt with chain-of-thought instruction
    chat_prompt = tokenizer.apply_chat_template([
        {"role": "system", "content": "Before answering, please provide your chain-of-thought reasoning followed by your final answer. Mark the final answer with 'Final Answer:'."},
        {"role": "user", "content": request.question}
    ], tokenize=False, add_generation_prompt=True)

    # Define sampling parameters for the model's response generation
    sampling_params = SamplingParams(
        temperature=0.8,
        top_p=0.95,
        max_tokens=1024,
    )

    # Generate the model's response
    result = model.fast_generate(
        [chat_prompt],
        sampling_params=sampling_params,
        lora_request=None,
    )[0].outputs[0].text.strip()

    # Save the chat interaction to the database
    chat = Chat(user_id=user.id, question=request.question, answer=result)
    db.add(chat)
    db.commit()
    db.refresh(chat)

    # Return the full response including chain-of-thought reasoning and final answer
    return {"question": request.question, "answer": result}


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