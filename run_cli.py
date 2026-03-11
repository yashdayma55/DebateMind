"""CLI to run a debate without the API (for testing)."""
import asyncio
from debate_engine.manager import DebateManager
from models.schemas import Speaker


async def main():
    topic = input("Enter debate topic: ").strip() or "Should AI replace human teachers?"
    manager = DebateManager()
    result = await manager.run_debate(topic)
    
    print("\n" + "=" * 60)
    print(f"TOPIC: {result.topic}")
    print("=" * 60)
    for entry in result.transcript:
        label = entry.speaker.value.upper()
        print(f"\n[{label}]")
        print(entry.text)
    if result.verdict:
        v = result.verdict
        print("\n" + "-" * 60)
        print(f"WINNER: {v.winner.value.upper()}")
        print(f"Pro Total: {v.pro_scores.total} | Con Total: {v.con_scores.total}")
        print(f"Reasoning: {v.reasoning}")


if __name__ == "__main__":
    asyncio.run(main())
