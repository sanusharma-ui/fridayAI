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

export interface ToolCallItem {
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

export interface ChatRequestBody {
  message?: string;
  history?: ConversationTurn[];
  attachments?: IncomingAttachment[];
  agentMessages?: AgentLoopMessage[];
  enableTools?: boolean;
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
