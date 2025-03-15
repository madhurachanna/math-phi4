# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy.orm import Session
# from app.database import get_db
# from app.models import Chat, User
# from app.auth import get_current_user

# router = APIRouter(prefix="/chats", tags=["Chats"])


# @router.post("/")
# def ask_question(
#     question: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
# ):
#     # Simulating ML Model Response
#     answer = f"ML Model's response to: {question}"

#     chat = Chat(user_id=user.id, question=question, answer=answer)
#     db.add(chat)
#     db.commit()
#     db.refresh(chat)

#     return {"question": question, "answer": answer}


# @router.get("/history")
# def get_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
#     history = (
#         db.query(Chat)
#         .filter(Chat.user_id == user.id)
#         .order_by(Chat.id.desc())
#         .limit(15)
#         .all()
#     )
#     return history


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Chat, User
from app.auth import get_current_user
import time
from unsloth import FastLanguageModel
from vllm import SamplingParams

router = APIRouter(prefix="/chats", tags=["Chats"])

# Load the ML model once when the API starts
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="Qwen/Qwen2.5-3B-Instruct",
    lora_path="/media/tarun/DATA/EXP/Dayton/Spring_25/Human_AI/final_Q1/grpo_saved_lora",
    max_seq_length=1024,
    load_in_4bit=True,
    fast_inference=True,
    gpu_memory_utilization=0.9,
)

# Define sampling parameters
sampling_params = SamplingParams(
    temperature=0.8,
    top_p=0.95,
    max_tokens=1024,
)


@router.post("/")
def ask_question(
    question: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    if not question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Prepare prompt
    chat_prompt = tokenizer.apply_chat_template(
        [
            {
                "role": "system",
                "content": "Before answering, please provide your chain-of-thought reasoning followed by your final answer. Mark the final answer with 'Final Answer:'.",
            },
            {"role": "user", "content": question},
        ],
        tokenize=False,
        add_generation_prompt=True,
    )

    start_time = time.perf_counter()

    try:
        result = (
            model.fast_generate(
                [chat_prompt],
                sampling_params=sampling_params,
                lora_request=None,
            )[0]
            .outputs[0]
            .text
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating response: {str(e)}"
        )

    total_inference_time = time.perf_counter() - start_time

    # Extract reasoning and final answer
    if "Final Answer:" in result:
        reasoning, final_answer = result.split("Final Answer:", 1)
        reasoning = reasoning.strip()
        final_answer = final_answer.strip()
    else:
        reasoning = "N/A"
        final_answer = result.strip()

    # Store chat in database
    chat = Chat(user_id=user.id, question=question, answer=final_answer)
    db.add(chat)
    db.commit()
    db.refresh(chat)

    return {
        "question": question,
        "reasoning": reasoning,
        "final_answer": final_answer,
        "inference_time": f"{total_inference_time:.2f} seconds",
    }


@router.get("/history")
def get_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    history = (
        db.query(Chat)
        .filter(Chat.user_id == user.id)
        .order_by(Chat.id.desc())
        .limit(15)
        .all()
    )
    return history
