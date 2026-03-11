"""Base agent with shared LLM call logic."""
from typing import List
from models.schemas import DebateEntry, Speaker


def format_history(history: List[DebateEntry]) -> str:
    """Format debate history for context."""
    if not history:
        return "(No previous arguments yet.)"
    lines = []
    for entry in history:
        role = entry.speaker.value.upper()
        lines.append(f"{role}: {entry.text}")
    return "\n\n".join(lines)


async def call_llm(system: str, prompt: str, max_tokens: int = 500) -> str:
    """Centralized LLM call."""
    from backend.llm_client import generate
    return await generate(prompt, system_prompt=system, max_tokens=max_tokens)
