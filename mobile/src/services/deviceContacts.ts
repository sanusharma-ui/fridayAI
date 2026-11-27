import {
  Contact,
  ContactField,
  ContactsSortOrder,
  getPermissionsAsync,
  requestPermissionsAsync,
  type ContactDate,
  type CreateContactRecord,
} from "expo-contacts";
import { Platform } from "react-native";
import type { DeviceContactItem } from "../types";

export type ContactsPermissionState = "granted" | "denied" | "unavailable";

const CACHE_TTL_MS = 25_000;
let cachedContacts: DeviceContactItem[] | null = null;
let cachedAt = 0;

/**
 * Hinglish & Indian family relationship alias groups so queries like
 * "Mummy ko call laga" match "Mom", "Maa", "Mother", "Ammi", etc. in the phonebook!
 */
const ALIAS_GROUPS: string[][] = [
  ["mummy", "mom", "maa", "mata", "mother", "ammi", "aai", "mumma"],
  ["papa", "dad", "daddy", "father", "pitaji", "abba", "baba", "bapu"],
  ["bhai", "bhaiya", "brother", "bro", "bhayya"],
  ["didi", "behen", "sister", "sis", "api", "baji"],
  ["wife", "biwi", "patni", "better half", "wifey"],
  ["husband", "pati", "hubby"],
  ["dada", "dadaji", "grandpa", "grandfather"],
  ["dadi", "dadiji", "grandma", "grandmother"],
  ["nana", "nanaji"],
  ["nani", "naniji"],
  ["chacha", "uncle", "tau", "mama", "fufa", "mausa"],
  ["chachi", "aunty", "aunt", "tai", "mami", "bua", "mausi"],
];

export function invalidateDeviceContactsCache(): void {
  cachedContacts = null;
  cachedAt = 0;
}

export function normalizeDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Formats a phone number for WhatsApp deep links (`91XXXXXXXXXX` without `+` or spaces).
 * Automatically prefixes `91` for standard 10-digit Indian mobile numbers.
 */
