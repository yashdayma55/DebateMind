"""Utilities for extracting context from images and documents."""
import base64
from typing import Optional

from backend import llm_client


async def describe_image(image_base64: str) -> str:
    """Use vision model to describe the image for debate context."""
    try:
        return await llm_client.generate_with_image(
            prompt="Describe this image in detail. Focus on content relevant for a debate. Be concise (2-4 sentences).",
            image_base64=image_base64,
            max_tokens=150,
        )
    except Exception as e:
        return f"[Image description unavailable: {e}]"


def extract_text_from_pdf(pdf_base64: str) -> str:
    """Extract text from base64-encoded PDF."""
    try:
        from pypdf import PdfReader
        import io
        pdf_bytes = base64.b64decode(pdf_base64)
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text.strip()[:8000]  # Limit length
    except Exception as e:
        return f"[PDF extraction failed: {e}]"


async def build_debate_context(
    topic: str,
    image_base64: Optional[str] = None,
    document_text: Optional[str] = None,
    document_base64: Optional[str] = None,
) -> tuple[str, str]:
    """Build topic and context for debate. Returns (full_topic, context_for_prompts)."""
    context_parts = []
    
    if image_base64:
        desc = await describe_image(image_base64)
        context_parts.append(f"Reference image content:\n{desc}")
    
    doc_text = document_text
    if document_base64:
        doc_text = extract_text_from_pdf(document_base64)
    if doc_text:
        context_parts.append(f"Reference document:\n{doc_text[:6000]}")
    
    if not context_parts:
        return topic, ""
    
    context = "\n\n---\n\n".join(context_parts)
    full_topic = f"{topic}\n\nIMPORTANT: Base your arguments on this reference material:\n\n{context}"
    return full_topic, context
