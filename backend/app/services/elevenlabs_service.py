import asyncio
import io
from typing import AsyncGenerator
from elevenlabs import ElevenLabs
from app.core.config import settings
from app.models.transcript import TranscriptEvent
from app.services.pyannote_service import PyannoteService, pyannote_instance
from supabase import create_client, Client
import numpy as np

class ElevenLabsService:
    def __init__(self):
        self.api_key = settings.ELEVENLABS_API_KEY
        self.client = ElevenLabs(api_key=self.api_key)
        
        # Initialize PyannoteService (Use Singleton)
        if pyannote_instance:
            self.pyannote = pyannote_instance
            self.use_pyannote = True
        else:
            print(f"Warning: Pyannote singleton not available.")
            self.use_pyannote = False

        #Buffer configuration
        self.buffer_duration = 10.0
        self.overlap_duration=2.0
        self.sample_rate=16000
        self.bytes_per_second=self.sample_rate*2

        #Calculate buffer size in bytes
        self.buffer_size=int(self.buffer_duration*self.bytes_per_second)
        self.overlap_size=int(self.overlap_duration*self.bytes_per_second)

    def load_user_profile(self, user_id: str):
        """
        Fetch user's voice profile from Supabase and load into Pyannote.
        """
        if not self.use_pyannote or not user_id:
            return

        try:
            print(f"DEBUG: Fetching voice profile for {user_id}...")
            url: str = settings.SUPABASE_URL
            key: str = settings.SUPABASE_ANON_KEY
            supabase: Client = create_client(url, key)
            
            # Download .npy file
            file_path = f"{user_id}.npy"
            try:
                response = supabase.storage.from_("voice-profiles").download(file_path)
                
                # Load numpy array from bytes
                with io.BytesIO(response) as f:
                    embedding = np.load(f)
                    
                # Load into Pyannote
                self.pyannote.load_profile("User", embedding)
                print(f"DEBUG: Successfully loaded voice profile for User ({user_id})")
                
            except Exception as e:
                print(f"DEBUG: Could not load voice profile (might not exist): {e}")
                
        except Exception as e:
            print(f"Error in load_user_profile: {e}")

    async def transcribe_stream(self, audio_stream: AsyncGenerator[bytes, None], meeting_id: str = None):
        """
        Buffer audio chunks and send to ElevenLabs API for text and Pyannote for diarization.
        Stream results word-by-word back to the client.
        """

        #Buffer audio chunks
        audio_buffer = bytearray()
        overlap_buffer = bytearray()
        last_end_time=0.0
        full_audio_buffer = bytearray()

        # Define recordings directory
        recordings_dir = "recordings"
        import os
        if not os.path.exists(recordings_dir):
            os.makedirs(recordings_dir)
            
        session_id = f"session_{int(asyncio.get_event_loop().time())}" # Simple ID

        try:
            async for chunk in audio_stream:
                #Add chunk to buffers
                audio_buffer.extend(chunk)
                full_audio_buffer.extend(chunk) # Save for post-processing

                #Check if buffer is full(5 seconds worth of audio)
                if len(audio_buffer)>=self.buffer_size:
                    #process this buffer
                    async for event in self._process_buffer(bytes(audio_buffer),last_end_time):
                        yield event

                        # Update last_end_time from the last word
                        if event.type=="word" and hasattr(event,'end'):
                            last_end_time=event.end

                    # Keep overlap for next buffer (last 0.5 seconds)
                    overlap_buffer = audio_buffer[-self.overlap_size:]
                        
                    # Reset buffer with overlap
                    audio_buffer = bytearray(overlap_buffer)    

            # Process remaining audio in buffer
            if len(audio_buffer) > self.overlap_size:
                async for event in self._process_buffer(
                    bytes(audio_buffer), 
                    last_end_time
                ):
                    yield event
                    
        except Exception as e:
            print(f"ElevenLabs Service Error: {e}")
            yield TranscriptEvent(type="error", text=str(e), is_final=False)
        
        finally:
            # Save full recording
            try:
                import wave
                filename = f"{recordings_dir}/{session_id}.wav"
                print(f"DEBUG: Saving full session recording to {filename}...")
                with wave.open(filename, "wb") as wav_file:
                    wav_file.setnchannels(1) # Mono
                    wav_file.setsampwidth(2) # 16-bit
                    wav_file.setframerate(self.sample_rate)
                    wav_file.writeframes(full_audio_buffer)
                print(f"DEBUG: Recording saved. Triggering post-processing...")
                
                # Trigger background task
                from app.services.processing import process_recording
                # We use create_task to fire and forget so we don't block the closure
                asyncio.create_task(process_recording(filename, meeting_id))
                
            except Exception as e:
                print(f"Error saving recording: {e}")
                    
    async def _process_buffer(self, audio_bytes: bytes, time_offset: float) -> AsyncGenerator[TranscriptEvent, None]:
        """
        Send audio buffer to ElevenLabs API and Pyannote concurrently.
        """
        try:
            # Create a file-like object from bytes for ElevenLabs
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = "audio.pcm"
            
            loop = asyncio.get_event_loop()
            
            # Define tasks
            # 1. ElevenLabs Transcription (blocking)
            def run_elevenlabs():
                return self.client.speech_to_text.convert(
                    model_id="scribe_v1", 
                    file=audio_file,
                    file_format="pcm_s16le_16",
                    diarize=not self.use_pyannote, # Disable EL diarization if we use Pyannote to save potential conflicts/latency? 
                                                   # Actually, EL returns words, we need words. 
                                                   # keeping diarize=True on EL is fine, we just overwrite speakers.
                    num_speakers=None,
                    language_code="en",
                    timestamps_granularity="word"
                )

            # 2. Pyannote Diarization (if enabled)
            async def run_pyannote():
                if self.use_pyannote:
                    # Pyannote is CPU/GPU intensive, run in executor too
                    return await loop.run_in_executor(
                        None, 
                        lambda: self.pyannote.diarize_chunk(audio_bytes)
                    )
                return []

            # Execute concurrently
            transcription_future = loop.run_in_executor(None, run_elevenlabs)
            diarization_future = run_pyannote()
            
            results = await asyncio.gather(transcription_future, diarization_future)
            response = results[0]
            speaker_segments = results[1]
            
            print(f"DEBUG: Pyannote Segments for buffer: {speaker_segments}")
            
            # Filter out short segments (noise) < 0.4 seconds
            filtered_segments = []
            for start, end, label in speaker_segments:
                duration = end - start
                if duration < 0.4:
                    print(f"DEBUG: Filtering out short segment for {label}: {duration:.3f}s (Noise/Ghost)")
                else:
                    filtered_segments.append((start, end, label))
            speaker_segments = filtered_segments

            # Helper to find speaker for a timestamp
            def get_speaker(start_time, end_time):
                best_label = None
                max_overlap = 0.0
                
                for seg_start, seg_end, label in speaker_segments:
                    # Calculate overlap
                    overlap_start = max(start_time, seg_start)
                    overlap_end = min(end_time, seg_end)
                    overlap_dur = overlap_end - overlap_start
                    
                    if overlap_dur > 0:
                        if overlap_dur > max_overlap:
                            max_overlap = overlap_dur
                            best_label = label
                            
                if best_label:
                     print(f"DEBUG: Match! Word ({start_time}-{end_time}) overlaps {best_label} by {max_overlap:.3f}s")
                     return best_label
                     
                print(f"DEBUG: No Match for Word ({start_time}-{end_time}) in segments")
                return None

            # Accumulator for final print
            final_transcript_acc = []

            # Parse response and stream words
            if hasattr(response, 'words') and response.words:
                for word_data in response.words:
                    word_text = word_data.text if hasattr(word_data, 'text') else str(word_data)
                    
                    # Filter out non-speech sounds
                    if word_text.startswith('(') and word_text.endswith(')'):
                        continue
                    if word_text.startswith('[') and word_text.endswith(']'):
                        continue
                    
                    # Times relative to start of buffer
                    local_start = (word_data.start if hasattr(word_data, 'start') and word_data.start is not None else 0.0)
                    local_end = (word_data.end if hasattr(word_data, 'end') and word_data.end is not None else 0.0)
                    
                    print(f"DEBUG: Check Word: '{word_text}' [{local_start:.3f} - {local_end:.3f}]")
                    
                    # Determine Speaker
                    speaker = None
                    if self.use_pyannote and speaker_segments:
                        speaker = get_speaker(local_start, local_end)
                    
                    # Fallback to ElevenLabs speaker if Pyannote missed it or is disabled
                    if not speaker:
                         speaker = word_data.speaker if hasattr(word_data, 'speaker') else None

                    # Accumulate for print
                    final_transcript_acc.append((speaker, word_text))

                    # Global times
                    word_start = local_start + time_offset
                    word_end = local_end + time_offset
                    
                    # Create word event
                    yield TranscriptEvent(
                        type="word",
                        text=word_text,
                        speaker_id=speaker,
                        is_final=True,
                        start=word_start,
                        end=word_end
                    )
                    
                    # Small delay to simulate streaming (optional)
                    await asyncio.sleep(0.01)

            # Print Final Transcript for this chunk
            if final_transcript_acc:
                print("\n--- Final Diarized Transcript (Chunk) ---")
                current_speaker = None
                current_sentence = []
                for spk, txt in final_transcript_acc:
                    if spk != current_speaker:
                        if current_speaker is not None:
                            print(f"{current_speaker}: {' '.join(current_sentence)}")
                        current_speaker = spk
                        current_sentence = [txt]
                    else:
                        current_sentence.append(txt)
                if current_speaker is not None:
                    print(f"{current_speaker}: {' '.join(current_sentence)}")
                print("-----------------------------------------\n")
            
            # Also send full transcript for the segment (optional, mostly for debug or chunk-based UI)
            if hasattr(response, 'text') and response.text:
                yield TranscriptEvent(
                    type="segment_complete",
                    text=response.text,
                    speaker_id=None,
                    is_final=True
                )
                
        except Exception as e:
            print(f"Buffer processing error: {e}")
            import traceback
            traceback.print_exc()
            yield TranscriptEvent(type="error", text=f"Processing error: {str(e)}", is_final=False)
        