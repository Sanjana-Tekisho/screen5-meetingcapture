from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ELEVENLABS_API_KEY: str
    HF_TOKEN: str
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    ASSEMBLYAI_API_KEY: str
    GEMINI_API_KEY: str
    OPENAI_API_KEY: str
    ZOHO_CLIENT_ID: str
    ZOHO_CLIENT_SECRET: str
    ZOHO_REFRESH_TOKEN: str
    class Config:
        env_file = ".env"

settings = Settings()
