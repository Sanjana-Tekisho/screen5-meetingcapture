
from typing import List, Dict, Optional
import asyncio
from app.models.transcript import TranscriptEvent, Word

import os.path
import datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/calendar']

class GoogleService:
    def __init__(self):
        self.creds = None
        self.service = None

    def _authenticate(self):
        """Authentication flow for Google Calendar API"""
        print(f"DEBUG: Starting authentication. Current CWD: {os.getcwd()}")
        if self.creds and self.creds.valid:
            print("DEBUG: Using existing in-memory credentials")
            return

        token_path = 'token.json'
        # Check current dir
        if os.path.exists(token_path):
             print(f"DEBUG: Found token.json in {os.getcwd()}")
        # Check parent dir
        elif os.path.exists(os.path.join('..', 'token.json')):
             print(f"DEBUG: Found token.json in parent directory")
             token_path = os.path.join('..', 'token.json')
        else:
             print("DEBUG: token.json NOT found in CWD or parent")

        if os.path.exists(token_path):
            try:
                self.creds = Credentials.from_authorized_user_file(token_path, SCOPES)
                print("DEBUG: Loaded credentials from file")
            except Exception as e:
                print(f"DEBUG: Error loading credentials: {e}")
        
        if not self.creds or not self.creds.valid:
            print("DEBUG: Credentials invalid or missing, attempting refresh/login")
            if self.creds and self.creds.expired and self.creds.refresh_token:
                print("DEBUG: Refreshing token")
                self.creds.refresh(Request())
            else:
                print("DEBUG: Need new login")
                if not os.path.exists('backend/credentials.json') and os.path.exists('credentials.json'):
                     # Fallback if in root
                     flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
                elif os.path.exists('backend/credentials.json'):
                     flow = InstalledAppFlow.from_client_secrets_file('backend/credentials.json', SCOPES)
                elif os.path.exists('../credentials.json') or os.path.exists(os.path.join('..', 'credentials.json')):
                     # Fallback to parent dir if running in backend dir
                     flow = InstalledAppFlow.from_client_secrets_file(os.path.join('..', 'credentials.json'), SCOPES)
                else:
                    # Provide an absolute path fallback if running from weird cwd
                    flow = InstalledAppFlow.from_client_secrets_file(
                        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'credentials.json'),
                        SCOPES
                    )
                self.creds = flow.run_local_server(port=0)
            
            # Save the credentials for the next run
            print(f"DEBUG: Saving token to {token_path}")
            with open(token_path, 'w') as token:
                token.write(self.creds.to_json())

        self.service = build('calendar', 'v3', credentials=self.creds)
        print("DEBUG: Service built successfully")

    async def create_meeting(self, summary: str, start_time: Optional[datetime.datetime] = None, end_time: Optional[datetime.datetime] = None) -> Dict:
        """
        Create a Google Meet event.
        If start_time is None, creates an instant meeting (starts now).
        """
        # Run auth efficiently (sync call but fast if token exists)
        self._authenticate()
        
        # Get local system timezone
        local_tz = datetime.datetime.now().astimezone().tzinfo
        
        if not start_time:
            # INSTANT: User 'now' in local time
            start_time = datetime.datetime.now(local_tz)
        elif start_time.tzinfo is None:
            # SCHEDULED: Assume naive input is local time, attach offset
            start_time = start_time.replace(tzinfo=local_tz)
        
        if not end_time:
             end_time = start_time + datetime.timedelta(hours=1)
        elif end_time.tzinfo is None:
             end_time = end_time.replace(tzinfo=local_tz)

        event = {
            'summary': summary,
            'description': 'Created via Screen5 Meeting Capture',
            'start': {
                'dateTime': start_time.isoformat(),
                # 'timeZone': 'UTC',  <-- Ignored because dateTime now has offset
            },
            'end': {
                'dateTime': end_time.isoformat(),
                # 'timeZone': 'UTC',
            },
            'conferenceData': {
                'createRequest': {
                    'requestId': f"screen5-{int(datetime.datetime.now().timestamp())}",
                    'conferenceSolutionKey': {'type': 'hangoutsMeet'}
                }
            }
        }

        # We must run this in a thread executor because the google client is synchronous
        def _execute_insert():
            return self.service.events().insert(
                calendarId='primary', 
                body=event, 
                conferenceDataVersion=1
            ).execute()

        event_result = await asyncio.to_thread(_execute_insert)

        meet_link = event_result.get('conferenceData', {}).get('entryPoints', [{}])[0].get('uri')
        
        return {
            "meet_url": meet_link,
            "event_link": event_result.get('htmlLink'),
            "id": event_result.get('id')
        }

    async def get_transcript(self, meeting_id: str) -> Dict:
        """
        Mock retrieval of a transcript from Google Meet/Drive.
        In reality, this would search Drive for the transcript file associated with the meeting ID.
        """
        # Simulate network delay
        await asyncio.sleep(1.0)

        # Mock Data
        mock_transcript = {
            "meeting_id": meeting_id,
            "title": "Weekly Sync",
            "date": "2024-05-21",
            "events": [
                {
                    "type": "segment_complete",
                    "text": "Hello everyone, thanks for joining.",
                    "speaker_id": "Speaker A",
                    "start": 0.0,
                    "end": 2.5,
                    "is_final": True
                },
                {
                    "type": "segment_complete",
                    "text": "Today we are discussing the Q3 roadmap.",
                    "speaker_id": "Speaker A",
                    "start": 3.0,
                    "end": 5.5,
                    "is_final": True
                },
                {
                    "type": "segment_complete",
                    "text": "I have some updates on the backend migration.",
                    "speaker_id": "Speaker B",
                    "start": 6.0,
                    "end": 9.0,
                    "is_final": True
                }
            ]
        }
        
        return mock_transcript

    async def list_recordings(self) -> List[Dict]:
        """
        Mock listing of available meeting recordings/transcripts.
        """
        await asyncio.sleep(0.5)
        return [
            {"id": "meet-abc-123", "title": "Weekly Sync", "date": "2024-05-21"},
            {"id": "meet-xyz-789", "title": "Design Review", "date": "2024-05-20"}
        ]
