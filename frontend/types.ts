export enum AttendanceMode {
  VIRTUAL = 'VIRTUAL',
  ONSITE = 'ONSITE'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface DelegateProfile {
  id: string;
  name: string;
  organization: string;
  role: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  verified: boolean;
}

export enum MeetingPlatform {
  ZOOM = 'Zoom',
  MEET = 'Google Meet',
  TEAMS = 'Microsoft Teams'
}

export interface TranscriptEvent {
  type: string;
  text: string;
  speaker_id: string | null;
  is_final: boolean;
}

export interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  isHighlighted?: boolean;
}
