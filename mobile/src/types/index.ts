export type Role = "user" | "assistant";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  uri?: string;
  extractedText?: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  attachments?: Attachment[];
  modelUsed?: string;
  reasoning?: string;
  notices?: string[];
  durationMs?: number;
  isStreaming?: boolean;
  stopped?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface GroqModelOption {
  id: string;
  label: string;
  ownedBy?: string;
  contextWindow?: number;
  supportsVision: boolean;
  recommended?: boolean;
}

export interface AppSettings {
  groqApiKey: string;
  backendUrl: string;
  selectedModel: string;
  selectedVisionModel: string;
  keyVerified: boolean;
}

export type ConnectionState = "checking" | "ready" | "missing_key" | "backend_offline";
