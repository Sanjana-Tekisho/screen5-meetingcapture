import asyncio
import websockets
import json

async def test_transcription():
    uri = "ws://localhost:8000/ws/transcribe"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to server")
            
            # Send dummy audio (silence)
            # 1 second of silence, 16kHz, mono, 16-bit
            # 16000 * 2 bytes = 32000 bytes
            dummy_audio = b'\x00' * 32000 
            
            # Send in chunks
            chunk_size = 4000
            for i in range(0, len(dummy_audio), chunk_size):
                await websocket.send(dummy_audio[i:i+chunk_size])
                await asyncio.sleep(0.1) # Simulate real-time
                
            print("Sent audio")
            
            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                print(f"Received: {response}")
            except asyncio.TimeoutError:
                print("No response within timeout (Expected if no speech detected)")
            
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_transcription())
