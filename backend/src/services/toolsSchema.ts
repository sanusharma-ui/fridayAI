export const FRIDAY_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_contacts_and_memories",
      description:
        "Search BOTH Friday's local SQLite Vault AND the user's real Device Phonebook (Android/iOS Contacts) for contacts, phone numbers, UPI IDs, birthdays, pending bills, money balances/udhaar/hisaab (payable or receivable), notes, and custom details. ALWAYS call this first whenever the user mentions any person/relation (e.g. 'Mummy ko call laga', 'Rahul ko WhatsApp kar', 'Sharma ji ko UPI kar'), asks about birthdays/dues/bills/notes, or before updating/settling existing info. Leave query empty to list saved contacts and active records.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Name, relationship (e.g. Mummy, Papa, Sharma ji, Rahul), phone digits, or keyword (e.g. birthday, bill, udhaar, upi, rent). Use empty string '' to list all.",
          },
          category: {
            type: "string",
            description:
              "Optional category filter: 'all', 'ledger', 'bill', 'birthday', 'note', or 'custom'. Defaults to 'all'.",
          },
          includeDeviceContacts: {
            type: "boolean",
            description:
              "Whether to also search the phone's native Contact Book (expo-contacts) when looking up people or numbers. Defaults to true.",
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
        "Search directly inside the user's real Android/iOS Phone Contact Book for names, multiple phone numbers, emails, or company/job info. Useful when the user asks to search their phone contacts specifically (e.g. 'Mere phone me kitne Sharma save hain?', 'Electrician ka number phonebook me dekho').",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Name, partial name, relationship alias (e.g. Mom, Mummy, Papa, Dad), or phone digits to search in device contacts. Leave empty to list top device contacts.",
          },
          limit: {
            type: "number",
            description: "Max contacts to return (default 20, max 50).",
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
        "Create a new contact or update an existing contact's profile (name, phone number, relationship/tag, birthday, general notes/UPI ID) in Friday's local SQLite Vault.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description:
              "Existing SQLite contact ID (starts with 'cnt_') returned by search_contacts_and_memories if updating a known vault contact. Omit if creating new or matching by name.",
          },
          name: {
            type: "string",
            description: "Contact's name (e.g. 'Rahul', 'Mummy', 'Sharma ji').",
          },
          phone: {
            type: "string",
            description: "Phone number if known or provided by user.",
          },
          relationship: {
            type: "string",
            description:
              "Optional relationship or role (e.g. 'Mother', 'Friend', 'Landlord', 'Colleague').",
          },
          birthday: {
            type: "string",
            description:
              "Optional birthday date (e.g. '14 May', '1999-11-20').",
          },
          notes: {
            type: "string",
            description:
              "Optional general note or UPI ID about this person.",
          },
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
        "Prepare a confirmation card to save a new contact directly into the user's real Android/iOS System Phonebook (and sync to Friday Vault). Use this when the user wants a number saved into their actual phone contacts (e.g. 'Phonebook me save kar lo', 'Phone contacts me add kar do').",
      parameters: {
        type: "object",
        properties: {
          contactName: {
            type: "string",
            description: "Full name to save in the phonebook.",
          },
          phone: {
            type: "string",
            description: "Phone number to save.",
          },
          email: {
            type: "string",
            description: "Optional email address.",
          },
          company: {
            type: "string",
            description: "Optional company, shop, or role label.",
          },
          relationship: {
            type: "string",
            description: "Optional relationship tag for Friday Vault.",
          },
          notes: {
            type: "string",
            description: "Optional note to attach.",
          },
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
        "Save any extra detail, money transaction/hisaab (udhaar, lena-dena, split), pending bill, birthday/important date, UPI ID, note, or custom attribute for a contact (or as a general personal memory if no contact applies). Automatically creates the contact in SQLite if contactName does not exist yet.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description:
              "Optional SQLite contact ID ('cnt_...') if already found via search.",
          },
          contactName: {
            type: "string",
            description:
              "Person's name if this info belongs to a contact (e.g. 'Sharma ji', 'Rahul', 'Mummy'). Leave empty for general user self-notes.",
          },
          category: {
            type: "string",
            enum: ["ledger", "bill", "birthday", "note", "custom"],
            description:
              "'ledger' for money owed/lent/hisaab/udhaar; 'bill' for bills/rent/subscriptions; 'birthday' for birthdays/anniversaries; 'note' for general notes; 'custom' for any custom attribute (UPI ID, address, preferences, etc.).",
          },
          label: {
            type: "string",
            description:
              "Short title of the entry (e.g. 'Pending Payment', 'Udhaar Given', 'Birthday', 'Electricity Bill', 'UPI ID').",
          },
          detail: {
            type: "string",
            description:
              "Clear description of what to remember (e.g. 'Sharma ji ko 500 rupaye dene hain', 'sharma@okaxis', '14 May').",
          },
          amount: {
            type: "number",
            description:
              "Numeric money amount if applicable (e.g. 500). Omit if no money amount.",
          },
          direction: {
            type: "string",
            enum: ["payable", "receivable", "none"],
            description:
              "'payable' when USER needs to pay/give money (mujhe dene hain); 'receivable' when USER needs to receive/collect money (mujhe lene hain / samne wale ko dene hain); 'none' if not a money balance.",
          },
          eventDate: {
            type: "string",
            description:
              "Optional due date, reminder date, or birthday (e.g. '14 May', '2026-12-05', '5th of every month').",
          },
        },
        required: ["category", "label", "detail"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_memory_status",
      description:
        "Mark an existing money hisaab, bill, or memory as settled/paid, update its remaining amount/detail (e.g. partial payment), or delete it.",
      parameters: {
        type: "object",
        properties: {
          memoryId: {
            type: "string",
            description:
              "ID of the memory/hisaab item returned by search_contacts_and_memories.",
          },
          action: {
            type: "string",
            enum: ["settle", "update", "delete"],
            description:
              "'settle' when paid/cleared, 'update' to change amount or detail, 'delete' to remove.",
          },
          newAmount: {
            type: "number",
            description: "Updated remaining numeric amount when action is 'update'.",
          },
          newDetail: {
            type: "string",
            description: "Updated detail text when action is 'update' or 'settle'.",
          },
        },
        required: ["memoryId", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_contact",
      description:
        "Delete a contact from Friday's local SQLite database ONLY when the user explicitly requests deleting that contact.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description: "SQLite ID ('cnt_...') of the contact to delete.",
          },
        },
        required: ["contactId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_phone_call",
      description:
        "Prepare a Phone Call confirmation card on the user's screen. Search contacts (vault + device phonebook) first if the phone number isn't explicitly provided in the message. Note: the call dials only after the user taps Confirm.",
      parameters: {
        type: "object",
        properties: {
          contactName: {
            type: "string",
            description: "Display name of the person to call.",
          },
          phone: {
            type: "string",
            description: "Phone number to dial.",
          },
          reason: {
            type: "string",
            description: "Optional short context for the call.",
          },
        },
        required: ["contactName", "phone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_sms_draft",
      description:
        "Prepare an SMS Draft confirmation card on the user's screen so the user can review/edit and confirm sending. Search contacts first if the phone number isn't explicitly provided. Never claim the SMS was already sent without user confirmation.",
      parameters: {
        type: "object",
        properties: {
          contactName: {
            type: "string",
            description: "Recipient's display name.",
          },
          phone: {
            type: "string",
            description: "Recipient's phone number.",
          },
          messageBody: {
            type: "string",
            description:
              "Natural, well-written SMS text matching what the user wants to communicate.",
          },
        },
        required: ["contactName", "phone", "messageBody"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_whatsapp_message",
      description:
        "Prepare an interactive WhatsApp Message confirmation card so the user can review/edit the message and open the person's WhatsApp chat directly in 1 tap. Search contacts (vault + phonebook) first to get their phone number if not provided. Ideal for Hinglish/Hindi messages, udhaar reminders, greetings, or quick updates.",
      parameters: {
        type: "object",
        properties: {
          contactName: {
            type: "string",
            description: "Recipient's display name.",
          },
          phone: {
            type: "string",
            description:
              "Recipient's phone number (10-digit Indian mobile numbers automatically get +91 formatting).",
          },
          messageBody: {
            type: "string",
            description:
              "Natural, friendly WhatsApp message text matching the user's tone and request.",
          },
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
        "Prepare a strict UPI Payment confirmation card (GPay / PhonePe / Paytm / BHIM) using a recipient's UPI ID (VPA like 'name@okicici', '9876543210@ybl'). Search contacts & memories first to check if a UPI ID is saved for that person. If no UPI ID is known, ask the user for the recipient's UPI ID first!",
      parameters: {
        type: "object",
        properties: {
          contactName: {
            type: "string",
            description: "Payee display name (e.g. 'Sharma ji', 'Rahul').",
          },
          upiId: {
            type: "string",
            description:
              "Valid UPI VPA / ID containing '@' (e.g. 'rahul@okaxis', '9876543210@paytm').",
          },
          amount: {
            type: "number",
            description:
              "Amount in INR (₹) to pay. Optional if user wants to enter amount inside the UPI app.",
          },
          note: {
            type: "string",
            description:
              "Short payment note / remarks (e.g. 'Electricity Bill', 'Dinner split').",
          },
        },
        required: ["contactName", "upiId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_local_reminder",
      description:
        "Schedule a real local push notification reminder on the user's phone (expo-notifications) with sound & alert. Supports relative delay ('20 minute baad paani peena hai'), exact date/time ('Kal subah 10 baje electricity bill bharna hai'), or daily recurring time ('Roz raat 9:30 baje dawai leni hai').",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Short notification title (e.g. '💊 Medicine Reminder', '⚡ Pay Electricity Bill', '💧 Drink Water').",
          },
          body: {
            type: "string",
            description:
              "Clear reminder message shown in the notification banner.",
          },
          delayMinutes: {
            type: "number",
            description:
              "Trigger after N minutes from right now (e.g. 20 for '20 min baad', 0.5 for '30 seconds baad'). Use this for relative delays.",
          },
          triggerAtIso: {
            type: "string",
            description:
              "Exact future ISO 8601 date-time (e.g. '2026-11-28T10:00:00+05:30') when user gives a specific date/time and repeatDaily is false.",
          },
          repeatDaily: {
            type: "boolean",
            description:
              "Set true ONLY if the user wants a daily recurring reminder every day at dailyHour:dailyMinute.",
          },
          dailyHour: {
            type: "number",
            description:
              "Hour in 24-hour format (0-23) when repeatDaily is true.",
          },
          dailyMinute: {
            type: "number",
            description: "Minute (0-59) when repeatDaily is true.",
          },
        },
        required: ["title", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_or_cancel_reminders",
      description:
        "List all active scheduled local notification reminders on the user's phone, cancel a specific reminder by ID, or cancel all scheduled reminders.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["list", "cancel_one", "cancel_all"],
            description:
              "'list' to view scheduled reminders, 'cancel_one' to cancel by reminderId, 'cancel_all' to clear all scheduled reminders.",
          },
          reminderId: {
            type: "string",
            description:
              "Notification identifier returned by list_or_cancel_reminders or schedule_local_reminder when action is 'cancel_one'.",
          },
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
        "Set a real System Clock Alarm ('Subah 6:30 ka alarm laga de') or Countdown Timer ('15 minute ka timer chala de') in the user's native Android Clock app (with automatic notification fallback on iOS).",
      parameters: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["alarm", "timer"],
            description:
              "'alarm' for a specific clock time (hour:minute), or 'timer' for a countdown duration.",
          },
          label: {
            type: "string",
            description:
              "Optional alarm/timer label (e.g. 'Morning Gym', 'Tea Timer').",
          },
          hour: {
            type: "number",
            description:
              "24-hour clock hour (0-23) when mode is 'alarm' (e.g. 6 for 6:30 AM, 18 for 6:30 PM).",
          },
          minute: {
            type: "number",
            description: "Clock minute (0-59) when mode is 'alarm'.",
          },
          durationSeconds: {
            type: "number",
            description:
              "Total countdown seconds when mode is 'timer' (e.g. 900 for 15 minutes).",
          },
        },
        required: ["mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_calendar_events",
      description:
        "Read upcoming events, meetings, and schedules from the user's real Phone / Google / iCloud Calendar (expo-calendar). Call this when the user asks 'Aaj mera schedule kya hai?', 'Kal koi meeting hai kya?', or 'Is hafte ke events batao'.",
      parameters: {
        type: "object",
        properties: {
          startDateIso: {
            type: "string",
            description:
              "Optional start ISO 8601 date-time. Defaults to start of today if omitted.",
          },
          endDateIso: {
            type: "string",
            description:
              "Optional end ISO 8601 date-time. Defaults to 7 days from start if omitted.",
          },
          query: {
            type: "string",
            description:
              "Optional keyword filter for event title, location, or notes.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_calendar_event",
      description:
        "Prepare a Calendar Event confirmation card so the user can review and add an event/meeting to their real Phone / Google Calendar in 1 tap.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Event or meeting title (e.g. 'Dentist Appointment', 'Client Call with Rahul').",
          },
          startDateIso: {
            type: "string",
            description:
              "Event start ISO 8601 date-time (e.g. '2026-11-28T15:00:00+05:30').",
          },
          endDateIso: {
            type: "string",
            description:
              "Optional event end ISO 8601 date-time. Defaults to 1 hour after startDateIso if omitted.",
          },
          location: {
            type: "string",
            description: "Optional venue, address, or meeting link.",
          },
          notes: {
            type: "string",
            description: "Optional agenda or notes for the calendar event.",
          },
          reminderMinutesBefore: {
            type: "number",
            description:
              "Minutes before event to trigger calendar alert (default 15).",
          },
        },
        required: ["title", "startDateIso"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_maps_navigation",
      description:
        "Open Google Maps (or Apple Maps) directly for turn-by-turn navigation or place search (e.g. 'Connaught Place ka rasta dikha', 'Nearest petrol pump search kar', 'Airport ke liye driving navigation chalu kar').",
      parameters: {
        type: "object",
        properties: {
          destination: {
            type: "string",
            description:
              "Place name, address, landmark, or category (e.g. 'Nearest ATM', 'India Gate New Delhi').",
          },
          mode: {
            type: "string",
            enum: ["navigate", "search"],
            description:
              "'navigate' to start directions/route, 'search' to explore places on the map. Defaults to 'navigate'.",
          },
          travelMode: {
            type: "string",
            enum: ["driving", "two-wheeler", "walking", "transit"],
            description: "Travel mode for directions. Defaults to 'driving'.",
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
        "Launch installed apps on the phone (Swiggy, Zomato, Blinkit, Zepto, Instagram, WhatsApp, GPay, PhonePe, Paytm, Uber, Ola, Rapido, Calculator, Camera, etc.), play/search videos & music on YouTube or Spotify, or open a Google Search / URL in the browser.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["youtube", "spotify", "google_search", "open_url", "app"],
            description:
              "'youtube' to search/play on YouTube; 'spotify' to search music on Spotify; 'google_search' to search Google in browser; 'open_url' to open a specific URL; 'app' to launch an installed app by name.",
          },
          queryOrAppName: {
            type: "string",
            description:
              "Search query (for youtube/spotify/google_search), full https URL (for open_url), or app name like 'Blinkit', 'Zomato', 'Instagram', 'Calculator' (for app).",
          },
          packageName: {
            type: "string",
            description:
              "Optional explicit Android package name if known (e.g. 'com.grofers.customerapp').",
          },
        },
        required: ["target", "queryOrAppName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_email_draft",
      description:
        "Prepare an interactive Email / Gmail Draft confirmation card so the user can review/edit the recipient, subject, and body and open their Mail/Gmail app in 1 tap.",
      parameters: {
        type: "object",
        properties: {
          toEmail: {
            type: "string",
            description:
              "Recipient email address if known (leave empty string '' if user didn't give an email yet; user can type it on the card).",
          },
          recipientName: {
            type: "string",
            description:
              "Optional recipient label (e.g. 'HR Team', 'Manager', 'Rahul').",
          },
          subject: {
            type: "string",
            description: "Clear, professional email subject line.",
          },
          body: {
            type: "string",
            description: "Well-written email body text.",
          },
        },
        required: ["subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "device_system_controls",
      description:
        "Check phone battery percentage & charging status, get or set screen brightness (0-100%), or open specific system Settings screens (Wi-Fi, Bluetooth, Location, Display, Sound, Airplane Mode, Mobile Data, Battery Saver, Storage, Apps).",
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
            description: "Hardware or system action to perform.",
          },
          brightnessPercent: {
            type: "number",
            description:
              "Desired brightness percentage (0 to 100) when action is 'set_brightness'.",
          },
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
            description:
              "Which system Settings page to open when action is 'open_settings'.",
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
      description:
        "Read the current text copied in the user's phone clipboard ('Maine abhi jo copy kiya hai usko samjha do / summarize kar do') OR copy text directly to the user's clipboard.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["read", "copy"],
            description:
              "'read' to inspect current clipboard text, 'copy' to write textToCopy into clipboard.",
          },
          textToCopy: {
            type: "string",
            description: "Text to place on clipboard when action is 'copy'.",
          },
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
        "Fetch the latest screenshot or photo from the user's phone gallery so Friday's Vision model can read and analyze it (e.g. 'Mera last screenshot padh ke batao kitne ka bill hai', 'Meri latest photo dekho').",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["screenshot", "any"],
            description:
              "'screenshot' when user specifically mentions screenshot/bill screen; 'any' for the most recent photo/image of any kind.",
          },
          offset: {
            type: "number",
            description:
              "0 for the very latest image (default), 1 for second latest, etc.",
          },
        },
        required: [],
      },
    },
  },
] as const;
