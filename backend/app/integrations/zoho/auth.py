import os
import requests

CLIENT_ID = os.getenv("ZOHO_CLIENT_ID")
CLIENT_SECRET = os.getenv("ZOHO_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("ZOHO_REFRESH_TOKEN")

ACCOUNTS_BASE = "https://accounts.zoho.in"

def get_access_token():
    resp = requests.post(
        f"{ACCOUNTS_BASE}/oauth/v2/token",
        params={
            "grant_type": "refresh_token",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "refresh_token": REFRESH_TOKEN,
        }
    )
    data = resp.json()

    if "access_token" not in data:
        raise RuntimeError(data)

    return data["access_token"]
