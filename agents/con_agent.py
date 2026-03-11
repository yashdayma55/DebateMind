"""Con Agent - argues against the topic."""
from typing import List
from agents.base import call_llm, format_history
from models.schemas import DebateEntry, Speaker


SYSTEM = """You are a Con debater. Your role is to argue AGAINST the given topic.
- Use clear, logical reasoning
- Support arguments with evidence and examples when possible
- Be persuasive but professional
- Stay focused on the topic
- In rebuttals, directly address the opponent's counterpoints
"""


class ConAgent:
    """Agent that argues against the debate topic."""
    
    @staticmethod
    async def opening_argument(topic: str, history: List[DebateEntry]) -> str:
        """Generate opening argument against the topic."""
        prompt = f"""Topic: {topic}

Debate so far:
{format_history(history)}

Present your opening argument AGAINST (2-3 sentences only):"""
        return await call_llm(SYSTEM, prompt, max_tokens=200)
    
    @staticmethod
    async def rebuttal(topic: str, history: List[DebateEntry], round_num: int) -> str:
        """Generate rebuttal addressing Pro's arguments."""
        prompt = f"""Topic: {topic}

Debate so far:
{format_history(history)}

This is Rebuttal Round {round_num}. Address the Pro's points briefly (2-3 sentences):"""
        return await call_llm(SYSTEM, prompt, max_tokens=200)
