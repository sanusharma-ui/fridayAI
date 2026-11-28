import type { AgentLoopMessage, ConversationTurn } from "../types.js";

export interface GroqToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// 1. CONTACTS, VAULT & HISAAB TOOLS (Compact, token-efficient schemas + pagination)
const CONTACTS_VAULT_TOOLS: GroqToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_contacts_and_memories",
      description:
        "Search SQLite Vault AND Device Phonebook for a person's number, UPI ID, birthday, bills, or hisaab/udhaar. Results are paginated—show the returned batch and offer to load more if hasMore is true.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Person name/relation, phone digits, or keyword ('' for overview).",
          },
          category: {
            type: "string",
            enum: ["all", "ledger", "bill", "birthday", "note", "custom"],
            description: "Filter memory type (default 'all').",
          },
          includeDeviceContacts: {
            type: "boolean",
            description: "Also search device phonebook (default true when looking up people).",
          },
          offset: {
            type: "number",
            description: "Pagination offset (default 0; pass nextOffset for 'aur dikhao').",
          },
          limit: {
            type: "number",
            description: "Items per page (default 8, max 20).",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_device_phonebook",
      description:
        "Search or browse the phone's native Contact Book with pagination. Never dump hundreds of contacts at once; show the returned page and ask if the user wants more or wants to filter.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Name, relation alias, or phone digits ('' to browse first page).",
          },
          offset: {
            type: "number",
            description: "Pagination start index (default 0).",
          },
          limit: {
            type: "number",
            description: "Page size (default 8, max 20).",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_or_update_contact",
      description:
        "Save or update a contact (name, phone, relationship, birthday, notes/UPI ID) in Friday's SQLite Vault.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "string", description: "Existing 'cnt_...' ID if updating." },
          name: { type: "string", description: "Contact name." },
          phone: { type: "string", description: "Phone number." },
          relationship: { type: "string", description: "Relation or role." },
          birthday: { type: "string", description: "Birthday date." },
          notes: { type: "string", description: "Note or UPI ID." },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_device_contact_save",
      description:
        "Show confirmation card to save a new contact into the real Android/iOS System Phonebook (+ Vault).",
      parameters: {
        type: "object",
        properties: {
          contactName: { type: "string", description: "Full name." },
          phone: { type: "string", description: "Phone number." },
          email: { type: "string" },
          company: { type: "string" },
          relationship: { type: "string" },
          notes: { type: "string" },
        },
        required: ["contactName", "phone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_memory_or_hisaab",
      description:
        "Save money udhaar/hisaab, bill, birthday, UPI ID, or personal note in SQLite.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "string" },
          contactName: { type: "string", description: "Person name if linked to someone." },
          category: {
            type: "string",
            enum: ["ledger", "bill", "birthday", "note", "custom"],
          },
          label: { type: "string", description: "Short title (e.g. 'Udhaar', 'Electricity Bill', 'UPI ID')." },
          detail: { type: "string", description: "Clear detail to remember." },
          amount: { type: "number", description: "Amount in INR if applicable." },
          direction: {
            type: "string",
            enum: ["payable", "receivable", "none"],
            description: "'payable' = user must pay; 'receivable' = user will collect.",
          },
          eventDate: { type: "string", description: "Due date or birthday." },
        },
        required: ["category", "label", "detail"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_memory_status",
      description: "Settle/clear, update remaining amount, or delete an existing hisaab/bill/memory.",
      parameters: {
        type: "object",
        properties: {
          memoryId: { type: "string", description: "'mem_...' ID from search." },
          action: { type: "string", enum: ["settle", "update", "delete"] },
          newAmount: { type: "number" },
          newDetail: { type: "string" },
        },
        required: ["memoryId", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_contact",
      description: "Delete a contact from SQLite Vault ONLY on explicit user request.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "string" },
        },
        required: ["contactId"],
      },
    },
  },
];

