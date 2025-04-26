import os
import torch
from llama_cpp import Llama
from typing import Optional

# Global variable to hold the loaded Llama model instance
llm: Optional[Llama] = None

# --- Configuration ---
# Determine the correct path to the model file
# Assumes the script is run from the 'backend' directory or project root
# Adjust if necessary, or use environment variables for better practice.
MODEL_FILENAME = "Qwen-2.5-3B-GRPO-1K_Q4_K_M.gguf"

# Try finding the model relative to this file's directory first
script_dir = os.path.dirname(
    os.path.abspath(__file__)
)  # Directory of ml_model.py (app/)
backend_dir = os.path.dirname(script_dir)  # Directory containing app/ (backend/)
MODEL_PATH = os.path.join(backend_dir, MODEL_FILENAME)

# Fallback: Check if the model is directly in the 'backend' directory (if running script from there)
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = os.path.join(
        os.getcwd(), MODEL_FILENAME
    )  # Check current working directory


# --- Device Detection ---
def get_device():
    """Detects the appropriate device (MPS, CUDA, or CPU)."""
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


# --- Model Loading Function ---
def load_model():
    """Loads the Llama model into the global 'llm' variable."""
    global llm
    if llm is None:  # Load only if it hasn't been loaded yet
        device = get_device()
        n_gpu_layers = (
            -1 if device != "cpu" else 0
        )  # Offload all layers if GPU is available

        print("-" * 50)
        print(f"Attempting to load model from: {MODEL_PATH}")
        if not os.path.exists(MODEL_PATH):
            print(f"ERROR: Model file not found at {MODEL_PATH}")
            # You might want to raise an exception here or handle it appropriately
            # For now, we'll just print the error and llm will remain None
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
                n_ctx=4096,  # Context window size
                chat_format="chatml",  # Use the chat format the model expects
                verbose=False,  # Set to True for detailed llama.cpp logs
            )
            print("Model loaded successfully.")
        except Exception as e:
            print(f"ERROR: Failed to load the Llama model: {e}")
            # llm remains None if loading fails
        print("-" * 50)


# --- Model Closing Function ---
def close_model():
    """Cleans up the model resources (if applicable)."""
    global llm
    if llm is not None:
        # llama-cpp-python manages resources internally, often __del__ is enough.
        # Explicitly deleting the reference might help garbage collection.
        del llm
        llm = None
        print("Model resources released.")


# --- Dependency for FastAPI ---
def get_llm() -> Llama:
    """FastAPI dependency to get the loaded LLM instance."""
    if llm is None:
        # This shouldn't happen if load_model is called at startup,
        # but it's a safeguard.
        print("ERROR: LLM instance requested but not loaded!")
        raise RuntimeError("ML model is not available.")
    return llm
