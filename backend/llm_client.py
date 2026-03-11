"""LLM client for agent inference. Supports OpenAI API and Ollama via config settings."""
from openai import AsyncOpenAI
from backend.config import settings

# Initialize client using configuration (handles both OpenAI and local Ollama)
client = AsyncOpenAI(
    api_key=settings.OPENAI_API_KEY or "ollama",  # Default for local Ollama
    base_url=settings.OPENAI_API_BASE,
)

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
