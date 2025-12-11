
import os
import datetime
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/calendar']

def list_recent_events():
    print("Authenticating...")
    token_path = 'token.json'
    if not os.path.exists(token_path) and os.path.exists(os.path.join('..', 'token.json')):
        token_path = os.path.join('..', 'token.json')
    
    if not os.path.exists(token_path):
        print("ERROR: token.json not found. Please authenticate first.")
        return

    creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    service = build('calendar', 'v3', credentials=creds)

    print("Fetching last 5 events...")
    now = datetime.datetime.utcnow().isoformat() + 'Z'  # 'Z' indicates UTC time
    
    events_result = service.events().list(
        calendarId='primary', 
        timeMin=now,
        maxResults=20, 
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    
    events = events_result.get('items', [])

    if not events:
        print('No upcoming events found.')
        return

    print("\nUPCOMING EVENTS:")
    for event in events:
        start = event['start'].get('dateTime', event['start'].get('date'))
        summary = event.get('summary', 'No Title')
        print(f"- {summary} ({start})")
        print(f"  Link: {event.get('htmlLink')}")
        conf = event.get('conferenceData', {})
        entries = conf.get('entryPoints', [])
        if entries:
            print(f"  Meet: {entries[0].get('uri')}")
        else:
            print("  Meet: No meeting link")
        print("-" * 20)

if __name__ == "__main__":
    list_recent_events()
