# DebateMind — AI Multi-Agent Debate System

<p align="center">
  <strong>Multi-agent AI debate where Pro and Con agents argue a topic in real time, and an impartial Judge delivers structured evaluations with detailed scoring.</strong>
</p>

DebateMind is an intelligent debate simulation system that orchestrates four specialized AI agents—**Moderator**, **Pro**, **Con**, and **Judge**—to conduct structured debates on any topic. Users provide a debate topic (and optionally an image or document for context), and watch as agents present opening arguments, rebut one another, and receive a final verdict based on logical consistency, evidence strength, rebuttal effectiveness, and clarity.

Inspired by the [Dr. Zero](https://arxiv.org/abs/2601.07055) paper and multi-agent dialectical reasoning systems.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Judge Scoring Rubric](#judge-scoring-rubric)
- [Context Support (Images & Documents)](#context-support-images--documents)
- [Future Enhancements](#future-enhancements)
- [License](#license)

---

## Features

| Feature | Description |
|--------|-------------|
| **Multi-Agent Debate** | Four distinct agents: Moderator introduces the topic; Pro argues in favor; Con argues against; Judge evaluates and declares a winner. |
| **Structured Debate Flow** | Configurable rounds: Opening arguments + rebuttals. Default: Opening + 1 rebuttal round (adjustable via `MAX_DEBATE_ROUNDS`). |
| **Real-Time Streaming** | Debate entries stream to the frontend as they are generated (NDJSON over HTTP), so users see responses appear live. |
| **Image Context** | Upload an image to provide visual context. A vision model (e.g., LLaVA, GPT-4o) describes the image, and agents base arguments on that description. |
| **Document Context** | Upload a PDF or TXT file. Text is extracted (PDF via PyPDF) and injected into the debate topic; agents ground arguments in the document. |
| **LLM Flexibility** | Works with OpenAI API or any OpenAI-compatible endpoint (e.g., Ollama, local models). Configure `OPENAI_API_BASE`, `LLM_MODEL`, and optionally `VISION_MODEL`. |
| **LangGraph Orchestration** | Debate flow is defined as a LangGraph workflow for cleaner architecture and easier scaling. |
| **Parallel Execution** | Pro + Con opening and rebuttals run in parallel (~30–40% faster debates). |
| **CLI Mode** | Run debates from the terminal without the web UI via `python run_cli.py`. |
| **Dark UI** | Modern Next.js frontend with dark theme, role avatars, and collapsible project info. |

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           User (Web UI / CLI)                                │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (React 19, Tailwind 4)                   │
│  • Topic input, image/document upload                                        │
│  • Streaming display of debate entries                                       │
│  • Verdict visualization                                                     │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │ HTTP POST /debate/stream
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend (backend/main.py)                       │
│  • /debate         — Full debate (blocking)                                  │
│  • /debate/stream  — Streaming debate (NDJSON)                               │
│  • CORS, lifespan hooks                                                      │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              Context Utils (backend/context_utils.py)                        │
│  • build_debate_context(): Merges topic + image description + doc text       │
│  • describe_image(): Vision model describes image                            │
│  • extract_text_from_pdf(): PyPDF extracts text from base64 PDF              │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│            LangGraph Debate Engine (debate_engine/debate_graph.py)           │
│  • Moderator → (Pro+Con opening in parallel) → (Pro+Con rebuttal in parallel)│
│  • StateGraph with DebateState; nodes: moderator, openings, rebuttals, judge │
│  • run_debate() / run_debate_stream()                                        │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │
           ┌───────────────────────────────┼───────────────────────────────┐
           ▼                               ▼                               ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Moderator Agent  │  │   Pro Agent      │  │   Con Agent      │  │   Judge Agent    │
│ • introduce()    │  │ • opening_arg()  │  │ • opening_arg()  │  │ • evaluate()     │
│                  │  │ • rebuttal()     │  │ • rebuttal()     │  │ • parse verdict  │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │                     │
         └─────────────────────┴─────────────────────┴─────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LLM Client (backend/llm_client.py)                       │
│  • generate(): Text-only completion                                          │
│  • generate_with_image(): Vision-capable completion (image_url)              │
│  • AsyncOpenAI client (OpenAI API / Ollama-compatible)                       │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│            OpenAI API / Ollama / Other OpenAI-Compatible Endpoints           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Roles

| Agent | Role | Behavior |
|-------|------|----------|
| **Moderator** | Introduces the debate | Presents the topic neutrally in 2–3 sentences. Does not take a stance. |
| **Pro** | Argues in favor | Delivers opening argument, then rebuttals. Addresses Con’s points directly. |
| **Con** | Argues against | Delivers opening argument, then rebuttals. Addresses Pro’s points directly. |
| **Judge** | Evaluates and declares winner | Uses a 4-metric rubric (logic, evidence, rebuttal, clarity), assigns 1–10 per metric, declares PRO or CON winner with reasoning. |

### Debate Flow (Step-by-Step)

1. **User** submits topic (optional: image, document).
2. **Context Utils** build `topic_with_context` (topic + image description + document text).
3. **Moderator** introduces the topic.
4. **Pro + Con** deliver opening arguments **in parallel** (based on topic + context).
5. **Rebuttal rounds** (1 to `MAX_DEBATE_ROUNDS - 1`): Pro and Con rebut **in parallel**.
6. **Judge** evaluates transcript, outputs scores and winner.
7. **Frontend** displays transcript and verdict (streamed or full response).

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| **Backend** | FastAPI, Uvicorn, Pydantic v2 |
| **AI / LLM** | OpenAI Python SDK (OpenAI API or Ollama-compatible endpoints) |
| **Document Processing** | PyPDF for PDF text extraction |
| **Data Models** | Pydantic schemas (`models/schemas.py`) |

---

## Project Structure

```
DebateMind/
├── backend/
│   ├── main.py           # FastAPI app: /debate, /debate/stream, /health
│   ├── config.py         # Settings (LLM_MODEL, VISION_MODEL, MAX_DEBATE_ROUNDS, etc.)
│   ├── llm_client.py     # OpenAI client, generate(), generate_with_image()
│   └── context_utils.py  # Image description, PDF extraction, build_debate_context()
├── debate_engine/
│   ├── debate_graph.py   # LangGraph workflow (parallel Pro+Con)
│   └── manager.py        # Legacy sequential manager (deprecated)
├── agents/
│   ├── base.py           # format_history(), call_llm()
│   ├── moderator.py      # ModeratorAgent.introduce()
│   ├── pro_agent.py      # ProAgent.opening_argument(), rebuttal()
│   ├── con_agent.py      # ConAgent.opening_argument(), rebuttal()
│   └── judge_agent.py    # JudgeAgent.evaluate(), verdict parsing
├── debate_engine/
│   ├── debate_graph.py   # LangGraph workflow (primary)
│   └── manager.py        # Legacy manager (deprecated)
├── models/
│   └── schemas.py        # DebateRequest, DebateResponse, DebateEntry, JudgeVerdict, Speaker, JudgeScores
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx      # Main UI: topic input, image/doc upload, streaming transcript, verdict
│   │   ├── layout.tsx    # Root layout, fonts, metadata
│   │   └── globals.css   # Tailwind, custom styles
│   ├── public/
│   │   ├── moderator.svg
│   │   ├── pro-agent.svg
│   │   ├── con-agent.svg
│   │   └── judge.svg
│   └── package.json
├── data/                 # Reserved for future use (transcripts, RAG)
├── run_cli.py            # CLI entrypoint (no frontend)
├── Dockerfile            # Backend container
├── render.yaml           # Render.com deployment
├── .github/workflows/deploy.yml  # CI/CD (backend + frontend + deploy hook)
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

---

## Installation

### Prerequisites

- Python 3.10+
- Node.js 18+ (for frontend)
- (Optional) [Ollama](https://ollama.ai) for local LLMs

### Backend

```bash
# From project root
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

---

## Configuration

Create a `.env` file in the project root (copy from `.env.example`):

```env
# For OpenAI API
OPENAI_API_KEY=sk-...
OPENAI_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# For image context (vision model)
VISION_MODEL=gpt-4o

# For Ollama (local)
# OPENAI_API_KEY=ollama
# OPENAI_API_BASE=http://localhost:11434/v1
# LLM_MODEL=llama3
# VISION_MODEL=llava
```

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API key (use `ollama` for local Ollama) | `""` |
| `OPENAI_API_BASE` | Base URL for OpenAI-compatible API | `http://localhost:11434/v1` |
| `LLM_MODEL` | Model for text generation | `llama3` |
| `VISION_MODEL` | Model for image description (when using image context) | `llava` |
| `MAX_DEBATE_ROUNDS` | 1 = opening only; 2 = opening + 1 rebuttal; 3 = opening + 2 rebuttals | `2` |
| `MAX_ARGUMENT_TOKENS` | Max tokens per argument (reserved for future use) | `200` |

**Frontend API URL**  
Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if the backend is not at `http://localhost:8000`.

---

## Usage

### Web UI

```bash
# Terminal 1: Backend
python -m uvicorn backend.main:app --reload --host 0.0.0.0

# Terminal 2: Frontend
cd frontend && npm run dev
```

- **API:** http://localhost:8000  
- **Frontend:** http://localhost:3000  

Enter a topic, optionally add an image or document, and click **Start debate**. Entries stream in real time; the verdict appears at the end.

### CLI (no frontend)

```bash
python run_cli.py
```

Prompts for a topic, runs the full debate, and prints the transcript and verdict to the terminal. Does not support image/document context (text topic only).

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info and configured `llm_model` |
| `/health` | GET | Health check; returns `status`, `model`, `url` |
| `/debate` | POST | Run full debate (blocking). Body: `DebateRequest`. Returns `DebateResponse`. |
| `/debate/stream` | POST | Stream debate entries. Body: `DebateRequest`. Returns NDJSON stream. |
| `/docs` | GET | Swagger UI |

### `DebateRequest` (POST body)

```json
{
  "topic": "Should AI replace human teachers?",
  "image_base64": null,
  "document_text": null,
  "document_base64": null
}
```

- `topic` (required): Debate topic (min 5 characters).
- `image_base64`: Base64-encoded image (optional). Vision model describes it; context is added to topic.
- `document_text`: Plain text content (optional). Injected into topic.
- `document_base64`: Base64-encoded PDF (optional). Text is extracted and injected into topic.

### Streamed Response (NDJSON)

Each line is a JSON object:

- `{"type": "entry", "entry": {...}}` — Debate entry (speaker, text, round_number)
- `{"type": "verdict", "verdict": {...}}` — Final verdict (winner, pro_scores, con_scores, reasoning)
- `{"type": "done"}` — Stream complete
- `{"type": "error", "message": "..."}` — Error message

---

## Judge Scoring Rubric

The Judge evaluates each side on four metrics (1–10). Total = sum of the four scores.

| Metric | Description |
|--------|-------------|
| **Logical Consistency** | Does the argument follow logically from premises? Are there contradictions or fallacies? |
| **Evidence Strength** | Are cited facts credible, relevant, and well-integrated into the argument? |
| **Rebuttal Effectiveness** | How well did each side address the opponent’s counterpoints? |
| **Clarity** | Is the argument professional, clear, and persuasive? |

The Judge outputs:

- `PRO_SCORES`: logic, evidence, rebuttal, clarity
- `CON_SCORES`: logic, evidence, rebuttal, clarity
- `WINNER`: PRO or CON
- `REASONING`: Short explanation of the decision

---

## Context Support (Images & Documents)

### Image Context

1. User uploads an image in the UI.
2. Image is sent as base64 in `image_base64`.
3. `build_debate_context()` calls `describe_image()`.
4. Vision model (e.g., LLaVA, GPT-4o) returns a description.
5. Description is appended to the topic; all agents see it.

**Requirements:** `VISION_MODEL` set and endpoint supports vision (e.g., `ollama run llava`).

### Document Context

- **TXT:** Sent in `document_text`; used as-is (limited length).
- **PDF:** Sent in `document_base64`; text is extracted with PyPDF, then injected into the topic.

Document text is capped at ~6000 characters to stay within context limits.

---

## Deployment

| Platform | Purpose | Config |
|----------|---------|--------|
| **Vercel** | Frontend | `frontend/vercel.json` — set `NEXT_PUBLIC_API_URL` to your backend URL |
| **Render** | Backend API | `render.yaml` — start command: `uvicorn backend.main:app --host 0.0.0.0 --port 10000` |
| **Docker** | Backend container | `Dockerfile` — `docker build -t debate-mind . && docker run -p 10000:10000 -e OPENAI_API_KEY=... debate-mind` |

**CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`) runs on push/PR: verifies backend imports, builds frontend. Optionally trigger Render deploy by adding `RENDER_DEPLOY_HOOK` as a repo secret.

---

## Future Enhancements

- **Evidence Retrieval (RAG):** ChromaDB/FAISS for retrieving relevant passages to support arguments.
- **Agent Personas:** Specialized roles (e.g., Economist, Philosopher, Scientist) with distinct styles.
- **Self-Reflection:** Agents critique their own arguments before posting.
- **Multi-Agent Debate:** 4–6 agents with varied roles and perspectives.
- **Persistent Transcripts:** Store debate history in `data/` for analysis and replay.

---

## License

MIT
