import openai
from app.core.config import settings

class LLMService:
    def __init__(self):
        try:
            self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            self.model = "gpt-4o"
        except Exception as e:
            print(f"Failed to initialize LLM Service: {e}")
            self.client = None

    async def generate_mom(self, transcript: str, notes: str = None) -> str:
        if not self.client:
            return "Error: LLM Service not initialized."

        prompt = f"""
        You are an expert meeting assistant. Your task is to generate a concise Minutes of Meeting (MoM) based on the provided transcript and optional notes.
        
        **Instructions:**
        1. Summarize the key discussions, important topics, and action items.
        2. The output must be strictly 6-7 lines long.
        3. Use a professional tone.
        
        **Context:**
        - User Notes: {notes if notes else "No additional notes provided."}
        
        **Transcript:**
        {transcript}
        
        **Output:**
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"LLM Generation Error: {e}")
            return f"Error generating MoM: {str(e)}"
