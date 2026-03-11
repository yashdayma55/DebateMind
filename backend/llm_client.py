"""LLM client for agent inference. Supports OpenAI API and Ollama via config settings."""
from openai import AsyncOpenAI
from backend.config import settings

client = AsyncOpenAI(
    api_key=settings.OPENAI_API_KEY or "ollama",
    base_url=settings.OPENAI_API_BASE,
)


async def generate_with_image(
    prompt: str,
    image_base64: str,
    system_prompt: str = "",
    max_tokens: int = 500,
) -> str:
    """Generate text with image input (vision models: llava, gpt-4o, etc.)."""
    content = [
        {"type": "text", "text": prompt},
        {
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
        },
    ]
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": content})
    model = getattr(settings, "VISION_MODEL", None) or settings.LLM_MODEL
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=0.5,
    )
    return response.choices[0].message.content.strip()


async def generate(prompt: str, system_prompt: str = "", max_tokens: int = 500) -> str:
    """Generate text using the configured LLM."""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"[Error: {str(e)}. Ensure Ollama is running (ollama run {settings.LLM_MODEL}) or set OPENAI_API_KEY.]"
