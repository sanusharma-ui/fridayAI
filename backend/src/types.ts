export type Role = "user" | "assistant";

export interface ConversationTurn {
  role: Role;
  content: string;
}

export interface IncomingAttachment {
  id?: string;
  name: string;
  type: string;
  size?: number;
  dataUrl?: string;
  data_url?: string;
  extractedText?: string;
}

export interface ChatRequestBody {
  message?: string;
  history?: ConversationTurn[];
  attachments?: IncomingAttachment[];
  model?: string;
  visionModel?: string;
}

export interface GroqModelOption {
  id: string;
  label: string;
  ownedBy?: string;
  contextWindow?: number;
  supportsVision: boolean;
  recommended?: boolean;
}
