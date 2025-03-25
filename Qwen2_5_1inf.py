
import time
from unsloth import FastLanguageModel
from vllm import SamplingParams

# Load the model with fast inference enabled and your GRPO LoRA adapter.
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="Qwen/Qwen2.5-3B-Instruct",
    lora_path="/media/tarun/DATA/EXP/Dayton/Spring_25/Human_AI/final_Q1/grpo_saved_lora",
    max_seq_length=1024,
    load_in_4bit=True,
    fast_inference=True,
    gpu_memory_utilization=0.9,  # Increase as needed for your GPU
)

# Define sampling parameters using vLLM's API.
sampling_params = SamplingParams(
    temperature=0.8,
    top_p=0.95,
    max_tokens=1024,
)

print("Enter your prompt and press ENTER (or type 'exit' to quit):")

while True:
    user_input = input("\nUser: ").strip()
    if user_input.lower() == "exit":
        print("Exiting program.")
        break

    print("Loading model and tokenizer...")

    # Prepare a chat prompt that instructs the model.
    chat_prompt = tokenizer.apply_chat_template([
        {"role": "system", "content": "Before answering, please provide your chain-of-thought reasoning followed by your final answer. Mark the final answer with 'Final Answer:'."},
        {"role": "user", "content": user_input}
    ], tokenize=False, add_generation_prompt=True)

    start_time = time.perf_counter()
    
    # Generate output using fast_generate (without streaming).
    result = model.fast_generate(
        [chat_prompt],
        sampling_params=sampling_params,
        lora_request=None,
    )[0].outputs[0].text
    
    total_inference_time = time.perf_counter() - start_time

    print("\nTotal Inference Time: {:.2f} seconds".format(total_inference_time))
    
    # If the output includes a marker, separate the reasoning from the final answer.
    if "Final Answer:" in result:
        reasoning, final_answer = result.split("Final Answer:", 1)
        print("\nReasoning:\n", reasoning.strip())
        print("\nFinal Answer:\n", final_answer.strip())
    else:
        print("\nOutput:\n", result)
