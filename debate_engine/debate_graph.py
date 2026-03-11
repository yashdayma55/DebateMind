"""LangGraph debate workflow with parallel Pro+Con execution for ~30-40% faster debates."""
import asyncio
import json
import logging
from typing import Annotated, AsyncGenerator, Literal, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.moderator import ModeratorAgent
from agents.pro_agent import ProAgent
from agents.con_agent import ConAgent
from agents.judge_agent import JudgeAgent
from backend.config import settings
from models.schemas import DebateEntry, JudgeScores, JudgeVerdict, Speaker

logger = logging.getLogger(__name__)


# Custom reducer: append DebateEntry dicts to transcript list
def append_transcript(left: list, right: list) -> list:
    """Append new entries to transcript. Both can be list of dicts or DebateEntry."""
    out = list(left) if left else []
    additions = right if isinstance(right, list) else [right]
    for item in additions:
        if isinstance(item, dict):
            out.append(item)
        else:
            out.append(item.model_dump() if hasattr(item, "model_dump") else item)
    return out


class DebateState(TypedDict, total=False):
    """State for the debate graph."""
    topic: str
    transcript: Annotated[list, append_transcript]
    round: int
    verdict: Optional[dict]
    judge_verdicts: Optional[list]
    max_rounds: int
    num_judges: int


def _entries_from_state(state: DebateState) -> list[DebateEntry]:
    """Convert transcript dicts to DebateEntry objects."""
    result = []
    for t in state.get("transcript", []):
        if isinstance(t, DebateEntry):
            result.append(t)
        else:
            result.append(
                DebateEntry(
                    speaker=Speaker(t["speaker"]),
                    text=t["text"],
                    round_number=t.get("round_number", 0),
                )
            )
    return result


# --- Graph nodes ---

async def moderator_node(state: DebateState) -> dict:
    """Moderator introduces the topic."""
    topic = state["topic"]
    logger.info("debate started", extra={"topic": topic[:80]})
    intro = await ModeratorAgent.introduce(topic)
    entry = DebateEntry(speaker=Speaker.MODERATOR, text=intro, round_number=0)
    logger.info("agent response", extra={"agent": "moderator"})
    return {"transcript": [entry.model_dump()], "num_judges": state.get("num_judges", 1)}


async def openings_node(state: DebateState) -> dict:
    """Pro + Con opening arguments in parallel (~30-40% faster)."""
    topic = state["topic"]
    history = _entries_from_state(state)
    pro = ProAgent()
    con = ConAgent()
    pro_task = pro.opening_argument(topic, history)
    con_task = con.opening_argument(topic, history)
    pro_text, con_text = await asyncio.gather(pro_task, con_task)
    pro_entry = DebateEntry(speaker=Speaker.PRO, text=pro_text, round_number=1)
    con_entry = DebateEntry(speaker=Speaker.CON, text=con_text, round_number=1)
    logger.info("agent response", extra={"agent": "pro", "phase": "opening"})
    logger.info("agent response", extra={"agent": "con", "phase": "opening"})
    return {"transcript": [pro_entry.model_dump(), con_entry.model_dump()], "round": 1, "num_judges": state.get("num_judges", 1)}


async def rebuttals_node(state: DebateState) -> dict:
    """Pro + Con rebuttals in parallel."""
    topic = state["topic"]
    history = _entries_from_state(state)
    current_round = state.get("round", 1)
    round_num = current_round + 1  # rebuttal round number (e.g. 2 for first rebuttal)
    pro = ProAgent()
    con = ConAgent()
    pro_task = pro.rebuttal(topic, history, round_num)
    con_task = con.rebuttal(topic, history, round_num)
    pro_text, con_text = await asyncio.gather(pro_task, con_task)
    pro_entry = DebateEntry(speaker=Speaker.PRO, text=pro_text, round_number=round_num)
    con_entry = DebateEntry(speaker=Speaker.CON, text=con_text, round_number=round_num)
    logger.info("agent response", extra={"agent": "pro", "phase": "rebuttal", "round": round_num})
    logger.info("agent response", extra={"agent": "con", "phase": "rebuttal", "round": round_num})
    return {"transcript": [pro_entry.model_dump(), con_entry.model_dump()], "round": round_num, "num_judges": state.get("num_judges", 1)} 


async def judge_node(state: DebateState) -> dict:
    """Judge(s) evaluate and declare winner. Supports 1-3 judges with aggregated verdict."""
    topic = state["topic"]
    history = _entries_from_state(state)
    num_judges = state.get("num_judges", 1)
    num_judges = max(1, min(3, num_judges))

    verdicts = await asyncio.gather(
        *[JudgeAgent.evaluate(topic, history) for _ in range(num_judges)]
    )
    verdict = _aggregate_verdicts(verdicts)
    summary = _format_verdict_summary(verdict)
    entry = DebateEntry(speaker=Speaker.JUDGE, text=summary, round_number=state.get("round", 2) + 1)
    logger.info("judge verdict", extra={"winner": verdict.winner.value, "num_judges": num_judges})
    judge_verdicts_data = [v.model_dump() for v in verdicts]
    verdict_data = verdict.model_dump()
    verdict_data["judge_verdicts"] = judge_verdicts_data
    return {
        "transcript": [entry.model_dump()],
        "verdict": verdict_data,
    }


