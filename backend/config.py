"""Configuration management for OrchestAI."""

import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

# Load .env file - look in both backend dir and project root
backend_dir = Path(__file__).parent
project_root = backend_dir.parent

# Try to load from backend directory first, then project root
env_paths = [
    backend_dir / ".env",
    project_root / ".env",
]

for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path)
        break
else:
    # Fallback to default load_dotenv behavior
    load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""
    
    def __init__(self):
        # API Keys
        self.openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
        self.tavily_api_key: str = os.getenv("TAVILY_API_KEY", "")
        self.database_url: str = os.getenv("DATABASE_URL", "")
        
        # Application Settings
        self.max_retries: int = int(os.getenv("MAX_RETRIES", "3"))
        self.max_tasks: int = int(os.getenv("MAX_TASKS", "10"))
        self.llm_model: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
        self.cost_limit_usd: float = float(os.getenv("COST_LIMIT_USD", "5.0"))
        
        # Server Settings
        self.host: str = os.getenv("HOST", "0.0.0.0")
        self.port: int = int(os.getenv("PORT", "8000"))
        self.debug: bool = os.getenv("DEBUG", "true").lower() == "true"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

# Create a global settings instance for backward compatibility
settings = get_settings()
