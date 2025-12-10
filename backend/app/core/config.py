from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ELEVENLABS_API_KEY: str = "dummy_key_for_dev"

    class Config:
        env_file = ".env"

settings = Settings()
