from fastapi import FastAPI
from app.routers import transcription, google_meet
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="ElevenLabs Scribe STT Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcription.router)
app.include_router(google_meet.router)

@app.get("/")
async def root():
    return {"message": "ElevenLabs Scribe STT Backend is running"}
