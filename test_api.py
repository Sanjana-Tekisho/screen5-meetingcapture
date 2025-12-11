
import requests
import json
import time

URL = "http://127.0.0.1:8000/google-meet/create"

def test_create_meeting():
    print(f"Attempting to connect to {URL}...")
    try:
        response = requests.post(
            URL, 
            json={
                "summary": "Debug Meeting",
                "start_time": None,
                "end_time": None
            },
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"FAILED to connect: {e}")
        print("Is the backend running?")

if __name__ == "__main__":
    test_create_meeting()
