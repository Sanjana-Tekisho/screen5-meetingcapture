from fastapi import FastAPI
from app.routers import transcription, google_meet
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="ElevenLabs Scribe STT Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcription.router)
app.include_router(google_meet.router)

@app.get("/")
async def root():
    return {"message": "ElevenLabs Scribe STT Backend is running"}
