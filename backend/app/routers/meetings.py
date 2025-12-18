from fastapi import APIRouter, HTTPException
from app.core.config import settings
from supabase import create_client, Client
from pydantic import BaseModel

router = APIRouter()

class MeetingCreateResponse(BaseModel):
    id: str

@router.post("/meetings", response_model=MeetingCreateResponse)
async def create_meeting():
    """
    Creates a new meeting entry in Supabase and returns the ID.
    Using default values for status ('scheduled') and timestamps.
    """
    try:
        url: str = settings.SUPABASE_URL
        key: str = settings.SUPABASE_ANON_KEY
        supabase: Client = create_client(url, key)

        # Insert a new meeting. Assuming 'title' or other fields are optional or have defaults.
        # If the table requires specific fields, we might need to adjust.
        # Based on previous code, 'voice_input_notes', 'live_transcript', 'mom', 'status' exist.
        # 'created_at' usually defaults to now().
        
        # We'll insert a basic record to get an ID.
        response = supabase.table("meetings").insert({
            "status": "scheduled"
        }).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create meeting record")
            
        meeting_id = response.data[0]['id']
        return {"id": meeting_id}

    except Exception as e:
        print(f"Error creating meeting: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str):
    """
    Retrieves a meeting by ID from Supabase.
    """
    try:
        url: str = settings.SUPABASE_URL
        key: str = settings.SUPABASE_ANON_KEY
        supabase: Client = create_client(url, key)

        response = supabase.table("meetings").select("*").eq("id", meeting_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Meeting not found")

        return response.data[0]

    except Exception as e:
        print(f"Error fetching meeting: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class MeetingUpdateRequest(BaseModel):
    mom: str

@router.patch("/meetings/{meeting_id}")
async def update_meeting(meeting_id: str, request: MeetingUpdateRequest):
    """
    Updates a meeting's MoM.
    """
    try:
        url: str = settings.SUPABASE_URL
        key: str = settings.SUPABASE_ANON_KEY
        supabase: Client = create_client(url, key)

        response = supabase.table("meetings").update({
            "mom": request.mom
        }).eq("id", meeting_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Meeting not found or update failed")

        return response.data[0]

    except Exception as e:
        print(f"Error updating meeting: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import UploadFile, File

@router.post("/meetings/{meeting_id}/selfie")
async def upload_selfie(meeting_id: str, file: UploadFile = File(...)):
    """
    Uploads a selfie for the meeting to Supabase Storage and updates the meeting record.
    """
    try:
        url: str = settings.SUPABASE_URL
        key: str = settings.SUPABASE_ANON_KEY
        supabase: Client = create_client(url, key)

        # 1. Upload file to Supabase Storage 'selfies' bucket
        print(f"[Selfie Upload] Reading file for meeting {meeting_id}...")
        file_content = await file.read()
        file_path = f"{meeting_id}/{file.filename}"
        
        print(f"[Selfie Upload] Uploading to 'selfies' bucket at path {file_path}...")
        try:
            storage_response = supabase.storage.from_("selfies").upload(
                file_path,
                file_content,
                {"content-type": file.content_type, "upsert": "true"}
            )
            print("[Selfie Upload] Storage upload successful.")
        except Exception as storage_error:
            print(f"[Selfie Upload] Storage Error: {storage_error}")
            # It might fail if bucket doesn't exist
            raise HTTPException(status_code=500, detail=f"Storage Error: {str(storage_error)}")

        # 2. Get Public URL
        try:
            public_url_response = supabase.storage.from_("selfies").get_public_url(file_path)
            # Check if it returned a raw string (some versions) or a response dict/object
            # Recently it returns a string in many versions of supabase-py
            selfie_url = public_url_response
            print(f"[Selfie Upload] Public URL generated: {selfie_url}")
        except Exception as url_error:
            print(f"[Selfie Upload] Public URL Error: {url_error}")
            raise HTTPException(status_code=500, detail=f"URL Generation Error: {str(url_error)}")

        # 3. Update Meeting Record
        print(f"[Selfie Upload] Updating meeting record {meeting_id} with URL...")
        try:
            update_response = supabase.table("meetings").update({
                "selfie_url": selfie_url
            }).eq("id", meeting_id).execute()
            print("[Selfie Upload] Database update successful.")
        except Exception as db_error:
            print(f"[Selfie Upload] Database Error: {db_error}")
            # This often fails if the column 'selfie_url' doesn't exist
            raise HTTPException(status_code=500, detail=f"Database Error (Check if 'selfie_url' column exists): {str(db_error)}")

        return {"url": selfie_url}

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"[Selfie Upload] Critical Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
