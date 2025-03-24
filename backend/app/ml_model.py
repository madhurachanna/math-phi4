# app/ml_model.py
from unsloth import FastLanguageModel

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="Qwen/Qwen2.5-3B-Instruct",
    lora_path="/media/tarun/DATA/EXP/Dayton/Spring_25/Human_AI/final_Q1/grpo_saved_lora",
    max_seq_length=1024,
    load_in_4bit=True,
    fast_inference=True,
    gpu_memory_utilization=0.9,
)
