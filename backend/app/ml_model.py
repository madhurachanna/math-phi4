# app/ml_model.py
from unsloth import FastLanguageModel

LORA_PATH = ""

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="Qwen/Qwen2.5-3B-Instruct",
    lora_path=LORA_PATH,
    max_seq_length=1024,
    load_in_4bit=True,
    fast_inference=True,
    gpu_memory_utilization=0.9,
)
