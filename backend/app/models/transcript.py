from pydantic import BaseModel
from typing import Optional, List

class SpeakerSegment(BaseModel):
    speaker_id: str
    text: str
    start: float
    end: float

class TranscriptEvent(BaseModel):
    type: str  # e.g. "transcription", "partial", "final"
    text: str
    speaker_id: Optional[str] = None
    is_final: bool = False

class Word(BaseModel):
    text: str
    start:float
    end:float
    speaker_id: Optional[str] = None

class TranscriptSegment(BaseModel):
    text:str
    speaker_id: Optional[str] = None
    start:float
    end:float   
    words: List[Word]     
