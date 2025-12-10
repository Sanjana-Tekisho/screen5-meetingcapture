from fastapi import FastAPI
from app.routers import transcription
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="ElevenLabs Scribe STT Backend")

app.include_router(transcription.router)

@app.get("/")
async def root():
    return {"message": "ElevenLabs Scribe STT Backend is running"}
