from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.pyannote_service import pyannote_instance
from app.core.config import settings
from supabase import create_client, Client
import numpy as np
import io

router = APIRouter()

@router.post("/voice-profiles/enroll")
async def enroll_voice_profile(user_id: str, file: UploadFile = File(...)):
    """
    Enroll a voice profile for a user.
    Accepts an audio file (wav/mp3), extracts embedding, and saves to Supabase Storage.
    """
    if not pyannote_instance:
         raise HTTPException(status_code=500, detail="Pyannote service not initialized")
    
    try:
        # Read audio
        audio_bytes = await file.read()
        
        # Generate embedding
        embedding = pyannote_instance.generate_embedding(audio_bytes)
        
        if embedding is None:
            raise HTTPException(status_code=400, detail="Could not extract voice embedding from audio. Please try again with clear speech.")
            
        # Serialize embedding to .npy format
        buffer = io.BytesIO()
        np.save(buffer, embedding)
        buffer.seek(0)
        file_content = buffer.read()
        
        # Upload to Supabase Storage
        url: str = settings.SUPABASE_URL
        key: str = settings.SUPABASE_ANON_KEY
        supabase: Client = create_client(url, key)
        
        file_path = f"{user_id}.npy"
        
        print(f"[Voice Profile] Uploading profile for {user_id} to 'voice-profiles' bucket...")
        
        # Upload/Upsert
        response = supabase.storage.from_("voice-profiles").upload(
            file_path,
            file_content,
            {"content-type": "application/octet-stream", "upsert": "true"}
        )
        
        print(f"[Voice Profile] Upload successful for {user_id}")
        return {"message": "Voice profile enrolled successfully", "user_id": user_id}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"[Voice Profile] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
