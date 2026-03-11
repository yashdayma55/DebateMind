"""FastAPI backend for the AI Debate System."""
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from models.schemas import DebateRequest, DebateResponse
from debate_engine.manager import DebateManager
from backend.config import settings
from backend import llm_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[DebateMind] LLM ready: {settings.LLM_MODEL} @ {settings.OPENAI_API_BASE}")
    yield


app = FastAPI(
    title="AI Debate System",
    description="Multi-agent debate where Pro and Con agents argue, and a Judge decides the winner.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "AI Debate System API",
        "docs": "/docs",
        "llm_model": settings.LLM_MODEL,
    }


@app.post("/debate", response_model=DebateResponse)
async def run_debate(request: DebateRequest):
    """Run a full debate on the given topic."""
    try:
        manager = DebateManager()
        result = await manager.run_debate(request.topic)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/debate/stream")
async def run_debate_stream(request: DebateRequest):
    """Stream debate entries as they're generated. Returns newline-delimited JSON."""
    async def generate():
        try:
            manager = DebateManager()
            async for chunk in manager.run_debate_stream(request.topic):
                yield chunk
        except Exception as e:
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": settings.LLM_MODEL,
        "url": settings.OPENAI_API_BASE,
    }
