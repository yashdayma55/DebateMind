"""Configuration for the AI Debate System."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Project root: parent of backend/ folder
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # LLM Configuration - works with OpenAI API or Ollama (OpenAI-compatible)
    OPENAI_API_KEY: str = ""
    OPENAI_API_BASE: str = "http://localhost:11434/v1"  # Ollama default
    LLM_MODEL: str = "llama3"  # Use "gpt-4o-mini" with OpenAI API
    
    # Debate settings (1 = opening only, 2 = +1 rebuttal, 3 = +2 rebuttals)
    MAX_DEBATE_ROUNDS: int = 2  # Opening + 1 rebuttal round
    MAX_ARGUMENT_TOKENS: int = 200
    
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        extra="ignore",
    )


settings = Settings()
