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
import { searchDeviceContacts } from "./deviceContacts";

function makeActionId(): string {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function describeToolActivity(toolName: string): string {
  switch (toolName) {
    case "search_contacts_and_memories":
      return "Searching vault & phonebook…";
    case "search_device_phonebook":
      return "Searching phone contacts…";
    case "save_or_update_contact":
      return "Saving contact to vault…";
    case "prepare_device_contact_save":
      return "Preparing phonebook contact…";
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
    case "prepare_whatsapp_message":
      return "Preparing WhatsApp message…";
    case "prepare_upi_payment":
      return "Preparing UPI payment card…";
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
          const includeDevice = args.includeDeviceContacts !== false;

          const [vaultResult, deviceResult] = await Promise.all([
            searchContactsAndMemories(query, category),
            includeDevice
              ? searchDeviceContacts(query, 15)
              : Promise.resolve(null),
          ]);

          if (deviceResult && deviceResult.matches.length > 0 && query.trim()) {
            badges.push({
              id: makeActionId(),
              kind: "search",
              label: `Phonebook: ${deviceResult.matches.length} match${deviceResult.matches.length > 1 ? "es" : ""} found`,
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              ...vaultResult,
              deviceContactsPermission: deviceResult?.permission ?? "skipped",
              totalDeviceContacts: deviceResult?.totalDeviceContacts ?? 0,
              deviceContacts: deviceResult
                ? deviceResult.matches.map((dc) => ({
                    source: "device_phonebook",
                    deviceId: dc.deviceId,
                    name: dc.name,
                    primaryPhone: dc.primaryPhone || null,
                    phones: dc.phones,
                    emails: dc.emails,
                    company: dc.company,
                    birthday: dc.birthday,
                  }))
                : [],
            }),
          });
          break;
        }

        case "search_device_phonebook": {
          const query = typeof args.query === "string" ? args.query : "";
          const limit =
            typeof args.limit === "number" && !Number.isNaN(args.limit)
              ? args.limit
              : 20;

          const deviceResult = await searchDeviceContacts(query, limit);

          if (deviceResult.permission === "granted") {
            badges.push({
              id: makeActionId(),
              kind: "search",
              label: `Phonebook searched (${deviceResult.matches.length} found)`,
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              permission: deviceResult.permission,
              totalDeviceContacts: deviceResult.totalDeviceContacts,
              matches: deviceResult.matches,
              note:
                deviceResult.permission === "denied"
                  ? "Contacts permission was denied by the user. Politely ask them to enable Contacts access in phone Settings."
                  : undefined,
            }),
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

        case "prepare_device_contact_save": {
          const contactName =
            typeof args.contactName === "string"
              ? args.contactName.trim()
              : "";
          const phone =
            typeof args.phone === "string" ? args.phone.trim() : "";

          if (!contactName || !phone) {
            toolOutputs.push({
              toolCallId: call.id,
              outputJson: JSON.stringify({
                success: false,
                error:
                  "Both contactName and phone are required to save a phonebook contact.",
              }),
            });
            break;
          }

          const actionCard: PendingDeviceAction = {
            id: makeActionId(),
            type: "save_device_contact",
            contactName,
            phone,
            email:
              typeof args.email === "string" ? args.email.trim() : undefined,
            company:
              typeof args.company === "string"
                ? args.company.trim()
                : undefined,
            relationship:
              typeof args.relationship === "string"
                ? args.relationship.trim()
                : undefined,
            note:
              typeof args.notes === "string" ? args.notes.trim() : undefined,
            status: "pending",
          };
          pendingActions.push(actionCard);

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              status: "awaiting_user_confirmation",
              contactName,
              phone,
              note: "A Save to Phonebook confirmation card is now displayed on screen. Ask the user to tap Save to Phonebook.",
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
          const rawAct =
            typeof args.action === "string" ? args.action : "settle";
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
            typeof args.contactName === "string"
              ? args.contactName.trim()
              : "Contact";
          const phone =
            typeof args.phone === "string" ? args.phone.trim() : "";

          if (!phone) {
            toolOutputs.push({
              toolCallId: call.id,
              outputJson: JSON.stringify({
                success: false,
                error:
                  "Phone number is empty. Search contacts/phonebook first or ask the user for their phone number.",
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
            typeof args.contactName === "string"
              ? args.contactName.trim()
              : "Contact";
          const phone =
            typeof args.phone === "string" ? args.phone.trim() : "";
          const messageBody =
            typeof args.messageBody === "string" ? args.messageBody.trim() : "";

          if (!phone) {
            toolOutputs.push({
              toolCallId: call.id,
              outputJson: JSON.stringify({
                success: false,
                error:
                  "Phone number is empty. Search contacts/phonebook first or ask the user for the recipient's phone number.",
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
              note: "An interactive SMS Draft Confirmation card is now displayed on screen. Ask the user to review and tap Confirm & Open SMS.",
            }),
          });
          break;
        }

        case "prepare_whatsapp_message": {
          const contactName =
            typeof args.contactName === "string"
              ? args.contactName.trim()
              : "Contact";
          const phone =
            typeof args.phone === "string" ? args.phone.trim() : "";
          const messageBody =
            typeof args.messageBody === "string" ? args.messageBody.trim() : "";

          if (!phone) {
            toolOutputs.push({
              toolCallId: call.id,
              outputJson: JSON.stringify({
                success: false,
                error:
                  "Phone number is empty. Search contacts/phonebook first or ask the user for the recipient's WhatsApp number.",
              }),
            });
            break;
          }

          const actionCard: PendingDeviceAction = {
            id: makeActionId(),
            type: "whatsapp",
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
              note: "An interactive WhatsApp Confirmation card is now displayed on screen. Ask the user to review the message and tap Open WhatsApp.",
            }),
          });
          break;
        }

        case "prepare_upi_payment": {
          const contactName =
            typeof args.contactName === "string"
              ? args.contactName.trim()
              : "Payee";
          const upiId =
            typeof args.upiId === "string" ? args.upiId.trim() : "";
          const amount =
            typeof args.amount === "number" && !Number.isNaN(args.amount)
              ? args.amount
              : typeof args.amount === "string" && args.amount.trim()
              ? Number(args.amount)
              : null;
          const note =
            typeof args.note === "string" ? args.note.trim() : undefined;

          if (!upiId || !upiId.includes("@")) {
            toolOutputs.push({
              toolCallId: call.id,
              outputJson: JSON.stringify({
                success: false,
                error:
                  "A valid UPI ID containing '@' (like name@okicici or 9876543210@ybl) is required. Ask the user for the recipient's UPI ID.",
              }),
            });
            break;
          }

          const actionCard: PendingDeviceAction = {
            id: makeActionId(),
            type: "upi",
            contactName,
            phone: "",
            upiId,
            amount,
            note,
            status: "pending",
          };
          pendingActions.push(actionCard);

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              status: "awaiting_user_confirmation",
              contactName,
              upiId,
              amount,
              note: "A strict UPI Payment confirmation card is now displayed on screen. Ask the user to verify the UPI ID & amount and tap Pay via UPI App.",
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
