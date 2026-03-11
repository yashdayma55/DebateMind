"""FastAPI backend for the AI Debate System."""
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from models.schemas import DebateRequest, DebateResponse
from debate_engine.debate_graph import run_debate as graph_run_debate, run_debate_stream as graph_run_debate_stream
from backend.config import settings

# Structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("debate_mind")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("LLM ready: %s @ %s", settings.LLM_MODEL, settings.OPENAI_API_BASE)
    yield


app = FastAPI(
    title="AI Debate System",
    description="Multi-agent debate where Pro and Con agents argue, and a Judge decides the winner.",
    version="2.0.0",
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
        "version": "2.0.0",
    }


@app.post("/debate", response_model=DebateResponse)
async def run_debate(request: DebateRequest):
    """Run a full debate on the given topic."""
    try:
        from backend.context_utils import build_debate_context
        topic_with_context, _ = await build_debate_context(
            topic=request.topic,
            image_base64=request.image_base64,
            document_text=request.document_text,
            document_base64=request.document_base64,
        )
        result = await graph_run_debate(
            topic_with_context,
            num_rounds=request.num_rounds or settings.MAX_DEBATE_ROUNDS,
            num_judges=request.num_judges or 1,
        )
        return DebateResponse(**result)
    except Exception as e:
        logger.exception("Debate failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/debate/stream")
async def run_debate_stream(request: DebateRequest):
    """Stream debate entries. Accepts optional image_base64, document_text, or document_base64."""
    async def generate():
        try:
            from backend.context_utils import build_debate_context
            topic_with_context, _ = await build_debate_context(
                topic=request.topic,
                image_base64=request.image_base64,
                document_text=request.document_text,
                document_base64=request.document_base64,
            )
            async for chunk in graph_run_debate_stream(
                topic_with_context,
                num_rounds=request.num_rounds or settings.MAX_DEBATE_ROUNDS,
                num_judges=request.num_judges or 1,
            ):
                yield chunk
        except Exception as e:
            logger.exception("Stream debate failed")
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