// 2. COMMUNICATION & UPI PAYMENT CARDS
const COMM_PAY_TOOLS: GroqToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "prepare_phone_call",
      description:
        "Show Call confirmation card. Look up phone number via search_contacts_and_memories first if not given.",
      parameters: {
        type: "object",
        properties: {
          contactName: { type: "string" },
          phone: { type: "string" },
          reason: { type: "string" },
        },
        required: ["contactName", "phone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_whatsapp_message",
      description:
        "Show WhatsApp Message confirmation card. Search contact's phone first if needed.",
      parameters: {
        type: "object",
        properties: {
          contactName: { type: "string" },
          phone: { type: "string" },
          messageBody: { type: "string" },
        },
        required: ["contactName", "phone", "messageBody"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_sms_draft",
      description: "Show SMS Draft confirmation card. Search contact's phone first if needed.",
      parameters: {
        type: "object",
        properties: {
          contactName: { type: "string" },
          phone: { type: "string" },
          messageBody: { type: "string" },
        },
        required: ["contactName", "phone", "messageBody"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_upi_payment",
      description:
        "Show strict UPI Payment card using a '@' VPA (e.g. name@okaxis). Search memories first or ask user if VPA unknown.",
      parameters: {
        type: "object",
        properties: {
          contactName: { type: "string" },
          upiId: { type: "string", description: "Valid UPI ID containing '@'." },
          amount: { type: "number" },
          note: { type: "string" },
        },
        required: ["contactName", "upiId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_email_draft",
      description: "Show Email/Gmail draft confirmation card with subject & body.",
      parameters: {
        type: "object",
        properties: {
          toEmail: { type: "string" },
          recipientName: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["subject", "body"],
      },
    },
  },
];

// 3. ALARMS, TIMERS, REMINDERS & CALENDAR
const SCHEDULE_TOOLS: GroqToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "schedule_local_reminder",
      description:
        "Schedule a local phone notification via delayMinutes, exact triggerAtIso, or daily repeat (repeatDaily + dailyHour/dailyMinute).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          delayMinutes: { type: "number", description: "Minutes from now." },
          triggerAtIso: { type: "string", description: "Future ISO 8601 datetime." },
          repeatDaily: { type: "boolean" },
          dailyHour: { type: "number", description: "0-23" },
          dailyMinute: { type: "number", description: "0-59" },
        },
        required: ["title", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_or_cancel_reminders",
      description: "List scheduled local reminders (paginated) or cancel one/all.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "cancel_one", "cancel_all"] },
          reminderId: { type: "string" },
          offset: { type: "number" },
          limit: { type: "number" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_phone_alarm_or_timer",
      description:
        "Set native Clock Alarm (hour 0-23, minute 0-59) or Countdown Timer (durationSeconds).",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["alarm", "timer"] },
          label: { type: "string" },
          hour: { type: "number" },
          minute: { type: "number" },
          durationSeconds: { type: "number" },
        },
        required: ["mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_calendar_events",
      description: "Read phone calendar events (paginated).",
      parameters: {
        type: "object",
        properties: {
          startDateIso: { type: "string" },
          endDateIso: { type: "string" },
          query: { type: "string" },
          offset: { type: "number" },
          limit: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_calendar_event",
      description: "Show confirmation card to add an event to the phone calendar.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          startDateIso: { type: "string" },
          endDateIso: { type: "string" },
          location: { type: "string" },
          notes: { type: "string" },
          reminderMinutesBefore: { type: "number" },
        },
        required: ["title", "startDateIso"],
      },
    },
  },
];

// 4. MAPS, APPS & MEDIA LAUNCHERS
const APPS_NAV_TOOLS: GroqToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "open_maps_navigation",
      description: "Open Google/Apple Maps directions or place search.",
      parameters: {
        type: "object",
        properties: {
          destination: { type: "string" },
          mode: { type: "string", enum: ["navigate", "search"] },
          travelMode: {
            type: "string",
            enum: ["driving", "two-wheeler", "walking", "transit"],
          },
        },
        required: ["destination"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_app_or_media_search",
      description:
        "Open installed app (Blinkit, Zomato, Swiggy, Instagram, Uber, Calculator, etc.), search YouTube/Spotify, or open URL/Google search.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["youtube", "spotify", "google_search", "open_url", "app"],
          },
          queryOrAppName: { type: "string" },
          packageName: { type: "string" },
        },
        required: ["target", "queryOrAppName"],
      },
    },
  },
];

