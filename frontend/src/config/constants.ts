export const API_CONFIG = {
    WEBSOCKET_URL: 'ws://localhost:8000/ws/transcribe',
    AUDIO_SAMPLE_RATE: 16000,
    AUDIO_BUFFER_SIZE: 4096,
    AUDIO_CHANNEL_COUNT: 1,
} as const;

export const MEETING_CONFIG = {
    DEFAULT_SPEAKER: 'Sarah Jones',
    ORGANIZATION: 'Nebula Corp',
} as const;
