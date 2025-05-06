import os
import torch
from llama_cpp import Llama
from typing import Optional

llm: Optional[Llama] = None

MODEL_FILENAME = "Qwen-2.5-3B-GRPO-1K_Q4_K_M.gguf"

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
MODEL_PATH = os.path.join(backend_dir, MODEL_FILENAME)

if not os.path.exists(MODEL_PATH):
    MODEL_PATH = os.path.join(os.getcwd(), MODEL_FILENAME)


def get_device():
    """Detects the appropriate device (MPS, CUDA, or CPU)."""
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def load_model():
    """Loads the Llama model into the global 'llm' variable."""
    global llm
    if llm is None:
        device = get_device()
        n_gpu_layers = -1 if device != "cpu" else 0

        print("-" * 50)
        print(f"Attempting to load model from: {MODEL_PATH}")
        if not os.path.exists(MODEL_PATH):
            print(f"ERROR: Model file not found at {MODEL_PATH}")
            return
        else:
            print(f"Model file found. Proceeding with loading...")

        try:
            print(f"Using device: {device}")
            print(
                f"Offloading {n_gpu_layers if n_gpu_layers != -1 else 'all'} layers to GPU."
            )
            llm = Llama(
                model_path=MODEL_PATH,
                n_gpu_layers=n_gpu_layers,
                n_ctx=4096,
                chat_format="chatml",
                verbose=False,
            )
            print("Model loaded successfully.")
        except Exception as e:
            print(f"ERROR: Failed to load the Llama model: {e}")
        print("-" * 50)


def close_model():
    """Cleans up the model resources (if applicable)."""
    global llm
    if llm is not None:
        del llm
        llm = None
        print("Model resources released.")


def get_llm() -> Llama:
    """FastAPI dependency to get the loaded LLM instance."""
    if llm is None:
        print("ERROR: LLM instance requested but not loaded!")
        raise RuntimeError("ML model is not available.")
    return llm
