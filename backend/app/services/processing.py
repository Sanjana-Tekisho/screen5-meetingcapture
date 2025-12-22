import asyncio
import os
from app.services.pyannote_service import PyannoteService
from app.services.llm_service import LLMService
from app.core.config import settings
# Helper to avoid import errors if supabase not installed (it is, but good practice)
try:
    from supabase import create_client, Client
except ImportError:
    pass

async def process_recording(file_path: str, meeting_id: str = None):
    """
    Run high-precision diarization on a completed meeting recording.
    Updates the 'meetings' table with transcript and MoM.
    """
    print(f"\n[Post-Processing] Starting analysis for: {file_path}")
    
    try:
        # Initialize Services
        pyannote_service = PyannoteService()
        llm_service = LLMService()
        
        # Diarization
        print("[Post-Processing] Running Pyannote Diarization...")
        loop = asyncio.get_event_loop()
        output = await loop.run_in_executor(None, lambda: pyannote_service.pipeline(file_path, return_embeddings=True))
        
        # Unpack tuple
        if isinstance(output, tuple):
             dia, embeddings = output
        else:
             dia = getattr(output, 'speaker_diarization', output)
             embeddings = getattr(output, 'speaker_embeddings', None)

        # Merge speakers
        dia = pyannote_service.merge_speakers(dia, embeddings)
        
        print(f"\n[Post-Processing] Analysis Complete! Found {len(dia.labels())} unique speakers.")
        
        # Format Transcript
        transcript_lines = []
        idx = 0
        for turn, _, _ in dia.itertracks(yield_label=True):
            pass 

        # Let's perform STT on the full file using ElevenLabs (since we have the key and client)
        print("[Post-Processing] Running STT on full file...")
        from elevenlabs import ElevenLabs
        el_client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
        
        with open(file_path, "rb") as f:
             audio_data = f.read()
             
        # Re-transcribe full file for best quality
        # We use a helper to get the transcript object
        transcript_obj = el_client.speech_to_text.convert(
            model_id="scribe_v1",
            file=audio_data, 
        )
        
        full_text_transcript = []

        words = getattr(transcript_obj, 'words', [])
        
        # Simple alignment
        for word in words:
            start = word.start
            end = word.end
            text = word.text
            
            # Find speaker from Pyannote dia
            # We search for the segment with max overlap
            speaker = "Unknown"
            max_overlap = 0
            
            for turn, _, label in dia.itertracks(yield_label=True):
                 overlap_start = max(start, turn.start)
                 overlap_end = min(end, turn.end)
                 dur = overlap_end - overlap_start
                 if dur > max_overlap:
                     max_overlap = dur
                     speaker = label
            
            full_text_transcript.append(f"{speaker}: {text}")
            
        # Deduplicate speakers (combine consecutive words from same speaker)
        formatted_transcript = ""
        current_speaker = None
        current_block = []
        
        for item in full_text_transcript:
            spk, txt = item.split(": ", 1)
            if spk != current_speaker:
                if current_speaker:
                    formatted_transcript += f"**{current_speaker}**: {' '.join(current_block)}\n\n"
                current_speaker = spk
                current_block = [txt]
            else:
                current_block.append(txt)
        if current_speaker:
             formatted_transcript += f"**{current_speaker}**: {' '.join(current_block)}\n\n"
             
        print(f"[Post-Processing] Transcript generated ({len(formatted_transcript)} chars).")
        
        if meeting_id:
            await update_meeting_record(meeting_id, file_path, formatted_transcript, llm_service)
        else:
            print("[Post-Processing] No meeting_id provided. Skipping DB update.")
            print("Preview of Transcript:")
            print(formatted_transcript[:200] + "...")

    except Exception as e:
        print(f"[Post-Processing] Error: {e}")
        import traceback
        traceback.print_exc()

async def update_meeting_record(meeting_id: str, file_path: str, transcript: str, llm_service: LLMService):
    url: str = settings.SUPABASE_URL
    key: str = settings.SUPABASE_ANON_KEY
    supabase: Client = create_client(url, key)
    
    print(f"[Supabase] Updating Meeting {meeting_id}...")
    supabase.table("meetings").update({
        "live_transcript": transcript,
        "status": "processing_mom"
    }).eq("id", meeting_id).execute()
    
    # 2. Fetch Notes
    print("[Supabase] Fetching notes for context...")
    response = supabase.table("meetings").select("voice_input_notes").eq("id", meeting_id).execute()
    notes = ""
    if response.data and len(response.data) > 0:
        notes = response.data[0].get("voice_input_notes", "")
        
    # 3. Generate MoM
    print("[Post-Processing] Generating MoM with LLM...")
    mom = await llm_service.generate_mom(transcript, notes)
    print(f"[Post-Processing] MoM Generated: \n{mom}")
    
    # 4. Update MoM
    supabase.table("meetings").update({
        "mom": mom,
        "status": "completed"
    }).eq("id", meeting_id).execute()
    
    print("[Supabase] Meeting updated successfully.")

# Note: ElevenLabs call in process_recording assumes the input file format.
# If converting file to bytes for EL, ensure correct reading.
