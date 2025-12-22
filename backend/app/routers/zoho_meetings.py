from fastapi import APIRouter
from app.integrations.zoho.meeting import create_meeting

router = APIRouter()

@router.post("/zoho/meetings")
def create_zoho_meeting():
    return create_meeting(
        subject="Demo Meeting",
        start_time="2025-12-20T15:00:00",
        duration=30
    )

