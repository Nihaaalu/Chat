export type ThemeType = 'dark' | 'light' | 'pink';

export interface MessageType {
  id: string;
  roomCode: string;
  sender: string;
  content: string;
  createdAt: string; // ISO string for client
}

export interface ParticipantType {
  id: string;
  name: string;
  roomCode: string;
  sessionToken: string;
  joinedAt: string;
}

export interface RoomDetails {
  code: string;
  participants: ParticipantType[];
  messages: MessageType[];
}
