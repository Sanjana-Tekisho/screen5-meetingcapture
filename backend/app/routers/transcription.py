from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.elevenlabs_service import ElevenLabsService
import asyncio

router = APIRouter()

@router.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    service = ElevenLabsService()
    
    # Queue to hold audio chunks from client
    audio_queue = asyncio.Queue()
    
    async def audio_generator():
        while True:
            chunk = await audio_queue.get()
            if chunk is None:
                break
            yield chunk

    # Task to receive from client
    async def receive_from_client():
        try:
            while True:
                # Expecting raw bytes from client microphone
                data = await websocket.receive_bytes()
                await audio_queue.put(data)
        except WebSocketDisconnect:
            await audio_queue.put(None)
        except Exception:
            await audio_queue.put(None)

    # Task to process with ElevenLabs
    async def process_transcription():
        try:
            async for transcript_event in service.transcribe_stream(audio_generator()):
                await websocket.send_json(transcript_event.dict())
        except Exception as e:
            print(f"Processing error: {e}")
            # Try to send error to client
            # await websocket.send_json({"type": "error", "message": str(e)})

    # Run both
    receive_task = asyncio.create_task(receive_from_client())
    process_task = asyncio.create_task(process_transcription())
    
    await asyncio.wait([receive_task, process_task], return_when=asyncio.FIRST_COMPLETED)
    
    # Cleanup
    if not receive_task.done():
        receive_task.cancel()
    if not process_task.done():
        process_task.cancel()
