import { GoogleGenAI } from "@google/genai";
import { AttendanceMode } from "../types";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API_KEY is not defined in the environment.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-for-dev' });

export const generateAssistantResponse = async (
  history: { role: string; text: string }[],
  userMessage: string,
  mode: AttendanceMode
): Promise<string> => {
  try {
    const modeContext = mode === AttendanceMode.VIRTUAL 
      ? "The user is attending virtually. Focus on streaming links, digital networking, and timezone coordination."
      : "The user is attending on-site. Focus on venue maps, physical check-in, wifi access, and local logistics.";

    const systemInstruction = `You are the Nebula Corp Conference AI Assistant. 
    You are helpful, concise, and futuristic in your tone. 
    The current delegate is Sarah Jones from Nebula Corp.
    ${modeContext}
    Keep responses short and professional.`;

    const model = "gemini-2.5-flash";
    
    const chat = ai.chats.create({
        model: model,
        config: {
            systemInstruction: systemInstruction,
        },
        history: history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        }))
    });

    const response = await chat.sendMessage({ message: userMessage });
    return response.text || "I apologize, I am having trouble connecting to the Nebula mainframe.";
    
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Connection interrupted. Please try again.";
  }
};

export const generateMeetingMinutes = async (
  transcript: string[],
  notes: string,
  delegateName: string,
  highlightedSegments: string[] = []
): Promise<string> => {
  try {
    const model = "gemini-2.5-flash";
    
    // Constructing a prioritized prompt
    const prompt = `
      You are an elite corporate secretary AI.
      Create a professional Minutes of Meeting (MOM) and a concise Executive Summary for a meeting with ${delegateName}.
      
      CRITICAL INSTRUCTION:
      1. **Manual Notes**: The user has taken specific manual notes. These are HIGH PRIORITY.
      2. **Highlights**: The user explicitly HIGHLIGHTED specific lines in the transcript. These are CRITICAL discussion points.
      
      You MUST integrate these manual notes and highlighted segments prominently into the Executive Summary and Action Items.
      Use the general transcript to fill in details, context, and additional points discussed.

      Structure the response clearly with Markdown:
      ## Executive Summary
      (Merge insights from Manual Notes and Highlights here. Be impactful.)

      ## Key Takeaways (User Notes)
      (List the specific points noted by the user)
      
      ## Critical Highlights (Flagged in Transcript)
      (List the specific points the user highlighted from the live stream)

      ## Discussion Points (Transcript Analysis)
      (Bulleted list of other discussion points from the live audio)

      ## Action Items
      (Clear next steps with owners if mentioned)

      Input Data:
      
      [USER'S MANUAL NOTES - HIGH PRIORITY]
      ${notes}

      [USER HIGHLIGHTED SEGMENTS - CRITICAL]
      ${highlightedSegments.length > 0 ? highlightedSegments.join('\n') : "No specific highlights marked."}

      [FULL LIVE TRANSCRIPT - SUPPORTING DATA]
      ${transcript.join('\n')}
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Failed to generate MOM. Please check system connection.";
  } catch (error) {
    console.error("Gemini MOM Generation Error:", error);
    return "Error: Unable to generate meeting minutes due to network interference.";
  }
};