export function formatWhatsAppPhone(rawPhone: string): string {
  const trimmed = rawPhone.trim();
  const hasExplicitPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return "";
  if (hasExplicitPlus) {
    return digits;
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

function expandQueryTokens(rawQuery: string): string[] {
  const lower = rawQuery.trim().toLowerCase();
  if (!lower) return [];

  const baseTokens = lower
    .split(/[\s,._-]+/)
    .map((t) => t.replace(/^ji$/i, "").trim())
    .filter((t) => t.length >= 2);

  const expanded = new Set<string>(baseTokens);
  expanded.add(lower);

  for (const tok of baseTokens) {
    for (const group of ALIAS_GROUPS) {
      if (group.includes(tok)) {
        for (const alias of group) {
          expanded.add(alias);
        }
      }
    }
  }

  return Array.from(expanded);
}

function formatContactDate(bday?: ContactDate | null): string | undefined {
  if (!bday || typeof bday.day !== "number" || typeof bday.month !== "number") {
    return undefined;
  }
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  // In Expo Contacts v58 ContactDate.month is 1..12
  const idx = bday.month >= 1 && bday.month <= 12 ? bday.month - 1 : bday.month;
  const monthLabel = months[idx] || String(bday.month);

  return bday.year
    ? `${bday.day} ${monthLabel} ${bday.year}`
    : `${bday.day} ${monthLabel}`;
}

export async function ensureContactsPermission(
  requestIfNeeded = true
): Promise<ContactsPermissionState> {
  if (Platform.OS === "web") {
    return "unavailable";
  }

  try {
    const existing = await getPermissionsAsync();
    if (existing.status === "granted") {
      return "granted";
    }
    if (!requestIfNeeded) {
      return "denied";
    }
    const requested = await requestPermissionsAsync();
    return requested.status === "granted" ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

export async function loadAllDeviceContacts(
  requestPermission = true
): Promise<{
  permission: ContactsPermissionState;
  contacts: DeviceContactItem[];
}> {
  const permission = await ensureContactsPermission(requestPermission);
  if (permission !== "granted") {
    return { permission, contacts: [] };
  }

  const now = Date.now();
  if (cachedContacts && now - cachedAt < CACHE_TTL_MS) {
    return { permission: "granted", contacts: cachedContacts };
  }

  const fields =
    Platform.OS === "ios"
      ? ([
          ContactField.FULL_NAME,
          ContactField.GIVEN_NAME,
          ContactField.FAMILY_NAME,
          ContactField.PHONES,
          ContactField.EMAILS,
          ContactField.COMPANY,
          ContactField.BIRTHDAY,
          ContactField.DATES,
        ] as const)
      : ([
          ContactField.FULL_NAME,
          ContactField.GIVEN_NAME,
          ContactField.FAMILY_NAME,
          ContactField.PHONES,
          ContactField.EMAILS,
          ContactField.COMPANY,
          ContactField.DATES,
        ] as const);

  const rows = await Contact.getAllDetails(fields, {
    sortOrder: ContactsSortOrder.GivenName,
  });

  const mapped: DeviceContactItem[] = [];

  for (const item of rows) {
    const rawPhones = Array.isArray(item.phones) ? item.phones : [];
    const seenDigits = new Set<string>();
    const cleanPhones: Array<{ label: string; number: string }> = [];

    for (const p of rawPhones) {
      const rawNum = (p.number || "").trim();
      if (!rawNum) continue;
      const norm = normalizeDigits(rawNum);
      if (norm && seenDigits.has(norm)) continue;
      if (norm) seenDigits.add(norm);
      cleanPhones.push({
        label: p.label || "mobile",
        number: rawNum,
      });
    }

    const displayName =
      (item.fullName || "").trim() ||
      [item.givenName, item.familyName].filter(Boolean).join(" ").trim();

    if (!displayName && cleanPhones.length === 0) continue;

    const emails = Array.isArray(item.emails)
      ? item.emails
          .map((e) => (e.address || "").trim())
          .filter((e) => Boolean(e))
      : [];

    const bdayFromDates = Array.isArray(item.dates)
      ? item.dates.find((d) => (d.label || "").toLowerCase().includes("birth"))
          ?.date
      : undefined;
    const iosBday =
      "birthday" in item
        ? (item as { birthday?: ContactDate | null }).birthday
        : undefined;

    mapped.push({
      deviceId: item.id || `dev_${mapped.length}`,
      name: displayName || cleanPhones[0]?.number || "Unknown",
      primaryPhone: cleanPhones[0]?.number || "",
      phones: cleanPhones,
      emails: emails.length > 0 ? emails : undefined,
      company: item.company?.trim() || undefined,
      birthday: formatContactDate(iosBday || bdayFromDates),
    });
  }

  cachedContacts = mapped;
  cachedAt = now;
  return { permission: "granted", contacts: mapped };
}

export async function searchDeviceContacts(
  query = "",
  limit = 20
): Promise<{
  permission: ContactsPermissionState;
  totalDeviceContacts: number;
  matches: DeviceContactItem[];
}> {
  const { permission, contacts } = await loadAllDeviceContacts(true);
  if (permission !== "granted") {
    return {
      permission,
      totalDeviceContacts: 0,
      matches: [],
    };
  }

  const cleanLimit = Math.max(1, Math.min(50, limit));
  const q = query.trim().toLowerCase();

  if (!q) {
    return {
      permission,
      totalDeviceContacts: contacts.length,
      matches: contacts
        .filter((c) => Boolean(c.primaryPhone))
        .slice(0, cleanLimit),
    };
  }

  const queryDigits = normalizeDigits(q);
  const tokens = expandQueryTokens(q);

  const scored: Array<{ item: DeviceContactItem; score: number }> = [];

  for (const c of contacts) {
    const nameLower = c.name.toLowerCase();
    const companyLower = (c.company || "").toLowerCase();
    const hay = `${nameLower} ${companyLower} ${(c.emails || []).join(" ").toLowerCase()}`;

    let score = 0;

    if (nameLower === q) {
      score += 100;
    } else if (nameLower.startsWith(q)) {
      score += 75;
    } else if (nameLower.includes(q)) {
      score += 55;
    }

    for (const tok of tokens) {
      const nameWords = nameLower.split(/[\s,._()-]+/);
      if (nameWords.includes(tok)) {
        score += 50;
      } else if (hay.includes(tok)) {
        score += 22;
      }
    }

    if (queryDigits.length >= 3) {
      const phoneMatch = c.phones.some((p) =>
        normalizeDigits(p.number).includes(queryDigits)
      );
      if (phoneMatch) {
        score += 65;
      }
    }

    if (score > 0) {
      scored.push({ item: c, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.name.localeCompare(b.item.name);
  });

  return {
    permission,
    totalDeviceContacts: contacts.length,
    matches: scored.slice(0, cleanLimit).map((s) => s.item),
  };
}

export async function saveContactToDevicePhonebook(input: {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  notes?: string;
}): Promise<{ ok: boolean; deviceContactId?: string; error?: string }> {
  if (Platform.OS === "web") {
    return {
      ok: false,
      error: "Saving to system phonebook is only supported on Android/iOS.",
    };
  }

  const permission = await ensureContactsPermission(true);
  if (permission !== "granted") {
    return {
      ok: false,
      error:
        "Contacts permission denied. Please grant Contacts permission in phone Settings.",
    };
  }

  const cleanName = input.name.trim();
  const cleanPhone = input.phone.trim();
  if (!cleanName || !cleanPhone) {
    return {
      ok: false,
      error: "Both contact name and phone number are required.",
    };
  }

  const nameParts = cleanName.split(/\s+/);
  const givenName = nameParts[0] || cleanName;
  const familyName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

  try {
    const record: CreateContactRecord = {
      givenName,
      ...(familyName ? { familyName } : {}),
      phones: [
        {
          label: "mobile",
          number: cleanPhone,
        },
      ],
      ...(input.email?.trim()
        ? {
            emails: [
              {
                label: "personal",
                address: input.email.trim(),
              },
            ],
          }
        : {}),
      ...(input.company?.trim() ? { company: input.company.trim() } : {}),
      ...(input.notes?.trim() ? { note: input.notes.trim() } : {}),
    };

    const created = await Contact.create(record);
    invalidateDeviceContactsCache();
    return { ok: true, deviceContactId: created.id };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Could not save contact to device phonebook.",
    };
  }
}
