export type RoomType = "normal" | "linkedin" | "linkedin_connect";

export interface LinkedInConnectParticipant {
  id: string;
  eventId: string;
  linkedinSub?: string;
  name: string;
  nameLower?: string;
  photo?: string;
  headline?: string;
  company?: string;
  companyLower?: string;
  linkedinUrl?: string;
  joinedAt?: any;
  lastSeen?: any;
}
