export const FRIDAY_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_contacts_and_memories",
      description:
        "Search the user's local SQLite database for saved contacts, phone numbers, birthdays, pending bills, money balances/udhaar/hisaab (payable or receivable), notes, and custom details. ALWAYS call this first when the user asks about any person, wants to call or SMS someone (to find their phone number), asks about birthdays/dues/bills/notes, or before updating/settling existing info. Leave query empty to list all contacts and active records.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Name, relationship (e.g. Mummy, Papa, Sharma ji, Rahul), phone digits, or keyword (e.g. birthday, bill, udhaar, rent). Use empty string '' to list all.",
          },
          category: {
            type: "string",
            description:
              "Optional category filter: 'all', 'ledger', 'bill', 'birthday', 'note', or 'custom'. Defaults to 'all'.",
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
        "Create a new contact or update an existing contact's core profile (name, phone number, relationship/tag, birthday, general notes) in the local database.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description:
              "Existing contact ID returned by search_contacts_and_memories if updating a known contact. Omit if creating new or matching by name.",
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
            description: "Optional general note about this person.",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_memory_or_hisaab",
      description:
        "Save any extra detail, money transaction/hisaab (udhaar, lena-dena, split), pending bill, birthday/important date, note, or custom attribute for a contact (or as a general personal memory if no contact applies). Automatically creates the contact if contactName does not exist yet.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description: "Optional contact ID if already found via search.",
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
              "Clear description of what to remember (e.g. 'Sharma ji ko 500 rupaye dene hain', '14 May').",
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
        "Delete a contact from the local database ONLY when the user explicitly requests deleting that contact.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description: "ID of the contact to delete.",
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
        "Prepare a Phone Call confirmation card on the user's Android screen. Search contacts first if the phone number isn't explicitly provided in the message. Note: this creates a confirmation prompt; the call dials only after the user taps Confirm.",
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
] as const;
