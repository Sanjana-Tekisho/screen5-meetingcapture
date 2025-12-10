from fastapi import APIRouter, HTTPException
from app.services.google_service import GoogleService

router = APIRouter(
    prefix="/google-meet",
    tags=["google-meet"]
)

google_service = GoogleService()

@router.get("/transcript/{meeting_id}")
async def get_transcript(meeting_id: str):
    """
    Get the transcript for a specific Google Meet meeting.
    """
    try:
        transcript = await google_service.get_transcript(meeting_id)
        if not transcript:
            raise HTTPException(status_code=404, detail="Transcript not found")
        return transcript
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recordings")
async def list_recordings():
    """
    List available recordings/meetings from Google Drive (Mocked).
    """
    try:
        recordings = await google_service.list_recordings()
        return recordings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
