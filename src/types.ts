import { Timestamp } from 'firebase/firestore';

export type UserRole = 'parent' | 'child';

export type MascotType = 'cat' | 'bear' | 'dog' | 'none';
export type StatusType = 'brincando' | 'estudando' | 'dormindo' | 'conversando' | 'trabalhando' | 'comendo' | 'arrumando';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  parentId?: string;
  photoURL?: string;
  mood?: string;
  moodEmoji?: string;
  moodUpdatedAt?: any;
  trustedSOSContactEmail?: string;
  mascot?: MascotType;
  currentStatus?: StatusType;
  favorites?: {
    music?: string;
    game?: string;
    color?: string;
    food?: string;
  };
}

export interface Contact {
  id: string;
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
  approved: boolean;
  childId: string;
  meetAuthorized?: boolean;
  canClearChat?: boolean;
  lastMessageAt?: any;
  lastMessageText?: string;
  hasUnread?: boolean;
  mood?: string;
  moodEmoji?: string;
  mascot?: MascotType;
  currentStatus?: StatusType;
  favorites?: {
    music?: string;
    game?: string;
    color?: string;
    food?: string;
  };
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text?: string;
  mediaUrl?: string;
  mediaType: 'text' | 'image' | 'call';
  meetUrl?: string;
  timestamp: any;
}

export interface PendingInvite {
  id: string;
  targetEmail: string;
  fromUid: string;
  fromName: string;
  fromPhoto?: string;
  timestamp: any;
  accepted?: boolean;
}
