import type {
  Attachment,
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
import {
  manageScheduledReminders,
  readPhoneCalendarEvents,
  scheduleLocalReminder,
  setNativeAlarmOrTimer,
} from "./deviceSchedule";
import {
  executeClipboardTool,
  executeSystemControl,
  fetchLatestGalleryImage,
  openAppOrMediaSearch,
  openMapsNavigation,
} from "./deviceSystem";

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
    case "schedule_local_reminder":
      return "Scheduling phone reminder…";
    case "list_or_cancel_reminders":
      return "Checking scheduled reminders…";
    case "set_phone_alarm_or_timer":
      return "Setting clock alarm/timer…";
    case "get_calendar_events":
      return "Reading phone calendar…";
    case "prepare_calendar_event":
      return "Preparing calendar event…";
    case "open_maps_navigation":
      return "Opening Maps navigation…";
    case "open_app_or_media_search":
      return "Launching app / media…";
    case "prepare_email_draft":
      return "Preparing email draft…";
    case "device_system_controls":
      return "Running device control…";
    case "clipboard_tool":
      return "Accessing phone clipboard…";
    case "fetch_latest_gallery_image":
      return "Reading latest gallery photo…";
    default:
      return "Running tool…";
  }
}

export interface ExecutedToolBatchResult {
  toolOutputs: Array<{ toolCallId: string; outputJson: string }>;
  pendingActions: PendingDeviceAction[];
  badges: ToolBadgeItem[];
  fetchedAttachments: Attachment[];
}

export interface ToolExecutionOptions {
  pageSize?: number;
  maxClipboardChars?: number;
}

