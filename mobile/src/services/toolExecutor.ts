import type {
  MemoryCategory,
  MemoryDirection,
  PendingDeviceAction,
  ToolBadgeItem,
  ToolCallPayload,
} from "../types";
import {
  deleteContactById,
  modifyMemoryRecord,
  saveMemoryRecord,
  searchContactsAndMemories,
  upsertContact,
} from "./contactsDb";

function makeActionId(): string {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function describeToolActivity(toolName: string): string {
  switch (toolName) {
    case "search_contacts_and_memories":
      return "Checking contacts & memories…";
    case "save_or_update_contact":
      return "Saving contact locally…";
    case "save_memory_or_hisaab":
      return "Saving memory to SQLite…";
    case "update_memory_status":
      return "Updating record status…";
    case "delete_contact":
      return "Removing contact…";
    case "prepare_phone_call":
      return "Preparing call confirmation…";
    case "prepare_sms_draft":
      return "Preparing SMS draft…";
    default:
      return "Running tool…";
  }
}

export interface ExecutedToolBatchResult {
  toolOutputs: Array<{ toolCallId: string; outputJson: string }>;
  pendingActions: PendingDeviceAction[];
  badges: ToolBadgeItem[];
}

export async function executeClientToolCalls(
  toolCalls: ToolCallPayload[]
): Promise<ExecutedToolBatchResult> {
  const toolOutputs: Array<{ toolCallId: string; outputJson: string }> = [];
  const pendingActions: PendingDeviceAction[] = [];
  const badges: ToolBadgeItem[] = [];

  for (const call of toolCalls) {
    const args = call.arguments || {};

    try {
      switch (call.name) {
        case "search_contacts_and_memories": {
          const query = typeof args.query === "string" ? args.query : "";
          const category =
            typeof args.category === "string" ? args.category : "all";
          const searchResult = await searchContactsAndMemories(query, category);

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify(searchResult),
          });
          break;
        }

        case "save_or_update_contact": {
          const name = typeof args.name === "string" ? args.name : "";
          const { contact, created } = await upsertContact({
            contactId:
              typeof args.contactId === "string" ? args.contactId : undefined,
            name,
            phone: typeof args.phone === "string" ? args.phone : undefined,
            relationship:
              typeof args.relationship === "string"
                ? args.relationship
                : undefined,
            birthday:
              typeof args.birthday === "string" ? args.birthday : undefined,
            notes: typeof args.notes === "string" ? args.notes : undefined,
          });

          badges.push({
            id: makeActionId(),
            kind: "contact",
            label: `${created ? "Contact saved" : "Contact updated"}: ${contact.name}`,
          });

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              success: true,
              created,
              contact,
            }),
          });
          break;
        }

        case "save_memory_or_hisaab": {
          const validCategories: MemoryCategory[] = [
            "ledger",
            "bill",
            "birthday",
            "note",
            "custom",
          ];
          const rawCat =
            typeof args.category === "string" ? args.category : "note";
          const category: MemoryCategory = validCategories.includes(
            rawCat as MemoryCategory
          )
            ? (rawCat as MemoryCategory)
            : "note";

          const rawDir =
            typeof args.direction === "string" ? args.direction : "none";
          const direction: MemoryDirection =
            rawDir === "payable" || rawDir === "receivable" ? rawDir : "none";

          const amount =
            typeof args.amount === "number"
              ? args.amount
              : typeof args.amount === "string" && args.amount.trim()
              ? Number(args.amount)
              : null;

          const saved = await saveMemoryRecord({
            contactId:
              typeof args.contactId === "string" ? args.contactId : undefined,
            contactName:
              typeof args.contactName === "string"
                ? args.contactName
                : undefined,
            category,
            label: typeof args.label === "string" ? args.label : "Detail",
            detail: typeof args.detail === "string" ? args.detail : "",
            amount,
            direction,
            eventDate:
              typeof args.eventDate === "string" ? args.eventDate : undefined,
          });

          const amountSuffix =
            typeof saved.amount === "number" ? ` (₹${saved.amount})` : "";
          badges.push({
            id: makeActionId(),
            kind: "memory",
            label: `Saved: ${saved.contactName ? `${saved.contactName} · ` : ""}${saved.label}${amountSuffix}`,
          });

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              success: true,
              memory: saved,
            }),
          });
          break;
        }

        case "update_memory_status": {
          const memoryId =
            typeof args.memoryId === "string" ? args.memoryId : "";
          const rawAct = typeof args.action === "string" ? args.action : "settle";
          const action: "settle" | "update" | "delete" =
            rawAct === "update" || rawAct === "delete" ? rawAct : "settle";

          const res = await modifyMemoryRecord({
            memoryId,
            action,
            newAmount:
              typeof args.newAmount === "number" ? args.newAmount : undefined,
            newDetail:
              typeof args.newDetail === "string" ? args.newDetail : undefined,
          });

          if (res.ok) {
            badges.push({
              id: makeActionId(),
              kind: "update",
              label:
                action === "settle"
                  ? "Marked settled ✓"
                  : action === "delete"
                  ? "Memory deleted"
                  : "Memory updated",
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify(res),
          });
          break;
        }

        case "delete_contact": {
          const contactId =
            typeof args.contactId === "string" ? args.contactId : "";
          const deleted = await deleteContactById(contactId);
          if (deleted) {
            badges.push({
              id: makeActionId(),
              kind: "update",
              label: "Contact deleted",
            });
          }
          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({ success: deleted }),
          });
          break;
        }

        case "prepare_phone_call": {
          const contactName =
            typeof args.contactName === "string" ? args.contactName.trim() : "Contact";
          const phone =
            typeof args.phone === "string" ? args.phone.trim() : "";

          if (!phone) {
            toolOutputs.push({
              toolCallId: call.id,
              outputJson: JSON.stringify({
                success: false,
                error: "Phone number is empty. Ask the user for their phone number first.",
              }),
            });
            break;
          }

          const actionCard: PendingDeviceAction = {
            id: makeActionId(),
            type: "call",
            contactName,
            phone,
            reason: typeof args.reason === "string" ? args.reason : undefined,
            status: "pending",
          };
          pendingActions.push(actionCard);

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              status: "awaiting_user_confirmation",
              contactName,
              phone,
              note: "A Call Confirmation card is now displayed on screen. Ask the user to tap Confirm Call to dial.",
            }),
          });
          break;
        }

        case "prepare_sms_draft": {
          const contactName =
            typeof args.contactName === "string" ? args.contactName.trim() : "Contact";
          const phone =
            typeof args.phone === "string" ? args.phone.trim() : "";
          const messageBody =
            typeof args.messageBody === "string" ? args.messageBody.trim() : "";

          if (!phone) {
            toolOutputs.push({
              toolCallId: call.id,
              outputJson: JSON.stringify({
                success: false,
                error: "Phone number is empty. Ask the user for the recipient's phone number first.",
              }),
            });
            break;
          }

          const actionCard: PendingDeviceAction = {
            id: makeActionId(),
            type: "sms",
            contactName,
            phone,
            messageBody,
            status: "pending",
          };
          pendingActions.push(actionCard);

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              status: "awaiting_user_confirmation",
              contactName,
              phone,
              draftedMessage: messageBody,
              note: "An interactive SMS Draft Confirmation card is now displayed on screen. Ask the user to review and tap Confirm & Send SMS.",
            }),
          });
          break;
        }

        default: {
          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              error: `Unknown tool: ${call.name}`,
            }),
          });
        }
      }
    } catch (err) {
      toolOutputs.push({
        toolCallId: call.id,
        outputJson: JSON.stringify({
          error: err instanceof Error ? err.message : "Tool execution failed.",
        }),
      });
    }
  }

  return { toolOutputs, pendingActions, badges };
}
