from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    ELEVENLABS_API_KEY: str = "dummy_key_for_dev"
    CALENDLY_API_KEY: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore extra env vars not defined in this model

settings = Settings()