def _clamp_score(v: int) -> int:
    return max(1, min(10, v))


def _aggregate_verdicts(verdicts: list[JudgeVerdict]) -> JudgeVerdict:
    """Aggregate multiple judge verdicts: average scores, majority vote for winner."""
    if len(verdicts) == 1:
        return verdicts[0]

    n = len(verdicts)
    pro_avg = JudgeScores(
        logical_consistency=_clamp_score(round(sum(v.pro_scores.logical_consistency for v in verdicts) / n)),
        evidence_strength=_clamp_score(round(sum(v.pro_scores.evidence_strength for v in verdicts) / n)),
        rebuttal_effectiveness=_clamp_score(round(sum(v.pro_scores.rebuttal_effectiveness for v in verdicts) / n)),
        clarity=_clamp_score(round(sum(v.pro_scores.clarity for v in verdicts) / n)),
    )
    con_avg = JudgeScores(
        logical_consistency=_clamp_score(round(sum(v.con_scores.logical_consistency for v in verdicts) / n)),
        evidence_strength=_clamp_score(round(sum(v.con_scores.evidence_strength for v in verdicts) / n)),
        rebuttal_effectiveness=_clamp_score(round(sum(v.con_scores.rebuttal_effectiveness for v in verdicts) / n)),
        clarity=_clamp_score(round(sum(v.con_scores.clarity for v in verdicts) / n)),
    )

    pro_wins = sum(1 for v in verdicts if v.winner == Speaker.PRO)
    winner = Speaker.PRO if pro_wins > n // 2 else Speaker.CON
    if pro_wins == n // 2 and n % 2 == 0:
        winner = Speaker.PRO if pro_avg.total >= con_avg.total else Speaker.CON

    consensus = f"Based on {n} judges: {pro_wins} voted PRO, {n - pro_wins} voted CON. "
    consensus += f"Averaged scores — Pro: {pro_avg.total} pts, Con: {con_avg.total} pts. "
    consensus += f"Final winner: {winner.value.upper()}."

    return JudgeVerdict(
        winner=winner,
        pro_scores=pro_avg,
        con_scores=con_avg,
        reasoning=consensus,
    )


def _format_verdict_summary(v: JudgeVerdict) -> str:
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


def should_rebuttal(state: DebateState) -> Literal["rebuttals", "judge"]:
    """Route: more rebuttal rounds or go to judge."""
    current_round = state.get("round", 1)
    max_rounds = state.get("max_rounds", settings.MAX_DEBATE_ROUNDS)
    # max_rounds=2 means opening + 1 rebuttal (round goes 1 -> 2)
    if current_round < max_rounds:
        return "rebuttals"
    return "judge"


# --- Build graph ---

def build_debate_graph():
    """Build the LangGraph debate workflow."""
    builder = StateGraph(DebateState)
    builder.add_node("moderator", moderator_node)
    builder.add_node("openings", openings_node)
    builder.add_node("rebuttals", rebuttals_node)
    builder.add_node("judge", judge_node)

    builder.add_edge(START, "moderator")
    builder.add_edge("moderator", "openings")
    builder.add_edge("openings", "rebuttals")
    builder.add_conditional_edges("rebuttals", should_rebuttal, {"rebuttals": "rebuttals", "judge": "judge"})
    builder.add_edge("judge", END)

    return builder.compile()


# --- High-level API ---

def get_graph():
    """Get or create compiled graph (lazy init)."""
    if not hasattr(get_graph, "_graph"):
        get_graph._graph = build_debate_graph()
    return get_graph._graph


async def run_debate(topic: str, num_rounds: int = 2, num_judges: int = 1) -> dict:
    """Run full debate and return result compatible with DebateResponse."""
    graph = get_graph()
    initial = {
        "topic": topic,
        "transcript": [],
        "max_rounds": num_rounds,
        "num_judges": max(1, min(3, num_judges)),
    }
    result = await graph.ainvoke(initial)
    transcript = [
        DebateEntry(speaker=Speaker(t["speaker"]), text=t["text"], round_number=t.get("round_number", 0))
        for t in result.get("transcript", [])
    ]
    verdict_data = result.get("verdict")
    from models.schemas import JudgeVerdict
    verdict = JudgeVerdict.model_validate(verdict_data) if verdict_data else None
    return {
        "topic": topic,
        "transcript": transcript,
        "verdict": verdict,
    }


async def run_debate_stream(topic: str, num_rounds: int = 2, num_judges: int = 1) -> AsyncGenerator[str, None]:
    """Stream debate entries as NDJSON. Uses graph.astream() for incremental updates."""
    graph = get_graph()
    initial = {
        "topic": topic,
        "transcript": [],
        "max_rounds": num_rounds,
        "num_judges": max(1, min(3, num_judges)),
    }
    last_len = 0
    verdict_sent = False
    # stream_mode="values" gives full state after each node
    async for state in graph.astream(initial, stream_mode="values"):
        transcript = state.get("transcript", [])
        for i in range(last_len, len(transcript)):
            entry = transcript[i]
            yield json.dumps({"type": "entry", "entry": entry}) + "\n"
        last_len = len(transcript)
        if state.get("verdict") and not verdict_sent:
            yield json.dumps({"type": "verdict", "verdict": state["verdict"]}) + "\n"
            verdict_sent = True
    yield json.dumps({"type": "done"}) + "\n"
