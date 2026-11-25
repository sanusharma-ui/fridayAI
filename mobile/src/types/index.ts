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

export type MemoryCategory = "ledger" | "bill" | "birthday" | "note" | "custom";
export type MemoryDirection = "payable" | "receivable" | "none";
export type MemoryStatus = "active" | "pending" | "settled";

export interface ContactRecord {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  birthday: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryRecord {
  id: string;
  contactId: string | null;
  contactName: string;
  category: MemoryCategory;
  label: string;
  detail: string;
  amount: number | null;
  direction: MemoryDirection;
  eventDate: string;
  status: MemoryStatus;
  createdAt: number;
  updatedAt: number;
}

export interface PendingDeviceAction {
  id: string;
  type: "call" | "sms";
  contactName: string;
  phone: string;
  messageBody?: string;
  reason?: string;
  status: "pending" | "confirmed" | "cancelled";
}

export interface ToolBadgeItem {
  id: string;
  label: string;
  kind: "contact" | "memory" | "search" | "update";
}

export interface ToolCallPayload {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  rawArguments?: string;
}

export type AgentLoopMessage =
  | {
      role: "assistant";
      content: string | null;
      tool_calls: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    }
  | {
      role: "tool";
      tool_call_id: string;
      content: string;
    };

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
  activeToolLabel?: string;
  pendingActions?: PendingDeviceAction[];
  toolBadges?: ToolBadgeItem[];
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
