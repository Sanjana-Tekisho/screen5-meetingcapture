"""
Calendly API Service for generating scheduling links.
"""
import httpx
from typing import Optional
from app.core.config import settings

CALENDLY_API_BASE = "https://api.calendly.com"


class CalendlyService:
    def __init__(self):
        self.api_key = settings.CALENDLY_API_KEY
        if not self.api_key:
            print("WARNING: CALENDLY_API_KEY not set in environment variables")
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def get_current_user(self) -> dict:
        """
        Get the current authenticated user's information.
        Returns user URI which is needed for other API calls.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{CALENDLY_API_BASE}/users/me",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()

    async def get_event_types(self, user_uri: str) -> list:
        """
        Get available event types for the user.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{CALENDLY_API_BASE}/event_types",
                headers=self.headers,
                params={"user": user_uri, "active": "true"}
            )
            response.raise_for_status()
            return response.json().get("collection", [])

    async def create_scheduling_link(self, event_type_uri: str, max_event_count: int = 1) -> dict:
        """
        Create a single-use scheduling link for a specific event type.
        
        Args:
            event_type_uri: The URI of the event type (e.g., https://api.calendly.com/event_types/XXX)
            max_event_count: Maximum number of bookings allowed (1 for single-use)
        
        Returns:
            Dict containing the booking_url
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{CALENDLY_API_BASE}/scheduling_links",
                headers=self.headers,
                json={
                    "max_event_count": max_event_count,
                    "owner": event_type_uri,
                    "owner_type": "EventType"
                }
            )
            response.raise_for_status()
            data = response.json()
            return {
                "booking_url": data.get("resource", {}).get("booking_url"),
                "owner": data.get("resource", {}).get("owner"),
                "owner_type": data.get("resource", {}).get("owner_type")
            }

    async def create_booking_link(self, event_type_name: Optional[str] = None) -> dict:
        """
        High-level method: Creates a booking link.
        If event_type_name is not specified, uses the first available event type.
        """
        # Get user info
        user_data = await self.get_current_user()
        user_uri = user_data.get("resource", {}).get("uri")
        
        if not user_uri:
            raise ValueError("Could not get user URI from Calendly")

        # Get event types
        event_types = await self.get_event_types(user_uri)
        
        if not event_types:
            raise ValueError("No active event types found in your Calendly account")

        # Find matching event type or use first one
        selected_event_type = None
        if event_type_name:
            for et in event_types:
                if event_type_name.lower() in et.get("name", "").lower():
                    selected_event_type = et
                    break
        
        if not selected_event_type:
            selected_event_type = event_types[0]

        # Create the scheduling link
        event_type_uri = selected_event_type.get("uri")
        result = await self.create_scheduling_link(event_type_uri)
        
        return {
            "booking_url": result.get("booking_url"),
            "event_type_name": selected_event_type.get("name"),
            "duration_minutes": selected_event_type.get("duration")
        }
