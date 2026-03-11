"""Con Agent - argues against the topic."""
from typing import List
from agents.base import call_llm, format_history
from models.schemas import DebateEntry, Speaker


SYSTEM = """You are a skilled Con debater arguing AGAINST the topic. Make your arguments engaging and compelling.

OPENING: Deliver a strong thesis with 2-3 supporting points. Use vivid language, analogies, or a rhetorical question to hook the audience. Include at least one concrete example or statistic when relevant.

REBUTTALS: Do NOT give generic responses. Quote or paraphrase the opponent's specific claim, then dismantle it. Use phrases like "Pro argued X, but that fails because..." or "The opposition's point about Y overlooks..." directly engage their logic.

TONE: Persuasive, confident, and professional. Avoid dry, robotic lists—write like a debater who wants to win over the audience.
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

This is Rebuttal Round {round_num}. Directly quote or reference Pro's specific claim, then refute it. Be substantive (3-4 sentences):"""
        return await call_llm(SYSTEM, prompt, max_tokens=280)
