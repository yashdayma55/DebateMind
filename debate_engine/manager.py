"""Debate Manager - orchestrates the full debate flow."""
import json
from typing import AsyncGenerator, List

from models.schemas import (
    DebateEntry,
    DebateResponse,
    JudgeVerdict,
    Speaker,
)
from backend.config import settings

from agents.moderator import ModeratorAgent
from agents.pro_agent import ProAgent
from agents.con_agent import ConAgent
from agents.judge_agent import JudgeAgent


class DebateManager:
    """Orchestrates debate rounds, agents, and produces final transcript + verdict."""
    
    def __init__(self):
        self.moderator = ModeratorAgent()
        self.pro = ProAgent()
        self.con = ConAgent()
        self.judge = JudgeAgent()
        self.history: List[DebateEntry] = []
    
    async def run_debate(self, topic: str) -> DebateResponse:
        """Execute full debate: moderator → opening → rebuttals → judge."""
        self.history = []
        
        # Round 0: Moderator introduces
        intro = await self.moderator.introduce(topic)
        self.history.append(DebateEntry(speaker=Speaker.MODERATOR, text=intro, round_number=0))
        
        # Round 1: Opening arguments
        pro_open = await self.pro.opening_argument(topic, self.history)
        self.history.append(DebateEntry(speaker=Speaker.PRO, text=pro_open, round_number=1))
        
        con_open = await self.con.opening_argument(topic, self.history)
        self.history.append(DebateEntry(speaker=Speaker.CON, text=con_open, round_number=1))
        
        # Rebuttal rounds
        max_rounds = settings.MAX_DEBATE_ROUNDS
        for r in range(1, max_rounds):
            pro_rebuttal = await self.pro.rebuttal(topic, self.history, r + 1)
            self.history.append(DebateEntry(speaker=Speaker.PRO, text=pro_rebuttal, round_number=r + 1))
            
            con_rebuttal = await self.con.rebuttal(topic, self.history, r + 1)
            self.history.append(DebateEntry(speaker=Speaker.CON, text=con_rebuttal, round_number=r + 1))
        
        # Judge evaluates
        verdict = await self.judge.evaluate(topic, self.history)
        
        # Add judge summary to transcript
        summary = self._format_verdict_summary(verdict)
        self.history.append(DebateEntry(speaker=Speaker.JUDGE, text=summary, round_number=max_rounds + 1))
        
        return DebateResponse(
            topic=topic,
            transcript=self.history,
            verdict=verdict,
        )

    async def run_debate_stream(self, topic: str) -> AsyncGenerator[str, None]:
        """Stream debate entries as they're generated. Yields JSON lines."""
        self.history = []

        # Moderator
        intro = await self.moderator.introduce(topic)
        entry = DebateEntry(speaker=Speaker.MODERATOR, text=intro, round_number=0)
        self.history.append(entry)
        yield json.dumps({"type": "entry", "entry": entry.model_dump()}) + "\n"

        # Pro opening
        pro_open = await self.pro.opening_argument(topic, self.history)
        entry = DebateEntry(speaker=Speaker.PRO, text=pro_open, round_number=1)
        self.history.append(entry)
        yield json.dumps({"type": "entry", "entry": entry.model_dump()}) + "\n"

        # Con opening
        con_open = await self.con.opening_argument(topic, self.history)
        entry = DebateEntry(speaker=Speaker.CON, text=con_open, round_number=1)
        self.history.append(entry)
        yield json.dumps({"type": "entry", "entry": entry.model_dump()}) + "\n"

        # Rebuttal rounds
        max_rounds = settings.MAX_DEBATE_ROUNDS
        for r in range(1, max_rounds):
            pro_rebuttal = await self.pro.rebuttal(topic, self.history, r + 1)
            entry = DebateEntry(speaker=Speaker.PRO, text=pro_rebuttal, round_number=r + 1)
            self.history.append(entry)
            yield json.dumps({"type": "entry", "entry": entry.model_dump()}) + "\n"

            con_rebuttal = await self.con.rebuttal(topic, self.history, r + 1)
            entry = DebateEntry(speaker=Speaker.CON, text=con_rebuttal, round_number=r + 1)
            self.history.append(entry)
            yield json.dumps({"type": "entry", "entry": entry.model_dump()}) + "\n"

        # Judge
        verdict = await self.judge.evaluate(topic, self.history)
        summary = self._format_verdict_summary(verdict)
        entry = DebateEntry(speaker=Speaker.JUDGE, text=summary, round_number=max_rounds + 1)
        self.history.append(entry)
        yield json.dumps({"type": "entry", "entry": entry.model_dump()}) + "\n"
        yield json.dumps({"type": "verdict", "verdict": verdict.model_dump()}) + "\n"
        yield json.dumps({"type": "done"}) + "\n"

    def _format_verdict_summary(self, v: JudgeVerdict) -> str:
        """Format judge verdict as readable summary."""
        return (
            f"Pro Score: {v.pro_scores.total} "
            f"(Logic: {v.pro_scores.logical_consistency}, Evidence: {v.pro_scores.evidence_strength}, "
            f"Rebuttal: {v.pro_scores.rebuttal_effectiveness}, Clarity: {v.pro_scores.clarity})\n"
            f"Con Score: {v.con_scores.total} "
            f"(Logic: {v.con_scores.logical_consistency}, Evidence: {v.con_scores.evidence_strength}, "
            f"Rebuttal: {v.con_scores.rebuttal_effectiveness}, Clarity: {v.con_scores.clarity})\n\n"
            f"Winner: {v.winner.value.upper()}\n\n"
            f"Reasoning: {v.reasoning}"
        )