export async function executeClientToolCalls(
  toolCalls: ToolCallPayload[],
  options?: ToolExecutionOptions
): Promise<ExecutedToolBatchResult> {
  const defaultPageSize = Math.max(4, Math.min(25, options?.pageSize || 8));
  const maxClipboardChars = options?.maxClipboardChars || 1800;

  const toolOutputs: Array<{ toolCallId: string; outputJson: string }> = [];
  const pendingActions: PendingDeviceAction[] = [];
  const badges: ToolBadgeItem[] = [];
  const fetchedAttachments: Attachment[] = [];

  for (const call of toolCalls) {
    const args = call.arguments || {};

    try {
      switch (call.name) {
        case "search_contacts_and_memories": {
          const query = typeof args.query === "string" ? args.query : "";
          const category =
            typeof args.category === "string" ? args.category : "all";
          const offset =
            typeof args.offset === "number" && !Number.isNaN(args.offset)
              ? Math.max(0, Math.floor(args.offset))
              : 0;
          const requestedLimit =
            typeof args.limit === "number" && !Number.isNaN(args.limit)
              ? Math.min(defaultPageSize, Math.max(3, Math.floor(args.limit)))
              : defaultPageSize;

          const isPureMemoryLedgerListing =
            !query.trim() &&
            (category === "ledger" || category === "bill" || category === "note");
          const includeDevice =
            args.includeDeviceContacts === true ||
            (args.includeDeviceContacts !== false && !isPureMemoryLedgerListing);

          const [vaultResult, deviceResult] = await Promise.all([
            searchContactsAndMemories(query, category, requestedLimit, offset),
            includeDevice
              ? searchDeviceContacts(query, requestedLimit, offset)
              : Promise.resolve(null),
          ]);

          if (deviceResult && deviceResult.matches.length > 0 && query.trim()) {
            badges.push({
              id: makeActionId(),
              kind: "search",
              label: `Phonebook: ${deviceResult.totalMatching} match${deviceResult.totalMatching > 1 ? "es" : ""}`,
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              ...vaultResult,
              devicePhonebook: deviceResult
                ? {
                    permission: deviceResult.permission,
                    totalDeviceContacts: deviceResult.totalDeviceContacts,
                    totalMatching: deviceResult.totalMatching,
                    shownCount: deviceResult.matches.length,
                    offset: deviceResult.offset,
                    hasMore: deviceResult.hasMore,
                    nextOffset: deviceResult.nextOffset,
                    ...(deviceResult.hasMore
                      ? {
                          followUpHint: `Showing ${deviceResult.offset + 1}–${deviceResult.offset + deviceResult.matches.length} of ${deviceResult.totalMatching} phonebook contacts. Show ONLY this short list and ask if user wants more (offset=${deviceResult.nextOffset}) or wants to search a specific name.`,
                        }
                      : {}),
                    contacts: deviceResult.matches.map((dc) => ({
                      name: dc.name,
                      phone: dc.primaryPhone || null,
                      ...(dc.phones.length > 1
                        ? {
                            otherPhones: dc.phones
                              .slice(1, 3)
                              .map((p) => p.number),
                          }
                        : {}),
                      ...(dc.company ? { company: dc.company } : {}),
                      ...(dc.birthday ? { birthday: dc.birthday } : {}),
                    })),
                  }
                : undefined,
            }),
          });
          break;
        }

        case "search_device_phonebook": {
          const query = typeof args.query === "string" ? args.query : "";
          const offset =
            typeof args.offset === "number" && !Number.isNaN(args.offset)
              ? Math.max(0, Math.floor(args.offset))
              : 0;
          const limit =
            typeof args.limit === "number" && !Number.isNaN(args.limit)
              ? Math.min(defaultPageSize, Math.max(3, Math.floor(args.limit)))
              : defaultPageSize;

          const deviceResult = await searchDeviceContacts(query, limit, offset);

          if (deviceResult.permission === "granted") {
            badges.push({
              id: makeActionId(),
              kind: "search",
              label: `Phonebook (${deviceResult.matches.length}/${deviceResult.totalMatching})`,
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              permission: deviceResult.permission,
              totalDeviceContacts: deviceResult.totalDeviceContacts,
              totalMatching: deviceResult.totalMatching,
              shownCount: deviceResult.matches.length,
              offset: deviceResult.offset,
              hasMore: deviceResult.hasMore,
              nextOffset: deviceResult.nextOffset,
              ...(deviceResult.hasMore
                ? {
                    followUpHint: `Showing ${deviceResult.offset + 1}–${deviceResult.offset + deviceResult.matches.length} of ${deviceResult.totalMatching} phone contacts. Present ONLY these ${deviceResult.matches.length} contacts cleanly and ask if the user wants the next page (offset=${deviceResult.nextOffset}) or wants to filter by name.`,
                  }
                : {}),
              contacts: deviceResult.matches.map((dc) => ({
                name: dc.name,
                phone: dc.primaryPhone || null,
                ...(dc.phones.length > 1
                  ? { otherPhones: dc.phones.slice(1, 3).map((p) => p.number) }
                  : {}),
                ...(dc.emails?.length ? { email: dc.emails[0] } : {}),
                ...(dc.company ? { company: dc.company } : {}),
                ...(dc.birthday ? { birthday: dc.birthday } : {}),
              })),
              ...(deviceResult.permission === "denied"
                ? {
                    note: "Contacts permission denied. Ask user to enable Contacts access in phone Settings.",
                  }
                : {}),
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

        case "schedule_local_reminder": {
          const title =
            typeof args.title === "string"
              ? args.title.trim()
              : "Friday Reminder";
          const body =
            typeof args.body === "string" ? args.body.trim() : title;
          const delayMinutes =
            typeof args.delayMinutes === "number"
              ? args.delayMinutes
              : typeof args.delayMinutes === "string" && args.delayMinutes.trim()
              ? Number(args.delayMinutes)
              : undefined;
          const triggerAtIso =
            typeof args.triggerAtIso === "string"
              ? args.triggerAtIso.trim()
              : undefined;
          const repeatDaily = Boolean(args.repeatDaily);
          const dailyHour =
            typeof args.dailyHour === "number" ? args.dailyHour : undefined;
          const dailyMinute =
            typeof args.dailyMinute === "number" ? args.dailyMinute : undefined;

          const res = await scheduleLocalReminder({
            title,
            body,
            delayMinutes,
            triggerAtIso,
            repeatDaily,
            dailyHour,
            dailyMinute,
          });

          if (res.ok) {
            badges.push({
              id: makeActionId(),
              kind: "schedule",
              label: `Reminder set · ${res.scheduledLabel || title}`,
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify(res),
          });
          break;
        }

        case "list_or_cancel_reminders": {
          const rawAction =
            typeof args.action === "string" ? args.action : "list";
          const action: "list" | "cancel_one" | "cancel_all" =
            rawAction === "cancel_one" || rawAction === "cancel_all"
              ? rawAction
              : "list";
          const reminderId =
            typeof args.reminderId === "string" ? args.reminderId : undefined;
          const offset =
            typeof args.offset === "number" ? args.offset : 0;
          const limit =
            typeof args.limit === "number"
              ? Math.min(defaultPageSize, args.limit)
              : defaultPageSize;

          const res = await manageScheduledReminders({
            action,
            reminderId,
            limit,
            offset,
          });

          if (res.ok && action !== "list") {
            badges.push({
              id: makeActionId(),
              kind: "update",
              label:
                action === "cancel_all"
                  ? "Cleared all reminders"
                  : "Reminder cancelled",
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify(res),
          });
          break;
        }

        case "set_phone_alarm_or_timer": {
          const mode: "alarm" | "timer" =
            args.mode === "timer" ? "timer" : "alarm";
          const label =
            typeof args.label === "string" ? args.label : undefined;
          const hour =
            typeof args.hour === "number"
              ? args.hour
              : typeof args.hour === "string" && args.hour.trim()
              ? Number(args.hour)
              : undefined;
          const minute =
            typeof args.minute === "number"
              ? args.minute
              : typeof args.minute === "string" && args.minute.trim()
              ? Number(args.minute)
              : undefined;
          const durationSeconds =
            typeof args.durationSeconds === "number"
              ? args.durationSeconds
              : typeof args.durationSeconds === "string" &&
                args.durationSeconds.trim()
              ? Number(args.durationSeconds)
              : undefined;

          const res = await setNativeAlarmOrTimer({
            mode,
            label,
            hour,
            minute,
            durationSeconds,
          });

          if (res.ok && res.summary) {
            badges.push({
              id: makeActionId(),
              kind: "schedule",
              label: res.summary,
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify(res),
          });
          break;
        }

        case "get_calendar_events": {
          const startDateIso =
            typeof args.startDateIso === "string"
              ? args.startDateIso
              : undefined;
          const endDateIso =
            typeof args.endDateIso === "string" ? args.endDateIso : undefined;
          const query =
            typeof args.query === "string" ? args.query : undefined;
          const offset =
            typeof args.offset === "number" ? args.offset : 0;
          const limit =
            typeof args.limit === "number"
              ? Math.min(defaultPageSize, args.limit)
              : defaultPageSize;

          const res = await readPhoneCalendarEvents({
            startDateIso,
            endDateIso,
            query,
            limit,
            offset,
          });

          if (res.ok) {
            badges.push({
              id: makeActionId(),
              kind: "schedule",
              label: `Calendar checked (${res.events?.length ?? 0} events)`,
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify(res),
          });
          break;
        }

        case "prepare_calendar_event": {
          const title =
            typeof args.title === "string" ? args.title.trim() : "";
          const startDateIso =
            typeof args.startDateIso === "string"
              ? args.startDateIso.trim()
              : "";

          if (!title || !startDateIso) {
            toolOutputs.push({
              toolCallId: call.id,
              outputJson: JSON.stringify({
                success: false,
                error:
                  "Both 'title' and 'startDateIso' are required to prepare a calendar event.",
              }),
            });
            break;
          }

          const endDateIso =
            typeof args.endDateIso === "string" && args.endDateIso.trim()
              ? args.endDateIso.trim()
              : undefined;
          const location =
            typeof args.location === "string" && args.location.trim()
              ? args.location.trim()
              : undefined;
          const notes =
            typeof args.notes === "string" && args.notes.trim()
              ? args.notes.trim()
              : undefined;
          const reminderMinutesBefore =
            typeof args.reminderMinutesBefore === "number"
              ? args.reminderMinutesBefore
              : 15;

          const actionCard: PendingDeviceAction = {
            id: makeActionId(),
            type: "calendar_event",
            contactName: title,
            phone: "",
            startDateIso,
            endDateIso,
            location,
            note: notes,
            reminderMinutesBefore,
            status: "pending",
          };
          pendingActions.push(actionCard);

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              status: "awaiting_user_confirmation",
              title,
              startDateIso,
              endDateIso,
              location,
              note: "A Calendar Event Confirmation card is now displayed on screen. Ask the user to tap Add to Calendar to save it.",
            }),
          });
          break;
        }

        case "open_maps_navigation": {
          const destination =
            typeof args.destination === "string" ? args.destination : "";
          const mode: "navigate" | "search" =
            args.mode === "search" ? "search" : "navigate";
          const rawTravel =
            typeof args.travelMode === "string" ? args.travelMode : "driving";
          const travelMode:
            | "driving"
            | "two-wheeler"
            | "walking"
            | "transit" =
            rawTravel === "two-wheeler" ||
            rawTravel === "walking" ||
            rawTravel === "transit"
              ? rawTravel
              : "driving";

          const res = await openMapsNavigation({
            destination,
            mode,
            travelMode,
          });

          if (res.ok && res.summary) {
            badges.push({
              id: makeActionId(),
              kind: "system",
              label: res.summary,
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify(res),
          });
          break;
        }

        case "open_app_or_media_search": {
          const rawTarget =
            typeof args.target === "string" ? args.target : "app";
          const target:
            | "youtube"
            | "spotify"
            | "google_search"
            | "open_url"
            | "app" =
            rawTarget === "youtube" ||
            rawTarget === "spotify" ||
            rawTarget === "google_search" ||
            rawTarget === "open_url"
              ? rawTarget
              : "app";
          const queryOrAppName =
            typeof args.queryOrAppName === "string" ? args.queryOrAppName : "";
          const packageName =
            typeof args.packageName === "string" ? args.packageName : undefined;

          const res = await openAppOrMediaSearch({
            target,
            queryOrAppName,
            packageName,
          });

          if (res.ok && res.summary) {
            badges.push({
              id: makeActionId(),
              kind: "system",
              label: res.summary,
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify(res),
          });
          break;
        }

        case "prepare_email_draft": {
          const toEmail =
            typeof args.toEmail === "string" ? args.toEmail.trim() : "";
          const recipientName =
            typeof args.recipientName === "string" && args.recipientName.trim()
              ? args.recipientName.trim()
              : toEmail || "Email Draft";
          const subject =
            typeof args.subject === "string" ? args.subject.trim() : "";
          const body =
            typeof args.body === "string" ? args.body.trim() : "";

          const actionCard: PendingDeviceAction = {
            id: makeActionId(),
            type: "email",
            contactName: recipientName,
            phone: "",
            email: toEmail,
            emailSubject: subject,
            messageBody: body,
            status: "pending",
          };
          pendingActions.push(actionCard);

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              status: "awaiting_user_confirmation",
              recipientName,
              toEmail,
              subject,
              note: "An interactive Email Draft card is now displayed on screen. Ask the user to review and tap Open Mail App.",
            }),
          });
          break;
        }

        case "device_system_controls": {
          const rawAct =
            typeof args.action === "string" ? args.action : "battery_status";
          const action:
            | "battery_status"
            | "get_brightness"
            | "set_brightness"
            | "restore_auto_brightness"
            | "open_settings" =
            rawAct === "get_brightness" ||
            rawAct === "set_brightness" ||
            rawAct === "restore_auto_brightness" ||
            rawAct === "open_settings"
              ? rawAct
              : "battery_status";

          const brightnessPercent =
            typeof args.brightnessPercent === "number"
              ? args.brightnessPercent
              : typeof args.brightnessPercent === "string" &&
                args.brightnessPercent.trim()
              ? Number(args.brightnessPercent)
              : undefined;
          const settingsPanel =
            typeof args.settingsPanel === "string"
              ? args.settingsPanel
              : undefined;

          const res = await executeSystemControl({
            action,
            brightnessPercent,
            settingsPanel,
          });

          if (res.ok && res.summary) {
            badges.push({
              id: makeActionId(),
              kind: "system",
              label: res.summary,
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify(res),
          });
          break;
        }

        case "clipboard_tool": {
          const action: "read" | "copy" =
            args.action === "copy" ? "copy" : "read";
          const textToCopy =
            typeof args.textToCopy === "string" ? args.textToCopy : undefined;

          const res = await executeClipboardTool({
            action,
            textToCopy,
            maxReadChars: maxClipboardChars,
          });

          if (res.ok && res.summary) {
            badges.push({
              id: makeActionId(),
              kind: "system",
              label: res.summary,
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify(res),
          });
          break;
        }

        case "fetch_latest_gallery_image": {
          const filter: "screenshot" | "any" =
            args.filter === "screenshot" ? "screenshot" : "any";
          const offset =
            typeof args.offset === "number" ? args.offset : undefined;

          const res = await fetchLatestGalleryImage({ filter, offset });

          if (res.ok && res.attachment) {
            fetchedAttachments.push(res.attachment);
            badges.push({
              id: makeActionId(),
              kind: "system",
              label: res.summary || `Attached ${res.attachment.name}`,
            });
          }

          toolOutputs.push({
            toolCallId: call.id,
            outputJson: JSON.stringify({
              ok: res.ok,
              metadata: res.metadata,
              error: res.error,
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

  return { toolOutputs, pendingActions, badges, fetchedAttachments };
}
