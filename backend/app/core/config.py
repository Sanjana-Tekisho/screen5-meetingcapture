from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ELEVENLABS_API_KEY: str
    HF_TOKEN: str
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    ASSEMBLYAI_API_KEY: str
    GEMINI_API_KEY: str
    OPENAI_API_KEY: str

    class Config:
        env_file = ".env"

settings = Settings()
