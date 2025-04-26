# import torch
# from llama_cpp import Llama


# def main():
#     # ---- 1. Device detection ----
#     device = (
#         "cuda"
#         if torch.cuda.is_available()
#         else "mps" if torch.backends.mps.is_available() else "cpu"
#     )
#     print(f"Running on ➜ {device}")

#     # Offload as many layers as possible to GPU
#     n_gpu_layers = -1 if device != "cpu" else 0

#     # ---- 2. Initialize model ----
#     llm = Llama(
#         model_path="/Users/mc13/Documents/human-ai/project/math-phi4/backend/Qwen-2.5-3B-GRPO-Math.Q4_K_M.gguf",  # <-- Update this
#         n_gpu_layers=n_gpu_layers,
#         n_ctx=4096,
#         chat_format="chatml",
#         verbose=False,  # Set True to see detailed loading logs
#     )

#     # We instruct the model to always show reasoning step-by-step.
#     # Adjust instructions for your use case.
#     messages = [
#         {
#             "role": "system",
#             "content": (
#                 "You are a helpful assistant. "
#                 "Please provide detailed reasoning steps in your answers."
#             ),
#         }
#     ]

#     print("Welcome! Type 'exit' or 'quit' to end the conversation.")
#     try:
#         while True:
#             # ---- 3. Get user input ----
#             user_input = input("\nUser: ")
#             if user_input.lower() in ["exit", "quit"]:
#                 print("Exiting...")
#                 break

#             # ---- 4. Append user message & call the model ----
#             messages.append({"role": "user", "content": user_input})

#             # We can stream the response token by token:
#             print("Assistant:", end=" ", flush=True)
#             partial_response = []
#             for chunk in llm.create_chat_completion(messages, stream=True):
#                 # Each chunk has a 'delta' dict for the newly produced token
#                 token = chunk["choices"][0]["delta"].get("content", "")
#                 print(token, end="", flush=True)
#                 partial_response.append(token)

#             # Once the stream is done, we have the final answer:
#             assistant_answer = "".join(partial_response)

#             # ---- 5. Save assistant response to conversation history ----
#             messages.append({"role": "assistant", "content": assistant_answer})

#     finally:
#         # ---- 6. Cleanup ----
#         llm.close()


# if __name__ == "__main__":
#     main()


import torch
from llama_cpp import Llama
import os  # Import the os module


def main():
    # ---- 1. Device detection ----
    device = (
        "cuda"
        if torch.cuda.is_available()
        else "mps" if torch.backends.mps.is_available() else "cpu"
    )
    print(f"Running on ➜ {device}")

    # Offload as many layers as possible to GPU
    n_gpu_layers = -1 if device != "cpu" else 0

    # ---- 2. Define and check model path ----
    # !! CORRECTED FILENAME !!
    model_filename = "Qwen-2.5-3B-GRPO-1K_Q4_K_M.gguf"
    # Get the directory where the script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Construct the full path relative to the script's location
    model_path = os.path.join(script_dir, model_filename)

    # --- Alternatively, if you are ALWAYS running the script FROM the directory
    # --- containing the model, you can just use the filename directly:
    # model_path = model_filename
    # --- However, using script_dir makes it more robust if you run the script
    # --- from a different directory later.

    print(f"Attempting to load model from: {model_path}")
    if not os.path.exists(model_path):
        print(f"ERROR: Model path does not exist: {model_path}")
        # Let's also check the current working directory just in case
        cwd_path = os.path.join(os.getcwd(), model_filename)
        print(f"Also checking current working directory path: {cwd_path}")
        if os.path.exists(cwd_path):
            print("Model found in current working directory. Using that path.")
            model_path = cwd_path
        else:
            print(
                f"ERROR: Model not found in script directory or current working directory."
            )
            # Optional: Add back the absolute path check as a last resort
            # absolute_path = "/Users/mc13/Documents/human-ai/project/math-phi4/backend/Qwen-2.5-3B-GRPO-1K_Q4_K_M.gguf" # Corrected absolute path
            # print(f"Attempting absolute path as fallback: {absolute_path}")
            # if not os.path.exists(absolute_path):
            #    print(f"ERROR: Absolute path also does not exist: {absolute_path}")
            #    return # Exit if nothing works
            # else:
            #    model_path = absolute_path
            return  # Exit if model not found

    print("Model path verified.")

    # ---- 3. Initialize model ----
    llm = None  # Initialize llm to None
    try:
        llm = Llama(
            model_path=model_path,
            n_gpu_layers=n_gpu_layers,
            n_ctx=4096,
            chat_format="chatml",
            verbose=False,  # Set True to see detailed loading logs
        )
    except Exception as e:
        print(f"ERROR: Failed to load the model from {model_path}.")
        print(f"Error details: {e}")
        return  # Exit if loading fails

    # We instruct the model to always show reasoning step-by-step.
    # Adjust instructions for your use case.
    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful assistant. "
                "Please provide detailed reasoning steps in your answers."
            ),
        }
    ]

    print("Welcome! Type 'exit' or 'quit' to end the conversation.")
    try:
        while True:
            # ---- 4. Get user input ----
            user_input = input("\nUser: ")
            if user_input.lower() in ["exit", "quit"]:
                print("Exiting...")
                break

            # ---- 5. Append user message & call the model ----
            messages.append({"role": "user", "content": user_input})

            # We can stream the response token by token:
            print("Assistant:", end=" ", flush=True)
            partial_response = []
            try:
                # Stream the response
                for chunk in llm.create_chat_completion(messages, stream=True):
                    # Each chunk has a 'delta' dict for the newly produced token
                    token = chunk["choices"][0]["delta"].get("content", "")
                    print(token, end="", flush=True)
                    partial_response.append(token)

                # Once the stream is done, we have the final answer:
                assistant_answer = "".join(partial_response)
                print()  # Add a newline after the assistant's response

                # ---- 6. Save assistant response to conversation history ----
                messages.append({"role": "assistant", "content": assistant_answer})

            except Exception as e:
                print(f"\nERROR: An error occurred during model inference: {e}")
                # Optionally remove the last user message if inference failed
                if messages and messages[-1]["role"] == "user":
                    messages.pop()

    finally:
        # ---- 7. Cleanup ----
        # Ensure llm was successfully initialized before trying to close
        if llm is not None:
            # Check if 'close' method exists before calling (newer llama-cpp-python)
            if hasattr(llm, "close") and callable(getattr(llm, "close")):
                print("\nClosing Llama model...")
                llm.close()
            # Older versions might use __del__ or context management implicitly
            # Or you might need to delete the object reference explicitly
            # del llm # Usually not needed if 'close' exists or using context manager
        print("Cleanup complete.")


if __name__ == "__main__":
    main()
