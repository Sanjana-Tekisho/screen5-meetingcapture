import asyncio
import io
from typing import AsyncGenerator
from elevenlabs import ElevenLabs
from app.core.config import settings
from app.models.transcript import TranscriptEvent

class ElevenLabsService:
    def __init__(self):
        self.api_key = settings.ELEVENLABS_API_KEY
        self.client = ElevenLabs(api_key=self.api_key)

        #Buffer configuration
        self.buffer_duration = 10.0
        self.overlap_duration=2.0
        self.sample_rate=16000
        self.bytes_per_second=self.sample_rate*2

        #Calculate buffer size in bytes
        self.buffer_size=int(self.buffer_duration*self.bytes_per_second)
        self.overlap_size=int(self.overlap_duration*self.bytes_per_second)

    async def transcribe_stream(self, audio_stream: AsyncGenerator[bytes, None]):
        """
        Buffer audio chunks and send to ElevenLabs API with diarization.
        Stream results word-by-word back to the client.
        """

        #Buffer audio chunks
        audio_buffer = bytearray()
        overlap_buffer = bytearray()
        last_end_time=0.0

        try:
            async for chunk in audio_stream:
                #Add chunk to buffer
                audio_buffer.extend(chunk)

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
                    
    async def _process_buffer(self, audio_bytes: bytes, time_offset: float) -> AsyncGenerator[TranscriptEvent, None]:
        """
        Send audio buffer to ElevenLabs API and stream words back.
        """
        try:
            # Create a file-like object from bytes
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = "audio.pcm"
            
            # Call ElevenLabs API with diarization
            # Run in thread pool since it's a blocking call
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.speech_to_text.convert(
                    model_id="scribe_v1",  # Use scribe_v1 for diarization support
                    file=audio_file,
                    file_format="pcm_s16le_16",  # 16-bit PCM, 16kHz
                    diarize=True,
                    num_speakers=None,  # Auto-detect
                    language_code="en", # Enforce English
                    timestamps_granularity="word"  # word-level timestamps
                )
            )
            
            # Parse response and stream words
            if hasattr(response, 'words') and response.words:
                for word_data in response.words:
                    word_text = word_data.text if hasattr(word_data, 'text') else str(word_data)
                    
                    # DEBUG LOGGING
                    raw_speaker = getattr(word_data, 'speaker', 'MISSING')
                    print(f"DEBUG Scribe word: '{word_text}', Raw Speaker: {raw_speaker}")

                    # Filter out non-speech sounds (e.g. (footsteps), [laughter])
                    if word_text.startswith('(') and word_text.endswith(')'):
                        continue
                    if word_text.startswith('[') and word_text.endswith(']'):
                        continue
                    
                    word_start = (word_data.start if hasattr(word_data, 'start') and word_data.start is not None else 0.0) + time_offset
                    word_end = (word_data.end if hasattr(word_data, 'end') and word_data.end is not None else 0.0) + time_offset
                    speaker = word_data.speaker if hasattr(word_data, 'speaker') else None
                    
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
            
            # Also send full transcript for the segment
            if hasattr(response, 'text') and response.text:
                yield TranscriptEvent(
                    type="segment_complete",
                    text=response.text,
                    speaker_id=None,
                    is_final=True
                )
                
        except Exception as e:
            print(f"Buffer processing error: {e}")
            yield TranscriptEvent(type="error", text=f"Processing error: {str(e)}", is_final=False)
        