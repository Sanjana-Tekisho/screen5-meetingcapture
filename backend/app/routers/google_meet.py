from fastapi import APIRouter, HTTPException
from app.services.google_service import GoogleService

router = APIRouter(
    prefix="/google-meet",
    tags=["google-meet"]
)


from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CreateMeetingRequest(BaseModel):
    summary: str = "New Meeting"
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

google_service = GoogleService()

@router.post("/create")
async def create_meeting(request: CreateMeetingRequest):
    """
    Create a new Google Meet meeting (Instant or Scheduled).
    """
    try:
        result = await google_service.create_meeting(
            summary=request.summary,
            start_time=request.start_time,
            end_time=request.end_time
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
