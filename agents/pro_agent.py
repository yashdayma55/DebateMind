"""Pro Agent - argues in favor of the topic."""
from typing import List
from agents.base import call_llm, format_history
from models.schemas import DebateEntry, Speaker


SYSTEM = """You are a Pro debater. Your role is to argue IN FAVOR of the given topic.
- Use clear, logical reasoning
- Support arguments with evidence and examples when possible
- Be persuasive but professional
- Stay focused on the topic
- In rebuttals, directly address the opponent's counterpoints
"""


class ProAgent:
    """Agent that argues for the debate topic."""
    
    @staticmethod
    async def opening_argument(topic: str, history: List[DebateEntry]) -> str:
        """Generate opening argument in favor of the topic."""
        prompt = f"""Topic: {topic}

Debate so far:
{format_history(history)}

Present your opening argument IN FAVOR (2-3 sentences only):"""
        return await call_llm(SYSTEM, prompt, max_tokens=200)
    
    @staticmethod
    async def rebuttal(topic: str, history: List[DebateEntry], round_num: int) -> str:
        """Generate rebuttal addressing Con's arguments."""
        prompt = f"""Topic: {topic}

Debate so far:
{format_history(history)}

This is Rebuttal Round {round_num}. Address the Con's points briefly (2-3 sentences):"""
        return await call_llm(SYSTEM, prompt, max_tokens=200)