// 5. HARDWARE, SETTINGS, CLIPBOARD & GALLERY SCREENSHOT
const SYSTEM_GALLERY_TOOLS: GroqToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "device_system_controls",
      description:
        "Check battery %, get/set screen brightness (0-100), or open system Settings (wifi, bluetooth, location, display, sound, airplane, mobile_data, battery_saver, storage, apps, security).",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "battery_status",
              "get_brightness",
              "set_brightness",
              "restore_auto_brightness",
              "open_settings",
            ],
          },
          brightnessPercent: { type: "number" },
          settingsPanel: {
            type: "string",
            enum: [
              "main",
              "wifi",
              "bluetooth",
              "location",
              "display",
              "sound",
              "airplane",
              "mobile_data",
              "battery_saver",
              "storage",
              "apps",
              "security",
            ],
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clipboard_tool",
      description: "Read current phone clipboard text or copy text to clipboard.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["read", "copy"] },
          textToCopy: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_latest_gallery_image",
      description:
        "Load latest screenshot or photo from gallery for Vision analysis.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", enum: ["screenshot", "any"] },
          offset: { type: "number" },
        },
        required: [],
      },
    },
  },
];

export const FRIDAY_TOOLS: GroqToolDefinition[] = [
  ...CONTACTS_VAULT_TOOLS,
  ...COMM_PAY_TOOLS,
  ...SCHEDULE_TOOLS,
  ...APPS_NAV_TOOLS,
  ...SYSTEM_GALLERY_TOOLS,
];

const CONTACTS_REGEX =
  /\b(contact|contacts|phonebook|number|num|no\.|saved|save|याद|yaad|note|hisaab|hisab|udhaar|udhar|lena|dena|dene|lene|paise|paisa|rupay|rupaye|rs\b|₹|bill|rent|emi|due|settle|paid|chukta|birthday|bday|anniversary|janamdin|mummy|mom|maa|papa|dad|bhai|bhaiya|didi|sister|wife|husband|uncle|aunty|ji\b)/i;

const COMM_PAY_REGEX =
  /\b(call|dial|ring|phone\s+laga|baat\s+kar|sms|text\s+kar|msg|message|whatsapp|wa\b|upi|gpay|phonepe|paytm|bhim|pay\s+kar|bhej|send|mail|email|gmail)/i;

const SCHEDULE_REGEX =
  /\b(alarm|timer|stopwatch|countdown|remind|reminder|yaad\s+dila|notification|alert|calendar|schedule|meeting|appointment|event|free\s+time|aaj\s+ka\s+plan|kal\s+ka\s+plan|subah\s+\d|shaam\s+\d|raat\s+\d|\d+\s*(min|minute|ghante|hour|sec|second)\s*(baad|ka|ke))/i;

const APPS_NAV_REGEX =
  /\b(map|maps|route|rasta|direction|directions|navigate|navigation|nearest|nearby|kahan\s+hai|petrol|atm|hospital|youtube|yt\b|video|song|gaana|music|play\s+|chala\s+de|chalao|spotify|google\s+pe|search\s+kar|open\s+|khol|kholo|launch|blinkit|zomato|swiggy|zepto|instagram|insta|telegram|uber|ola|rapido|irctc|train|amazon|flipkart|myntra|calculator|camera)/i;

