"""Moderator agent - introduces topic and controls debate structure."""
from agents.base import call_llm
from models.schemas import DebateEntry, Speaker


SYSTEM = """You are a professional debate moderator. Your role is to:
- Introduce the debate topic clearly and neutrally
- Set the stage for a fair, substantive debate
- Be concise (2-3 sentences max)
- Do NOT take a stance on the topic
- Optionally hint that both sides will be evaluated fairly on logic and evidence
"""


class ModeratorAgent:
    """Orchestrates debate flow and introduces topics."""
    
    @staticmethod
    async def introduce(topic: str) -> str:
        """Introduce the debate topic."""
        prompt = f"""Introduce this debate topic to the audience. Be professional and neutral. Briefly set expectations for a fair, evidence-based debate.

Topic: {topic}

Your introduction (2-3 sentences):"""
        return await call_llm(SYSTEM, prompt, max_tokens=100)
    
    @staticmethod
    async def prompt_pro_opening(topic: str) -> str:
        """Prompt Pro to give opening argument."""
        return f"Pro Agent, present your opening argument for: {topic}"
    
    @staticmethod
    async def prompt_con_opening(topic: str) -> str:
        """Prompt Con to give opening argument."""
        return f"Con Agent, present your opening argument against: {topic}"
    
    @staticmethod
    async def prompt_rebuttal(round_num: int) -> str:
        """Prompt for rebuttal round."""
        return f"Rebuttal Round {round_num}: Address your opponent's arguments directly and strengthen your position."
    
    @staticmethod
    async def transition_to_judge() -> str:
        """Transition to judge evaluation."""
        return "The debate has concluded. Judge, please evaluate both arguments and declare a winner based on logical consistency, evidence strength, rebuttal effectiveness, and clarity."
