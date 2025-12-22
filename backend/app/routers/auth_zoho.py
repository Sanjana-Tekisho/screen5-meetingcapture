from dotenv import load_dotenv
import os
import requests
from fastapi import APIRouter, Request

load_dotenv()

router = APIRouter()

CLIENT_ID = os.getenv("ZOHO_CLIENT_ID")
CLIENT_SECRET = os.getenv("ZOHO_CLIENT_SECRET")

@router.get("/auth/zoho/callback")
async def zoho_oauth_callback(request: Request):
    code = request.query_params.get("code")
    accounts_server = request.query_params.get("accounts-server")

    print("CLIENT_ID =", CLIENT_ID)
    print("CLIENT_SECRET =", CLIENT_SECRET)

    token_response = requests.post(
        f"{accounts_server}/oauth/v2/token",
        params={
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri": "http://127.0.0.1:8000/auth/zoho/callback",
            "code": code
        }
    )

    return token_response.json()