const SYSTEM_GALLERY_REGEX =
  /\b(battery|charge|charging|brightness|screen\s+light|dim|wifi|wi-fi|bluetooth|hotspot|airplane|location\s+setting|setting|settings|storage|clipboard|copied|copy\s+kiya|copy\s+kar|paste|screenshot|gallery|last\s+photo|latest\s+photo|recent\s+photo|screen\s+padh)/i;

const PAGINATION_FOLLOWUP_REGEX =
  /\b(aur\s+dikha|aur\s+bata|next\s+page|show\s+more|more\s+contacts|baaki|agla|next\s+\d+|continue|haan|yes|ok\s+kar|usse|unko|isko|usko)/i;

/**
 * Smart Intent-Aware Tool Selector:
 * - Returns `[]` (ZERO tool schemas -> saves ~90% prompt tokens & prevents unwanted tool calls!)
 *   when the user's message is normal chat, coding, math, or general knowledge.
 * - Returns ONLY the relevant compact domain tools (~4-10 tools) when device/personal intent is present!
 */
export function selectRelevantTools(params: {
  userMessage: string;
  history: ConversationTurn[];
  agentMessages?: AgentLoopMessage[];
}): GroqToolDefinition[] {
  const { userMessage, history, agentMessages } = params;
  const currentText = userMessage.trim();

  // Collect any tools already invoked in the active multi-step loop so Groq validates prior tool_calls
  const previouslyCalledNames = new Set<string>();
  if (Array.isArray(agentMessages)) {
    for (const msg of agentMessages) {
      if (msg.role === "assistant" && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          if (tc.function?.name) previouslyCalledNames.add(tc.function.name);
        }
      }
    }
  }

  // Include last 2 turns only if the user sent a short follow-up ("aur dikhao", "haan bhej do", "500 kar do")
  const isShortFollowUp =
    currentText.length <= 45 || PAGINATION_FOLLOWUP_REGEX.test(currentText);
  const recentContext = isShortFollowUp
    ? `${history
        .slice(-2)
        .map((h) => h.content.slice(0, 300))
        .join(" ")} ${currentText}`
    : currentText;

  const selected = new Map<string, GroqToolDefinition>();
  const addGroup = (group: GroqToolDefinition[]) => {
    for (const tool of group) {
      selected.set(tool.function.name, tool);
    }
  };

  const matchContacts = CONTACTS_REGEX.test(recentContext);
  const matchComm = COMM_PAY_REGEX.test(recentContext);
  const matchSchedule = SCHEDULE_REGEX.test(recentContext);
  const matchAppsNav = APPS_NAV_REGEX.test(recentContext);
  const matchSystem = SYSTEM_GALLERY_REGEX.test(recentContext);

  if (matchContacts) {
    addGroup(CONTACTS_VAULT_TOOLS);
  }
  if (matchComm) {
    addGroup(COMM_PAY_TOOLS);
    // Always include contact lookup when calling/messaging/paying someone!
    selected.set(
      CONTACTS_VAULT_TOOLS[0].function.name,
      CONTACTS_VAULT_TOOLS[0]
    );
    selected.set(
      CONTACTS_VAULT_TOOLS[2].function.name,
      CONTACTS_VAULT_TOOLS[2]
    );
    selected.set(
      CONTACTS_VAULT_TOOLS[4].function.name,
      CONTACTS_VAULT_TOOLS[4]
    );
  }
  if (matchSchedule) {
    addGroup(SCHEDULE_TOOLS);
  }
  if (matchAppsNav) {
    addGroup(APPS_NAV_TOOLS);
  }
  if (matchSystem) {
    addGroup(SYSTEM_GALLERY_TOOLS);
  }

  // Ensure any already-called tool in this turn stays in the schema
  if (previouslyCalledNames.size > 0) {
    for (const tool of FRIDAY_TOOLS) {
      if (previouslyCalledNames.has(tool.function.name)) {
        selected.set(tool.function.name, tool);
      }
    }
  }

  return Array.from(selected.values());
}
