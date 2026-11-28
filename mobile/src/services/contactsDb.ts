import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import type {
  ContactRecord,
  MemoryCategory,
  MemoryDirection,
  MemoryRecord,
  MemoryStatus,
} from "../types";

const DB_NAME = "friday_personal_manager.db";
const WEB_CONTACTS_KEY = "friday:web:contacts:v1";
const WEB_MEMORIES_KEY = "friday:web:memories:v1";

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS contacts (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          phone TEXT DEFAULT '',
          relationship TEXT DEFAULT '',
          birthday TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY NOT NULL,
          contact_id TEXT,
          contact_name TEXT DEFAULT '',
          category TEXT NOT NULL DEFAULT 'note',
          label TEXT NOT NULL,
          detail TEXT NOT NULL,
          amount REAL,
          direction TEXT DEFAULT 'none',
          event_date TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'active',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

interface RawContactRow {
  id: string;
  name: string;
  phone: string | null;
  relationship: string | null;
  birthday: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

interface RawMemoryRow {
  id: string;
  contact_id: string | null;
  contact_name: string | null;
  category: string;
  label: string;
  detail: string;
  amount: number | null;
  direction: string | null;
  event_date: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

function mapContactRow(row: RawContactRow): ContactRecord {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || "",
    relationship: row.relationship || "",
    birthday: row.birthday || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMemoryRow(row: RawMemoryRow): MemoryRecord {
  return {
    id: row.id,
    contactId: row.contact_id,
    contactName: row.contact_name || "",
    category: (row.category as MemoryCategory) || "note",
    label: row.label,
    detail: row.detail,
    amount: typeof row.amount === "number" ? row.amount : null,
    direction: (row.direction as MemoryDirection) || "none",
    eventDate: row.event_date || "",
    status: (row.status as MemoryStatus) || "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Web fallback helpers (only used if opened in browser preview)
async function readWebStore(): Promise<{
  contacts: ContactRecord[];
  memories: MemoryRecord[];
}> {
  const [cRaw, mRaw] = await Promise.all([
    AsyncStorage.getItem(WEB_CONTACTS_KEY),
    AsyncStorage.getItem(WEB_MEMORIES_KEY),
  ]);
  return {
    contacts: cRaw ? JSON.parse(cRaw) : [],
    memories: mRaw ? JSON.parse(mRaw) : [],
  };
}

async function writeWebStore(
  contacts: ContactRecord[],
  memories: MemoryRecord[]
): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(WEB_CONTACTS_KEY, JSON.stringify(contacts)),
    AsyncStorage.setItem(WEB_MEMORIES_KEY, JSON.stringify(memories)),
  ]);
}

export async function getAllContacts(): Promise<ContactRecord[]> {
  if (Platform.OS === "web") {
    const { contacts } = await readWebStore();
    return contacts.sort((a, b) => a.name.localeCompare(b.name));
  }
  const db = await getDb();
  const rows = await db.getAllAsync<RawContactRow>(
    "SELECT * FROM contacts ORDER BY name COLLATE NOCASE ASC"
  );
  return rows.map(mapContactRow);
}

export async function getAllMemories(includeSettled = true): Promise<MemoryRecord[]> {
  if (Platform.OS === "web") {
    const { memories } = await readWebStore();
    const list = includeSettled
      ? memories
      : memories.filter((m) => m.status !== "settled");
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const db = await getDb();
  const rows = includeSettled
    ? await db.getAllAsync<RawMemoryRow>(
        "SELECT * FROM memories ORDER BY updated_at DESC"
      )
    : await db.getAllAsync<RawMemoryRow>(
        "SELECT * FROM memories WHERE status != 'settled' ORDER BY updated_at DESC"
      );
  return rows.map(mapMemoryRow);
}

export interface UpsertContactInput {
  contactId?: string;
  name: string;
  phone?: string;
  relationship?: string;
  birthday?: string;
  notes?: string;
}

export async function upsertContact(
  input: UpsertContactInput
): Promise<{ contact: ContactRecord; created: boolean }> {
  const now = Date.now();
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error("Contact name is required.");
  }

  if (Platform.OS === "web") {
    const { contacts, memories } = await readWebStore();
    const existing =
      (input.contactId && contacts.find((c) => c.id === input.contactId)) ||
      contacts.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());

    if (existing) {
      existing.name = cleanName || existing.name;
      if (input.phone !== undefined && input.phone.trim()) {
        existing.phone = input.phone.trim();
      }
      if (input.relationship !== undefined && input.relationship.trim()) {
        existing.relationship = input.relationship.trim();
      }
      if (input.birthday !== undefined && input.birthday.trim()) {
        existing.birthday = input.birthday.trim();
      }
      if (input.notes !== undefined && input.notes.trim()) {
        existing.notes = input.notes.trim();
      }
      existing.updatedAt = now;
      await writeWebStore(contacts, memories);
      return { contact: existing, created: false };
    }

    const created: ContactRecord = {
      id: makeId("cnt"),
      name: cleanName,
      phone: input.phone?.trim() || "",
      relationship: input.relationship?.trim() || "",
      birthday: input.birthday?.trim() || "",
      notes: input.notes?.trim() || "",
      createdAt: now,
      updatedAt: now,
    };
    contacts.push(created);
    await writeWebStore(contacts, memories);
    return { contact: created, created: true };
  }

  const db = await getDb();
  let existingRow: RawContactRow | null = null;

  if (input.contactId?.trim()) {
    existingRow = await db.getFirstAsync<RawContactRow>(
      "SELECT * FROM contacts WHERE id = ?",
      [input.contactId.trim()]
    );
  }
  if (!existingRow) {
    existingRow = await db.getFirstAsync<RawContactRow>(
      "SELECT * FROM contacts WHERE LOWER(name) = LOWER(?)",
      [cleanName]
    );
  }

  if (existingRow) {
    const updatedName = cleanName || existingRow.name;
    const updatedPhone =
      input.phone !== undefined && input.phone.trim() !== ""
        ? input.phone.trim()
        : existingRow.phone || "";
    const updatedRel =
      input.relationship !== undefined && input.relationship.trim() !== ""
        ? input.relationship.trim()
        : existingRow.relationship || "";
    const updatedBday =
      input.birthday !== undefined && input.birthday.trim() !== ""
        ? input.birthday.trim()
        : existingRow.birthday || "";
    const updatedNotes =
      input.notes !== undefined && input.notes.trim() !== ""
        ? input.notes.trim()
        : existingRow.notes || "";

    await db.runAsync(
      `UPDATE contacts
       SET name = ?, phone = ?, relationship = ?, birthday = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        updatedName,
        updatedPhone,
        updatedRel,
        updatedBday,
        updatedNotes,
        now,
        existingRow.id,
      ]
    );

    await db.runAsync(
      "UPDATE memories SET contact_name = ? WHERE contact_id = ?",
      [updatedName, existingRow.id]
    );

    return {
      contact: {
        id: existingRow.id,
        name: updatedName,
        phone: updatedPhone,
        relationship: updatedRel,
        birthday: updatedBday,
        notes: updatedNotes,
        createdAt: existingRow.created_at,
        updatedAt: now,
      },
      created: false,
    };
  }

  const id = makeId("cnt");
  const phone = input.phone?.trim() || "";
  const relationship = input.relationship?.trim() || "";
  const birthday = input.birthday?.trim() || "";
  const notes = input.notes?.trim() || "";

  await db.runAsync(
    `INSERT INTO contacts (id, name, phone, relationship, birthday, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, cleanName, phone, relationship, birthday, notes, now, now]
  );

  return {
    contact: {
      id,
      name: cleanName,
      phone,
      relationship,
      birthday,
      notes,
      createdAt: now,
      updatedAt: now,
    },
    created: true,
  };
}

export async function updateContactDirect(contact: ContactRecord): Promise<void> {
  const now = Date.now();
  if (Platform.OS === "web") {
    const { contacts, memories } = await readWebStore();
    const next = contacts.map((c) =>
      c.id === contact.id ? { ...contact, updatedAt: now } : c
    );
    await writeWebStore(next, memories);
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `UPDATE contacts
     SET name = ?, phone = ?, relationship = ?, birthday = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      contact.name.trim(),
      contact.phone.trim(),
      contact.relationship.trim(),
      contact.birthday.trim(),
      contact.notes.trim(),
      now,
      contact.id,
    ]
  );
  await db.runAsync("UPDATE memories SET contact_name = ? WHERE contact_id = ?", [
    contact.name.trim(),
    contact.id,
  ]);
}

export async function deleteContactById(contactId: string): Promise<boolean> {
  if (Platform.OS === "web") {
    const { contacts, memories } = await readWebStore();
    const filteredC = contacts.filter((c) => c.id !== contactId);
    const filteredM = memories.filter((m) => m.contactId !== contactId);
    await writeWebStore(filteredC, filteredM);
    return filteredC.length < contacts.length;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM memories WHERE contact_id = ?", [contactId]);
  const res = await db.runAsync("DELETE FROM contacts WHERE id = ?", [contactId]);
  return res.changes > 0;
}

export interface SaveMemoryInput {
  contactId?: string;
  contactName?: string;
  category: MemoryCategory;
  label: string;
  detail: string;
  amount?: number | null;
  direction?: MemoryDirection;
  eventDate?: string;
}

export async function saveMemoryRecord(
  input: SaveMemoryInput
): Promise<MemoryRecord> {
  const now = Date.now();
  let resolvedContactId: string | null = input.contactId?.trim() || null;
  let resolvedContactName = input.contactName?.trim() || "";

  // Auto-resolve or create contact if contactName is provided
  if (resolvedContactId || resolvedContactName) {
    const allContacts = await getAllContacts();
    const matched =
      (resolvedContactId &&
        allContacts.find((c) => c.id === resolvedContactId)) ||
      (resolvedContactName &&
        allContacts.find(
          (c) => c.name.toLowerCase() === resolvedContactName.toLowerCase()
        ));

    if (matched) {
      resolvedContactId = matched.id;
      resolvedContactName = matched.name;
      if (input.category === "birthday" && (input.eventDate || input.detail)) {
        await upsertContact({
          contactId: matched.id,
          name: matched.name,
          birthday: input.eventDate?.trim() || input.detail.trim(),
        });
      }
    } else if (resolvedContactName) {
      const { contact } = await upsertContact({
        name: resolvedContactName,
        birthday:
          input.category === "birthday"
            ? input.eventDate?.trim() || input.detail.trim()
            : undefined,
      });
      resolvedContactId = contact.id;
      resolvedContactName = contact.name;
    }
  }

  const initialStatus: MemoryStatus =
    input.category === "ledger" || input.category === "bill"
      ? "pending"
      : "active";

  const amountVal =
    typeof input.amount === "number" && !Number.isNaN(input.amount)
      ? input.amount
      : null;

  const directionVal: MemoryDirection =
    input.direction === "payable" || input.direction === "receivable"
      ? input.direction
      : "none";

  const record: MemoryRecord = {
    id: makeId("mem"),
    contactId: resolvedContactId,
    contactName: resolvedContactName,
    category: input.category || "note",
    label: input.label.trim() || "Note",
    detail: input.detail.trim(),
    amount: amountVal,
    direction: directionVal,
    eventDate: input.eventDate?.trim() || "",
    status: initialStatus,
    createdAt: now,
    updatedAt: now,
  };

  if (Platform.OS === "web") {
    const { contacts, memories } = await readWebStore();
    memories.unshift(record);
    await writeWebStore(contacts, memories);
    return record;
  }

  const db = await getDb();
  await db.runAsync(
    `INSERT INTO memories (
      id, contact_id, contact_name, category, label, detail, amount, direction, event_date, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.contactId,
      record.contactName,
      record.category,
      record.label,
      record.detail,
      record.amount,
      record.direction,
      record.eventDate,
      record.status,
      record.createdAt,
      record.updatedAt,
    ]
  );

  return record;
}

export async function modifyMemoryRecord(params: {
  memoryId: string;
  action: "settle" | "update" | "delete";
  newAmount?: number;
  newDetail?: string;
}): Promise<{ ok: boolean; updated?: MemoryRecord }> {
  const now = Date.now();
  const { memoryId, action, newAmount, newDetail } = params;

  if (Platform.OS === "web") {
    const { contacts, memories } = await readWebStore();
    if (action === "delete") {
      const next = memories.filter((m) => m.id !== memoryId);
      await writeWebStore(contacts, next);
      return { ok: next.length < memories.length };
    }
    const target = memories.find((m) => m.id === memoryId);
    if (!target) return { ok: false };
    if (action === "settle") target.status = "settled";
    if (typeof newAmount === "number") target.amount = newAmount;
    if (newDetail?.trim()) target.detail = newDetail.trim();
    target.updatedAt = now;
    await writeWebStore(contacts, memories);
    return { ok: true, updated: target };
  }

  const db = await getDb();
  if (action === "delete") {
    const res = await db.runAsync("DELETE FROM memories WHERE id = ?", [memoryId]);
    return { ok: res.changes > 0 };
  }

  const row = await db.getFirstAsync<RawMemoryRow>(
    "SELECT * FROM memories WHERE id = ?",
    [memoryId]
  );
  if (!row) return { ok: false };

  const nextStatus: MemoryStatus =
    action === "settle" ? "settled" : (row.status as MemoryStatus);
  const nextAmount =
    typeof newAmount === "number" && !Number.isNaN(newAmount)
      ? newAmount
      : row.amount;
  const nextDetail = newDetail?.trim() ? newDetail.trim() : row.detail;

  await db.runAsync(
    "UPDATE memories SET status = ?, amount = ?, detail = ?, updated_at = ? WHERE id = ?",
    [nextStatus, nextAmount, nextDetail, now, memoryId]
  );

  return {
    ok: true,
    updated: mapMemoryRow({
      ...row,
      status: nextStatus,
      amount: nextAmount,
      detail: nextDetail,
      updated_at: now,
    }),
  };
}

export async function searchContactsAndMemories(
  query = "",
  categoryFilter = "all",
  limit = 8,
  offset = 0
) {
  const [contacts, memories] = await Promise.all([
    getAllContacts(),
    getAllMemories(true),
  ]);

  const cleanLimit = Math.max(3, Math.min(25, limit));
  const cleanOffset = Math.max(0, Math.floor(offset));
  const q = query.trim().toLowerCase();
  const cat = categoryFilter.trim().toLowerCase();

  let activePayableTotal = 0;
  let activeReceivableTotal = 0;
  for (const m of memories) {
    if (m.status === "pending" && typeof m.amount === "number") {
      if (m.direction === "payable") activePayableTotal += m.amount;
      if (m.direction === "receivable") activeReceivableTotal += m.amount;
    }
  }

  const matchesContact = (c: ContactRecord) => {
    if (!q) return true;
    const hay = `${c.name} ${c.relationship} ${c.phone} ${c.birthday} ${c.notes}`.toLowerCase();
    return (
      hay.includes(q) ||
      q.split(/\s+/).some((tok) => tok.length >= 2 && hay.includes(tok))
    );
  };

  const matchesMemory = (m: MemoryRecord) => {
    if (cat && cat !== "all" && m.category !== cat) return false;
    if (!q) return true;
    const hay = `${m.contactName} ${m.label} ${m.detail} ${m.category} ${m.eventDate}`.toLowerCase();
    return (
      hay.includes(q) ||
      q.split(/\s+/).some((tok) => tok.length >= 2 && hay.includes(tok))
    );
  };

  const matchedContacts = contacts.filter(matchesContact);
  const matchedContactIds = new Set(matchedContacts.map((c) => c.id));

  const matchedMemories = memories.filter(
    (m) =>
      (cat === "all" || !cat || m.category === cat) &&
      (matchesMemory(m) || (m.contactId && matchedContactIds.has(m.contactId)))
  );

  const pagedContacts = matchedContacts.slice(
    cleanOffset,
    cleanOffset + cleanLimit
  );
  const pagedMemories = matchedMemories.slice(
    cleanOffset,
    cleanOffset + cleanLimit
  );

  const hasMoreContacts =
    cleanOffset + pagedContacts.length < matchedContacts.length;
  const hasMoreMemories =
    cleanOffset + pagedMemories.length < matchedMemories.length;
  const hasMore = hasMoreContacts || hasMoreMemories;

  // Only include ultra-compact alias hints if query missed AND vault is small (<= 15 people)
  const compactAliases =
    q && matchedContacts.length === 0 && contacts.length > 0 && contacts.length <= 15
      ? contacts.map((c) =>
          c.relationship ? `${c.name} (${c.relationship})` : c.name
        )
      : undefined;

  return {
    vaultSummary: {
      totalSavedContacts: contacts.length,
      matchingContactsCount: matchedContacts.length,
      matchingMemoriesCount: matchedMemories.length,
      activePayableTotal,
      activeReceivableTotal,
    },
    pagination: {
      offset: cleanOffset,
      limit: cleanLimit,
      hasMore,
      nextOffset: hasMore ? cleanOffset + cleanLimit : null,
      followUpHint: hasMore
        ? `Showing ${cleanOffset + 1}–${cleanOffset + cleanLimit}. Present ONLY this batch and ask if the user wants more (offset=${cleanOffset + cleanLimit}) or wants to filter by name.`
        : undefined,
    },
    matchedContacts: pagedContacts.map((c) => ({
      id: c.id,
      name: c.name,
      ...(c.phone ? { phone: c.phone } : {}),
      ...(c.relationship ? { relationship: c.relationship } : {}),
      ...(c.birthday ? { birthday: c.birthday } : {}),
      ...(c.notes ? { notes: c.notes.slice(0, 140) } : {}),
      memories: memories
        .filter((m) => m.contactId === c.id && m.status !== "settled")
        .slice(0, 4)
        .map((m) => ({
          id: m.id,
          category: m.category,
          label: m.label,
          detail: m.detail.slice(0, 140),
          ...(m.amount !== null ? { amount: m.amount } : {}),
          ...(m.direction !== "none" ? { direction: m.direction } : {}),
          ...(m.eventDate ? { eventDate: m.eventDate } : {}),
          status: m.status,
        })),
    })),
    matchedMemories: pagedMemories.map((m) => ({
      id: m.id,
      ...(m.contactName ? { contactName: m.contactName } : {}),
      category: m.category,
      label: m.label,
      detail: m.detail.slice(0, 160),
      ...(m.amount !== null ? { amount: m.amount } : {}),
      ...(m.direction !== "none" ? { direction: m.direction } : {}),
      ...(m.eventDate ? { eventDate: m.eventDate } : {}),
      status: m.status,
    })),
    ...(compactAliases ? { savedVaultNames: compactAliases } : {}),
  };
}

export async function getContactsDashboardSummary(): Promise<{
  contactsCount: number;
  totalPayable: number;
  totalReceivable: number;
  pendingItemsCount: number;
}> {
  const [contacts, memories] = await Promise.all([
    getAllContacts(),
    getAllMemories(false),
  ]);

  let totalPayable = 0;
  let totalReceivable = 0;
  let pendingItemsCount = 0;

  for (const m of memories) {
    if (m.status === "pending") {
      pendingItemsCount++;
      if (typeof m.amount === "number") {
        if (m.direction === "payable") totalPayable += m.amount;
        if (m.direction === "receivable") totalReceivable += m.amount;
      }
    }
  }

  return {
    contactsCount: contacts.length,
    totalPayable,
    totalReceivable,
    pendingItemsCount,
  };
}
