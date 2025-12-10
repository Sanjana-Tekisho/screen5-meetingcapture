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
