# DebateMind — AI Multi-Agent Debate System

<p align="center">
  <strong>Multi-agent AI debate system. Watch Pro and Con agents argue in real time, with an AI Judge delivering structured evaluations.</strong>
</p>

DebateMind is an intelligent debate simulation system that orchestrates four specialized AI agents—**Moderator**, **Pro**, **Con**, and **Judge**—to conduct structured debates on any topic. Users provide a debate topic (and optionally an image or document for context), choose the number of rounds and judges, and watch as agents present opening arguments, rebut one another with direct engagement, and receive a final verdict based on logical consistency, evidence strength, rebuttal effectiveness, and clarity.

Inspired by the [Dr. Zero](https://arxiv.org/abs/2601.07055) paper and multi-agent dialectical reasoning systems.

### UI Highlights

- **Cyber-tactical dark theme** — Command-center aesthetic with grid background, neon accents (cyan, gold, green, red, purple)
- **Three screens** — Setup (configure & launch), Live Debate (real-time streaming), Verdict (scores & judge panel)
- **Debate History** — Last 3 debates saved in `localStorage`; click any to view the full transcript and verdict

### Screens

| Screen | Description |
|--------|-------------|
| **Setup** | Hero, agent pipeline (Moderator → Pro ↔ Con → Judge), form card (topic, rounds 1–5, judges 1–3, image/document upload), suggested topics, Debate History strip |
| **Live Debate** | Sidebar (topic, config, active agents), round indicator, parallel execution badge, moderator + Pro/Con entries (side-by-side for same round) |
| **Verdict** | Final verdict with trophy, score breakdown (progress bars), individual judge cards, debate execution flow, Start New Debate |

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Working Flow](#working-flow)
- [LangGraph Debate Graph](#langgraph-debate-graph)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Judge Scoring & Unbiased Evaluation](#judge-scoring--unbiased-evaluation)
- [Context Support (Images & Documents)](#context-support-images--documents)
- [Deployment](#deployment)
- [Future Enhancements](#future-enhancements)
- [License](#license)

---

## Overview

DebateMind simulates formal debates with:

- **Configurable rounds** (1–5): Opening only, or opening + up to 4 rebuttal rounds
- **Configurable judges** (1–3): Single judge or panel; individual scores shown separately; verdict aggregated (average scores, majority vote)
- **Parallel execution**: Pro and Con openings run simultaneously; rebuttals run simultaneously (~30–40% faster)
- **Real-time streaming**: Entries appear as they are generated
- **Unbiased evaluation**: Strict anti-bias rules (no position, recency, or length bias)
- **Engaging arguments**: Substantive openings, direct rebuttals that quote and refute opponent claims
- **Multimodal context**: Debate based on images or PDF/TXT documents

---

## Features

### Major Features

| Feature | Description |
|---------|-------------|
| **Multi-Agent Debate** | Four distinct agents: Moderator introduces the topic; Pro argues in favor; Con argues against; Judge(s) evaluate and declare a winner. |
| **LangGraph Orchestration** | Debate flow defined as a `StateGraph` for clear structure, conditional routing (rebuttal loops), and scalability. |
| **Parallel Execution** | Pro + Con opening and rebuttals run in parallel via `asyncio.gather` (~30–40% faster debates). |
| **Multiple Judges (1–3)** | Optional panel of judges; each evaluates independently; verdict aggregates scores (average) and winner (majority vote); individual scores and reasoning shown separately in the UI. |
| **Configurable Rounds** | 1 = opening only; 2 = opening + 1 rebuttal; 3 = opening + 2 rebuttals; up to 5 rounds. |
| **Real-Time Streaming** | NDJSON stream over HTTP; frontend displays entries as they arrive. |
| **Image Context** | Upload an image; vision model describes it; agents base arguments on the description. |
| **Document Context** | Upload PDF or TXT; text extracted and injected into the topic. |
| **Unbiased Judgment** | Judge prompt enforces strict anti-bias rules: no position, recency, or length bias; evaluate each side independently. |
| **Engaging Arguments** | Pro/Con prompts encourage vivid language, concrete examples, and direct rebuttals that quote and refute opponent claims. |

### Minor Features

| Feature | Description |
|---------|-------------|
| **LLM Flexibility** | OpenAI API or any OpenAI-compatible endpoint (Ollama, local models). |
| **CLI Mode** | `python run_cli.py` for terminal-only debates (text topic only). |
| **Cyber-tactical UI** | Next.js frontend with cyber-tactical dark theme, agent pipeline diagram, Debate History (last 3 debates), sidebar config, score breakdown with progress bars. |
| **Structured Logging** | `debate started`, `agent response`, `judge verdict` for debugging. |
| **Health Check** | `/health` endpoint for monitoring. |
| **Docker** | Backend container for deployment. |
| **CI/CD** | GitHub Actions for backend verification and frontend build. |
| **CORS** | Backend allows all origins for frontend flexibility. |

---

## Architecture

### System Architecture Diagram

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                         USER                                 │
                                    │  (Web UI or CLI)                                            │
                                    └──────────────────────────────────┬──────────────────────────┘
                                                                       │
                    ┌──────────────────────────────────────────────────┼──────────────────────────────────────────────────┐
                    │                                                  │                                                  │
                    ▼                                                  ▼                                                  │
    ┌───────────────────────────┐                      ┌───────────────────────────────────┐                             │
    │   Next.js Frontend        │                      │   CLI (run_cli.py)                │                             │
    │   • Topic, rounds, judges │                      │   • Text topic only               │                             │
    │   • Image/document upload │                      │   • Prints transcript + verdict   │                             │
    │   • Streaming display     │                      └───────────────────────────────────┘                             │
    │   • Individual judge UI   │                                                                                        │
    └───────────────┬───────────┘                                                                                        │
                    │ HTTP POST /debate/stream                                                                           │
                    │ Body: { topic, num_rounds, num_judges, image_base64?, document_text?, document_base64? }           │
                    ▼                                                                                                    │
    ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                    FastAPI Backend (backend/main.py)                                                │
    │   Endpoints: /  |  /debate  |  /debate/stream  |  /health  |  /docs                                                 │
    │   CORS, lifespan, structured logging                                                                               │
    └───────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                                        │
                                                                        ▼
    ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │                              Context Utils (backend/context_utils.py)                                               │
    │   build_debate_context()  →  Merges topic + image description + document text                                      │
    │   describe_image()        →  Vision model (LLaVA/GPT-4o) describes image                                           │
    │   extract_text_from_pdf() →  PyPDF extracts text from base64 PDF                                                   │
    └───────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                                        │ topic_with_context
                                                                        ▼
    ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │                    LangGraph Debate Engine (debate_engine/debate_graph.py)                                          │
    │   StateGraph(DebateState)  |  Nodes: moderator, openings, rebuttals, judge                                         │
    │   Conditional edge: rebuttals → (rebuttals | judge) based on max_rounds                                            │
    │   run_debate() / run_debate_stream()                                                                               │
    └───────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                                        │
        ┌───────────────────────┬───────────────────────┬───────────────────────┬───────────────────────┐
        ▼                       ▼                       ▼                       ▼                       │
    ┌─────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐                   │
    │ Moderator   │   │ Pro Agent       │   │ Con Agent       │   │ Judge Agent     │                   │
    │ introduce() │   │ opening_arg()   │   │ opening_arg()   │   │ evaluate()      │                   │
    │             │   │ rebuttal()      │   │ rebuttal()      │   │ (1–3× parallel) │                   │
    └─────────────┘   └────────┬────────┘   └────────┬────────┘   └─────────────────┘                   │
                               │                     │                                                      │
                               └──────────┬──────────┘  (openings + rebuttals run Pro & Con in parallel)  │
                                          │                                                                 │
                                          ▼                                                                 │
    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │                         LLM Client (backend/llm_client.py)                                            │
    │   generate()             →  Text-only completion                                                      │
    │   generate_with_image()  →  Vision completion (image_url)                                             │
    │   AsyncOpenAI (OpenAI API / Ollama-compatible)                                                        │
    └───────────────────────────────────────────────────────────────────┬─────────────────────────────────┘
                                                                        │
                                                                        ▼
    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │                    OpenAI API / Ollama / OpenAI-Compatible Endpoint                                   │
    └─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Working Flow

### End-to-End Flow (Step-by-Step)

```
  User                    Frontend                 Backend                    Debate Engine                    Agents
    │                         │                        │                            │                              │
    │  1. Enter topic         │                        │                            │                              │
    │  2. Set rounds (1-5)    │                        │                            │                              │
    │  3. Set judges (1-3)    │                        │                            │                              │
    │  4. (Optional) Upload   │                        │                            │                              │
    │     image / document    │                        │                            │                              │
    │  5. Click Start debate  │                        │                            │                              │
    │ ──────────────────────► │                        │                            │                              │
    │                         │  POST /debate/stream   │                            │                              │
    │                         │  { topic, num_rounds,  │                            │                              │
    │                         │    num_judges, ... }   │                            │                              │
    │                         │ ─────────────────────► │                            │                              │
    │                         │                        │  build_debate_context()    │                              │
    │                         │                        │  (image → vision, PDF →    │                              │
    │                         │                        │   text extraction)         │                              │
    │                         │                        │ ─────────────────────────► │                              │
    │                         │                        │                            │  moderator_node()            │
    │                         │                        │                            │ ────────────────────────────► Moderator
    │                         │                        │  { type: "entry", entry }  │ ◄──────────────────────────── introduce()
    │                         │ ◄───────────────────────────────────────────────────│                              │
    │                         │  (stream)              │                            │  openings_node()             │
    │                         │                        │                            │ ────────┬────────────────────► Pro (opening)
    │                         │                        │                            │         └────────────────────► Con (opening)
    │                         │                        │                            │  (parallel)                   │
    │                         │  { entry }, { entry }  │                            │ ◄──────────────────────────── │
    │                         │ ◄──────────────────────│                            │  rebuttals_node() (loop)      │
    │                         │                        │                            │ ────────┬────────────────────► Pro (rebuttal)
    │                         │                        │                            │         └────────────────────► Con (rebuttal)
    │                         │  { entry }, { entry }  │                            │  (parallel)                   │
    │                         │ ◄──────────────────────│                            │  judge_node()                 │
    │                         │                        │                            │ ─────────────────────────────► Judge × N
    │                         │                        │                            │  (N = num_judges, parallel)   │
    │                         │  { verdict }           │                            │ ◄──────────────────────────── │
    │                         │  { type: "done" }      │                            │                              │
    │                         │ ◄──────────────────────│                            │                              │
    │  Display transcript +   │                        │                            │                              │
    │  individual judges +    │                        │                            │                              │
    │  final verdict          │                        │                            │                              │
    │ ◄────────────────────── │                        │                            │                              │
```

### Request → Response Data Flow

```
DebateRequest                    DebateState (LangGraph)                    Streamed Output
────────────────                 ───────────────────────                   ────────────────
topic          ───────────────►  topic
num_rounds     ───────────────►  max_rounds
num_judges     ───────────────►  num_judges                ──────────────►  {"type":"entry","entry":{...}}
image_base64   ──► context_utils
document_*     ──► build_debate_context()
                      │
                      ▼ topic_with_context
                transcript[]     (accumulated via reducer)
                round            (1, 2, 3, ...)
                verdict          (aggregated)
                judge_verdicts[] (when num_judges > 1)     ──────────────►  {"type":"verdict","verdict":{...}}
                                                                           {"type":"done"}
```

---

## LangGraph Debate Graph

### Graph Structure

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  moderator  │  ← Introduces topic
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  openings   │  ← Pro + Con in PARALLEL
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  rebuttals  │  ← Pro + Con in PARALLEL
                    └──────┬──────┘
                           │
                           │  should_rebuttal(state)
                           ├──────────────────┐
                           │ round < max_rounds
                           │                  │ round >= max_rounds
                           ▼                  ▼
                    ┌─────────────┐    ┌─────────────┐
                    │  rebuttals  │    │    judge    │  ← Judge × N in PARALLEL
                    └──────┬──────┘    └──────┬──────┘
                           │                  │
                           └────────┬─────────┘
                                    │
                                    ▼
                             ┌─────────────┐
                             │     END     │
                             └─────────────┘
```

### State Schema (`DebateState`)

| Key | Type | Description |
|-----|------|-------------|
| `topic` | str | Debate topic (with context merged) |
| `transcript` | list | Debate entries (reducer: append) |
| `round` | int | Current round (1 after opening, 2+ after rebuttals) |
| `max_rounds` | int | From request (e.g. 2 = opening + 1 rebuttal) |
| `num_judges` | int | From request (1–3) |
| `verdict` | dict | Final aggregated verdict |

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| **Backend** | FastAPI, Uvicorn, Pydantic v2 |
| **Orchestration** | LangGraph (StateGraph, conditional edges) |
| **AI / LLM** | OpenAI Python SDK (OpenAI API or Ollama-compatible) |
| **Document Processing** | PyPDF for PDF text extraction |
| **Data Models** | Pydantic schemas (`models/schemas.py`) |

---

## Project Structure

```
DebateMind/
├── backend/
│   ├── main.py           # FastAPI app: /debate, /debate/stream, /health, /docs
│   ├── config.py         # Settings (LLM, VISION_MODEL, MAX_DEBATE_ROUNDS)
│   ├── llm_client.py     # generate(), generate_with_image()
│   └── context_utils.py  # build_debate_context(), describe_image(), extract_text_from_pdf()
│
├── debate_engine/
│   ├── debate_graph.py   # LangGraph workflow (primary)
│   └── manager.py        # Legacy sequential manager (deprecated)
│
├── agents/
│   ├── base.py           # format_history(), call_llm()
│   ├── moderator.py      # ModeratorAgent.introduce()
│   ├── pro_agent.py      # ProAgent.opening_argument(), rebuttal()
│   ├── con_agent.py      # ConAgent.opening_argument(), rebuttal()
│   └── judge_agent.py    # JudgeAgent.evaluate(), verdict parsing
│
├── models/
│   └── schemas.py        # DebateRequest, DebateResponse, DebateEntry, JudgeVerdict, JudgeScores, Speaker
│
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx      # Main UI: topic, rounds, judges, image/doc upload, streaming, verdict
│   │   ├── layout.tsx    # Root layout, fonts, metadata
│   │   └── globals.css   # Tailwind, custom styles
│   ├── public/
│   │   ├── moderator.svg
│   │   ├── pro-agent.svg
│   │   ├── con-agent.svg
│   │   └── judge.svg
│   └── package.json
│
├── run_cli.py            # CLI entrypoint (text topic only)
├── Dockerfile            # Backend container
├── render.yaml           # Render.com deployment
├── .github/workflows/deploy.yml
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
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend && npm install
```

---

## Configuration

Create a `.env` file in the project root:

```env
# OpenAI API
OPENAI_API_KEY=sk-...
OPENAI_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# Image context (vision model)
VISION_MODEL=gpt-4o

# Ollama (local)
# OPENAI_API_KEY=ollama
# OPENAI_API_BASE=http://localhost:11434/v1
# LLM_MODEL=llama3
# VISION_MODEL=llava
```

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API key (use `ollama` for local) | `""` |
| `OPENAI_API_BASE` | Base URL | `http://localhost:11434/v1` |
| `LLM_MODEL` | Text model | `llama3` |
| `VISION_MODEL` | Image model | `llava` |
| `MAX_DEBATE_ROUNDS` | Default rounds if not in request | `2` |

Frontend: Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if backend is not at `http://localhost:8000`.

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

### CLI

```bash
python run_cli.py
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info, `llm_model`, `version` |
| `/health` | GET | `status`, `model`, `url` |
| `/debate` | POST | Full debate (blocking) |
| `/debate/stream` | POST | Streaming debate (NDJSON) |
| `/docs` | GET | Swagger UI |

### `DebateRequest`

```json
{
  "topic": "Should AI replace human teachers?",
  "image_base64": null,
  "document_text": null,
  "document_base64": null,
  "num_rounds": 2,
  "num_judges": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topic` | string | Yes | Min 5 chars |
| `image_base64` | string | No | Base64 image for vision context |
| `document_text` | string | No | Plain text context |
| `document_base64` | string | No | Base64 PDF (text extracted) |
| `num_rounds` | int | No | 1–5, default 2 |
| `num_judges` | int | No | 1–3, default 1 |

### Streamed Response (NDJSON)

| Type | Payload |
|------|---------|
| `entry` | `{ speaker, text, round_number }` |
| `verdict` | `{ winner, pro_scores, con_scores, reasoning, judge_verdicts? }` |
| `done` | — |
| `error` | `{ message }` |

When `num_judges` > 1, `verdict.judge_verdicts` contains each judge's scores and reasoning.

---

## Judge Scoring & Unbiased Evaluation

### Rubric (1–10 per metric)

| Metric | Description |
|--------|-------------|
| **Logical Consistency** | Argument follows logically; no fallacies or contradictions |
| **Evidence Strength** | Facts credible, relevant, well-integrated; quality over quantity |
| **Rebuttal Effectiveness** | Direct engagement with opponent claims; weakening of counterarguments |
| **Clarity** | Clear, professional, persuasive delivery |

Total = sum of four scores (max 40 per side).

### Anti-Bias Rules

The judge prompt enforces:

- **No position bias** — Pro first / Con second must not affect scores
- **No recency bias** — Last speaker gets no advantage
- **No length bias** — Substance over word count
- **Independent evaluation** — Score each side on its own before comparing

When multiple judges are used: scores are averaged; winner by majority vote; tie broken by higher total score.

---

## Context Support (Images & Documents)

### Image

1. User uploads image → base64
2. `describe_image()` calls vision model (LLaVA/GPT-4o)
3. Description appended to topic; all agents see it

### Document (PDF/TXT)

- **TXT:** Sent as `document_text`; used as-is
- **PDF:** Sent as `document_base64`; PyPDF extracts text; injected into topic

Document text capped at ~6000 chars.

---

## Deployment

| Platform | Config |
|----------|--------|
| **Vercel** | `frontend/vercel.json`; set `NEXT_PUBLIC_API_URL` |
| **Render** | `render.yaml`; `uvicorn backend.main:app --host 0.0.0.0 --port 10000` |
| **Docker** | `docker build -t debate-mind .`; set `OPENAI_API_KEY` |

**CI/CD:** `.github/workflows/deploy.yml` — backend import check, frontend build; optional `RENDER_DEPLOY_HOOK` for auto-deploy.

---

## Future Enhancements

- **RAG:** ChromaDB/FAISS for evidence retrieval
- **Agent Personas:** Economist, Philosopher, Scientist
- **Self-Reflection:** Agents critique before posting
- **Debate History:** Backend persistence for unlimited history and cross-device sync (currently `localStorage`, last 3)

---

## License

MIT
