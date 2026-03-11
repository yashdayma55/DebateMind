"""Judge Agent - evaluates arguments and declares a winner."""
from typing import List
from agents.base import call_llm, format_history
from models.schemas import DebateEntry, Speaker, JudgeScores, JudgeVerdict


SYSTEM = """You are an impartial debate judge. Your role is to evaluate arguments objectively using this rubric:

1. Logical Consistency (1-10): Does the argument follow from evidence without contradiction or fallacies?
2. Evidence Strength (1-10): Are cited facts credible, relevant, and well-integrated?
3. Rebuttal Effectiveness (1-10): How well did each side address the opponent's counterpoints?
4. Clarity (1-10): Is the argument professional, clear, and persuasive?

Be fair. Do not favor length over substance. Avoid position bias (first vs second speaker).
Output your evaluation in this exact format:

PRO_SCORES: logic=X, evidence=Y, rebuttal=Z, clarity=W
CON_SCORES: logic=X, evidence=Y, rebuttal=Z, clarity=W
WINNER: PRO or CON
REASONING: (2-4 sentences explaining your decision)
"""


class JudgeAgent:
    """Agent that evaluates debate and declares a winner."""
    
    @staticmethod
    async def evaluate(topic: str, history: List[DebateEntry]) -> JudgeVerdict:
        """Evaluate the full debate and return verdict."""
        prompt = f"""Topic: {topic}

Full debate transcript:
{format_history(history)}

Evaluate both sides using the rubric. Assign scores 1-10 for each metric. Declare a winner and explain your reasoning.

Output in the exact format:
PRO_SCORES: logic=X, evidence=X, rebuttal=X, clarity=X
CON_SCORES: logic=X, evidence=X, rebuttal=X, clarity=X
WINNER: PRO or CON
REASONING: ..."""
        
        raw = await call_llm(SYSTEM, prompt, max_tokens=250)
        return _parse_verdict(raw)


def _parse_verdict(raw: str) -> JudgeVerdict:
    """Parse judge output into structured verdict. Fallback on parse errors."""
    try:
        lines = raw.strip().split("\n")
        pro_scores = JudgeScores(logical_consistency=7, evidence_strength=7, rebuttal_effectiveness=7, clarity=7)
        con_scores = JudgeScores(logical_consistency=7, evidence_strength=7, rebuttal_effectiveness=7, clarity=7)
        winner = Speaker.PRO
        reasoning = "Evaluation complete."
        
        for line in lines:
            line = line.strip().upper()
            if line.startswith("PRO_SCORES:"):
                pro_scores = _parse_scores(line.replace("PRO_SCORES:", "").strip())
            elif line.startswith("CON_SCORES:"):
                con_scores = _parse_scores(line.replace("CON_SCORES:", "").strip())
            elif line.startswith("WINNER:"):
                w = line.replace("WINNER:", "").strip()
                winner = Speaker.CON if "CON" in w else Speaker.PRO
            elif line.startswith("REASONING:"):
                reasoning = raw.split("REASONING:")[-1].strip() if "REASONING:" in raw else "See evaluation."
        
        return JudgeVerdict(
            winner=winner,
            pro_scores=pro_scores,
            con_scores=con_scores,
            reasoning=reasoning,
        )
    except Exception:
        return JudgeVerdict(
            winner=Speaker.PRO,
            pro_scores=JudgeScores(logical_consistency=7, evidence_strength=7, rebuttal_effectiveness=7, clarity=7),
            con_scores=JudgeScores(logical_consistency=7, evidence_strength=7, rebuttal_effectiveness=7, clarity=7),
            reasoning="Automatic fallback verdict.",
        )


def _parse_scores(s: str) -> JudgeScores:
    """Parse score line like 'logic=8, evidence=6, rebuttal=7, clarity=8'."""
    d = {}
    for part in s.replace(" ", "").split(","):
        if "=" in part:
            k, v = part.split("=", 1)
            try:
                d[k.lower()] = max(1, min(10, int(v)))
            except ValueError:
                d[k.lower()] = 7
    return JudgeScores(
        logical_consistency=d.get("logic", 7),
        evidence_strength=d.get("evidence", 7),
        rebuttal_effectiveness=d.get("rebuttal", 7),
        clarity=d.get("clarity", 7),
    )
