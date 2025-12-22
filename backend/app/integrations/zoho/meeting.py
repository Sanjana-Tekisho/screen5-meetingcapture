import os
import requests
from app.integrations.zoho.auth import get_access_token

BASE_URL = "https://meeting.zoho.com"
ZSOID = os.getenv("ZOHO_ZSOID")

def create_meeting(subject, start_time, duration):
    token = get_access_token()

    headers = {
        "Authorization": f"Zoho-oauthtoken {token}",
        "X-ZSOURCE": "screen5",
        "Content-Type": "application/json",
    }

    payload = {
        "subject": subject,
        "start_time": start_time,
        "duration": duration,
    }

    resp = requests.post(
        f"{BASE_URL}/meeting/api/v2/{ZSOID}/sessions",
        json=payload,
        headers=headers,
    )

    return resp.json()
