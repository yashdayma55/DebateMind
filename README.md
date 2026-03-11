# DebateMind — AI Multi-Agent Debate System

Multi-agent debate where **Pro** and **Con** agents argue a topic and a **Judge** decides the winner using structured reasoning and a scoring rubric.

Inspired by the [Dr. Zero](https://arxiv.org/abs/2601.07055) paper and bespoke multi-agent dialectical systems.

## Architecture

```
User Interface (Next.js)
        ↓
Debate API (FastAPI)
        ↓
Debate Manager
        ↓
┌─────────────────────┐
│ Moderator Agent     │  ← Introduces topic
│ Pro Agent           │  ← Argues for
│ Con Agent           │  ← Argues against
│ Judge Agent         │  ← Scores & declares winner
└─────────────────────┘
```

## Quick Start

### 1. Install dependencies

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

### 2. Configure LLM

**Option A: Ollama (local, free)**

```bash
# Install Ollama, then:
ollama run llama3
```

Create `.env`:

```
OPENAI_API_KEY=ollama
OPENAI_API_BASE=http://localhost:11434/v1
LLM_MODEL=llama3
```

**Option B: OpenAI API**

```
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

### 3. Run

```bash
# Terminal 1: Backend (from project root)
python -m uvicorn backend.main:app --reload --host 0.0.0.0

# Terminal 2: Frontend
cd frontend && npm run dev
```

- API: http://localhost:8000  
- Frontend: http://localhost:3000  

### CLI (no frontend)

```bash
python run_cli.py
```

## Project Structure

```
DebateMind/
├── backend/          # FastAPI API
├── agents/           # Moderator, Pro, Con, Judge
├── debate_engine/    # Debate manager & flow
├── models/           # Pydantic schemas
├── frontend/         # Next.js UI
├── data/             # Future: transcripts, RAG
└── run_cli.py        # CLI for testing
```

## Judge Scoring Rubric

| Metric              | Description                              |
|---------------------|------------------------------------------|
| Logical Consistency | Argument reasoning, no fallacies         |
| Evidence Strength   | Credibility and relevance of citations   |
| Rebuttal Effectiveness | How well counterpoints were addressed |
| Clarity             | Professional delivery and persuasiveness |

## Future Enhancements (Phase 8+)

- **Evidence Retrieval**: RAG with ChromaDB/FAISS
- **Agent Personas**: Economist, Philosopher, Scientist
- **Self-Reflection**: Agents critique before posting
- **Multi-Agent Debate**: 4–6 agents with varied roles

## License

MIT
