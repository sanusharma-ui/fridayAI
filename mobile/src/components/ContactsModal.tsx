import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Cake,
  Check,
  ChevronRight,
  IndianRupee,
  MessageSquareText,
  Pencil,
  PhoneCall,
  Plus,
  Search,
  StickyNote,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";
import {
  deleteContactById,
  getAllContacts,
  getAllMemories,
  modifyMemoryRecord,
  saveMemoryRecord,
  updateContactDirect,
  upsertContact,
} from "../services/contactsDb";
import { colors } from "../theme/colors";
import type {
  ContactRecord,
  MemoryCategory,
  MemoryDirection,
  MemoryRecord,
} from "../types";

interface ContactsModalProps {
  visible: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

type TabMode = "contacts" | "ledger" | "memories";

export function ContactsModal({
  visible,
  onClose,
  onDataChanged,
}: ContactsModalProps) {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [tab, setTab] = useState<TabMode>("contacts");
  const [query, setQuery] = useState("");

  // Selected contact detail view
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(
    null
  );

  // Add / Edit Contact form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(
    null
  );
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cRel, setCRel] = useState("");
  const [cBirthday, setCBirthday] = useState("");
  const [cNotes, setCNotes] = useState("");

  // Add Memory / Hisaab form state
  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const [mCategory, setMCategory] = useState<MemoryCategory>("ledger");
  const [mLabel, setMLabel] = useState("");
  const [mDetail, setMDetail] = useState("");
  const [mAmount, setMAmount] = useState("");
  const [mDirection, setMDirection] = useState<MemoryDirection>("payable");
  const [mDate, setMDate] = useState("");

  const reloadData = useCallback(async () => {
    const [cList, mList] = await Promise.all([
      getAllContacts(),
      getAllMemories(true),
    ]);
    setContacts(cList);
    setMemories(mList);
    setSelectedContact((prev) =>
      prev ? cList.find((c) => c.id === prev.id) || null : null
    );
  }, []);

  useEffect(() => {
    if (visible) {
      void reloadData();
    } else {
      setShowContactForm(false);
      setShowMemoryForm(false);
      setSelectedContact(null);
    }
  }, [visible, reloadData]);

  // Summary calculations
  const pendingPayable = memories
    .filter((m) => m.status === "pending" && m.direction === "payable")
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  const pendingReceivable = memories
    .filter((m) => m.status === "pending" && m.direction === "receivable")
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  function openNewContactForm() {
    setEditingContact(null);
    setCName("");
    setCPhone("");
    setCRel("");
    setCBirthday("");
    setCNotes("");
    setShowContactForm(true);
  }

  function openEditContactForm(contact: ContactRecord) {
    setEditingContact(contact);
    setCName(contact.name);
    setCPhone(contact.phone);
    setCRel(contact.relationship);
    setCBirthday(contact.birthday);
    setCNotes(contact.notes);
    setShowContactForm(true);
  }

  async function handleSaveContact() {
    if (!cName.trim()) {
      Alert.alert("Name Required", "Contact ka naam likhna zaroori hai.");
      return;
    }
    if (editingContact) {
      await updateContactDirect({
        ...editingContact,
        name: cName.trim(),
        phone: cPhone.trim(),
        relationship: cRel.trim(),
        birthday: cBirthday.trim(),
        notes: cNotes.trim(),
      });
    } else {
      await upsertContact({
        name: cName.trim(),
        phone: cPhone.trim(),
        relationship: cRel.trim(),
        birthday: cBirthday.trim(),
        notes: cNotes.trim(),
      });
    }
    setShowContactForm(false);
    await reloadData();
    onDataChanged?.();
  }

  function confirmDeleteContact(contact: ContactRecord) {
    const runDelete = async () => {
      await deleteContactById(contact.id);
      setSelectedContact(null);
      await reloadData();
      onDataChanged?.();
    };
    if (Platform.OS === "web") {
      void runDelete();
      return;
    }
    Alert.alert(
      "Delete Contact",
      `Delete "${contact.name}" and all their saved info?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void runDelete() },
      ]
    );
  }

  function openNewMemoryForm(defaultCat: MemoryCategory = "ledger") {
    setMCategory(defaultCat);
    setMLabel("");
    setMDetail("");
    setMAmount("");
    setMDirection("payable");
    setMDate("");
    setShowMemoryForm(true);
  }

  async function handleSaveMemory() {
    if (!mLabel.trim() && !mDetail.trim()) {
      Alert.alert("Detail Required", "Label ya detail zaroor likhein.");
      return;
    }
    const parsedAmt = mAmount.trim() ? Number(mAmount.trim()) : null;
    await saveMemoryRecord({
      contactId: selectedContact?.id,
      contactName: selectedContact?.name,
      category: mCategory,
      label: mLabel.trim() || mCategory.toUpperCase(),
      detail: mDetail.trim() || mLabel.trim(),
      amount: parsedAmt !== null && !Number.isNaN(parsedAmt) ? parsedAmt : null,
      direction:
        mCategory === "ledger" || mCategory === "bill" ? mDirection : "none",
      eventDate: mDate.trim(),
    });
    setShowMemoryForm(false);
    await reloadData();
    onDataChanged?.();
  }

  async function handleSettleMemory(memoryId: string) {
    await modifyMemoryRecord({ memoryId, action: "settle" });
    await reloadData();
    onDataChanged?.();
  }

  async function handleDeleteMemory(memoryId: string) {
    await modifyMemoryRecord({ memoryId, action: "delete" });
    await reloadData();
    onDataChanged?.();
  }

  function confirmCallContact(contact: ContactRecord) {
    if (!contact.phone.trim()) {
      Alert.alert("No Phone Number", "Is contact ka phone number save nahi hai.");
      return;
    }
    const digits = contact.phone.replace(/[^\d+]/g, "");
    if (Platform.OS === "web") {
      void Linking.openURL(`tel:${digits}`);
      return;
    }
    Alert.alert(
      "Confirm Phone Call",
      `Call ${contact.name} (${contact.phone})?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Call", onPress: () => void Linking.openURL(`tel:${digits}`) },
      ]
    );
  }

  function confirmSmsContact(contact: ContactRecord) {
    if (!contact.phone.trim()) {
      Alert.alert("No Phone Number", "Is contact ka phone number save nahi hai.");
      return;
    }
    const digits = contact.phone.replace(/[^\d+]/g, "");
    if (Platform.OS === "web") {
      void Linking.openURL(`sms:${digits}`);
      return;
    }
    Alert.alert("Confirm SMS", `Open SMS app for ${contact.name} (${contact.phone})?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Open SMS", onPress: () => void Linking.openURL(`sms:${digits}`) },
    ]);
  }

  const qLower = query.trim().toLowerCase();
  const filteredContacts = contacts.filter((c) => {
    if (!qLower) return true;
    return `${c.name} ${c.phone} ${c.relationship} ${c.birthday} ${c.notes}`
      .toLowerCase()
      .includes(qLower);
  });

  const filteredMemories = memories.filter((m) => {
    if (tab === "ledger" && m.category !== "ledger" && m.category !== "bill") {
      return false;
    }
    if (!qLower) return true;
    return `${m.contactName} ${m.label} ${m.detail} ${m.eventDate}`
      .toLowerCase()
      .includes(qLower);
  });

  const contactMemories = selectedContact
    ? memories.filter((m) => m.contactId === selectedContact.id)
    : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          {selectedContact || showContactForm || showMemoryForm ? (
            <Pressable
              onPress={() => {
                if (showMemoryForm) setShowMemoryForm(false);
                else if (showContactForm) setShowContactForm(false);
                else setSelectedContact(null);
              }}
              style={styles.iconBtn}
            >
              <ArrowLeft size={20} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.headerIconBadge}>
              <Users size={18} color={colors.accent} />
            </View>
          )}

          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>LOCAL SQLITE VAULT</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {showContactForm
                ? editingContact
                  ? "Edit Contact"
                  : "New Contact"
                : showMemoryForm
                ? "Add Info / Hisaab"
                : selectedContact
                ? selectedContact.name
                : "Contacts & Memories"}
            </Text>
          </View>

          <Pressable onPress={onClose} style={styles.iconBtn}>
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* SUBVIEW 1: ADD / EDIT CONTACT FORM */}
        {showContactForm ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.formScroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>NAME *</Text>
            <TextInput
              value={cName}
              onChangeText={setCName}
              placeholder="e.g. Rahul, Mummy, Sharma ji"
              placeholderTextColor={colors.subtle}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
            <TextInput
              value={cPhone}
              onChangeText={setCPhone}
              placeholder="e.g. +91 9876543210"
              placeholderTextColor={colors.subtle}
              keyboardType="phone-pad"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>RELATIONSHIP / TAG</Text>
            <TextInput
              value={cRel}
              onChangeText={setCRel}
              placeholder="e.g. Mother, Friend, Landlord, Shopkeeper"
              placeholderTextColor={colors.subtle}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>BIRTHDAY</Text>
            <TextInput
              value={cBirthday}
              onChangeText={setCBirthday}
              placeholder="e.g. 14 May or 1998-05-14"
              placeholderTextColor={colors.subtle}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>NOTES / EXTRA INFO</Text>
            <TextInput
              value={cNotes}
              onChangeText={setCNotes}
              placeholder="Any general note about this contact…"
              placeholderTextColor={colors.subtle}
              multiline
              style={[styles.input, styles.textArea]}
            />

            <Pressable onPress={handleSaveContact} style={styles.primaryBtn}>
              <Check size={17} color={colors.ctaText} />
              <Text style={styles.primaryBtnText}>Save Contact</Text>
            </Pressable>
          </ScrollView>
        ) : showMemoryForm ? (
          /* SUBVIEW 2: ADD MEMORY / HISAAB FORM */
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.formScroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>CATEGORY</Text>
            <View style={styles.pillRow}>
              {(
                [
                  { id: "ledger", label: "Hisaab / Money" },
                  { id: "bill", label: "Pending Bill" },
                  { id: "birthday", label: "Birthday / Date" },
                  { id: "note", label: "Note" },
                  { id: "custom", label: "Custom Info" },
                ] as const
              ).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setMCategory(item.id)}
                  style={[
                    styles.catChip,
                    mCategory === item.id && styles.catChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      mCategory === item.id && styles.catChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>TITLE / LABEL *</Text>
            <TextInput
              value={mLabel}
              onChangeText={setMLabel}
              placeholder="e.g. Udhaar, Electricity Bill, UPI ID, Shirt Size"
              placeholderTextColor={colors.subtle}
              style={styles.input}
            />

            {(mCategory === "ledger" || mCategory === "bill") && (
              <>
                <Text style={styles.fieldLabel}>AMOUNT (₹)</Text>
                <TextInput
                  value={mAmount}
                  onChangeText={setMAmount}
                  placeholder="e.g. 500"
                  placeholderTextColor={colors.subtle}
                  keyboardType="numeric"
                  style={styles.input}
                />

                <Text style={styles.fieldLabel}>PAYMENT DIRECTION</Text>
                <View style={styles.pillRow}>
                  <Pressable
                    onPress={() => setMDirection("payable")}
                    style={[
                      styles.catChip,
                      mDirection === "payable" && styles.catChipDanger,
                    ]}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        mDirection === "payable" && { color: colors.danger },
                      ]}
                    >
                      Mujhe Dene Hain (Payable)
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMDirection("receivable")}
                    style={[
                      styles.catChip,
                      mDirection === "receivable" && styles.catChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        mDirection === "receivable" && { color: colors.sage },
                      ]}
                    >
                      Mujhe Lene Hain (Receivable)
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>DATE / DUE DATE (OPTIONAL)</Text>
            <TextInput
              value={mDate}
              onChangeText={setMDate}
              placeholder="e.g. 14 May, 5th of month, 2026-12-10"
              placeholderTextColor={colors.subtle}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>DETAIL / NOTE *</Text>
            <TextInput
              value={mDetail}
              onChangeText={setMDetail}
              placeholder="Write full detail…"
              placeholderTextColor={colors.subtle}
              multiline
              style={[styles.input, styles.textArea]}
            />

            <Pressable onPress={handleSaveMemory} style={styles.primaryBtn}>
              <Check size={17} color={colors.ctaText} />
              <Text style={styles.primaryBtnText}>Save Info</Text>
            </Pressable>
          </ScrollView>
        ) : selectedContact ? (
          /* SUBVIEW 3: SINGLE CONTACT PROFILE & MEMORIES */
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.detailScroll}
          >
            <View style={styles.profileCard}>
              <View style={styles.profileTop}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>
                    {selectedContact.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{selectedContact.name}</Text>
                  {selectedContact.relationship ? (
                    <Text style={styles.profileRel}>
                      {selectedContact.relationship}
                    </Text>
                  ) : null}
                  <Text style={styles.profilePhone}>
                    {selectedContact.phone || "No phone number saved"}
                  </Text>
                </View>
              </View>

              {selectedContact.birthday ? (
                <View style={styles.metaRow}>
                  <Cake size={14} color={colors.accent} />
                  <Text style={styles.metaText}>
                    Birthday: {selectedContact.birthday}
                  </Text>
                </View>
              ) : null}

              {selectedContact.notes ? (
                <View style={styles.metaRow}>
                  <StickyNote size={14} color={colors.sage} />
                  <Text style={styles.metaText}>{selectedContact.notes}</Text>
                </View>
              ) : null}

              <View style={styles.profileActionRow}>
                <Pressable
                  onPress={() => confirmCallContact(selectedContact)}
                  style={styles.profileActionBtn}
                >
                  <PhoneCall size={15} color={colors.sage} />
                  <Text style={styles.profileActionText}>Call</Text>
                </Pressable>

                <Pressable
                  onPress={() => confirmSmsContact(selectedContact)}
                  style={styles.profileActionBtn}
                >
                  <MessageSquareText size={15} color={colors.accent} />
                  <Text style={styles.profileActionText}>SMS</Text>
                </Pressable>

                <Pressable
                  onPress={() => openEditContactForm(selectedContact)}
                  style={styles.profileActionBtn}
                >
                  <Pencil size={15} color={colors.textSecondary} />
                  <Text style={styles.profileActionText}>Edit</Text>
                </Pressable>

                <Pressable
                  onPress={() => confirmDeleteContact(selectedContact)}
                  style={styles.profileActionBtn}
                >
                  <Trash2 size={15} color={colors.danger} />
                </Pressable>
              </View>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderLabel}>
                SAVED INFO, HISAAB & MEMORIES ({contactMemories.length})
              </Text>
              <Pressable
                onPress={() => openNewMemoryForm("ledger")}
                style={styles.smallAddBtn}
              >
                <Plus size={14} color={colors.ctaText} />
                <Text style={styles.smallAddBtnText}>Add Info</Text>
              </Pressable>
            </View>

            {contactMemories.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No extra memories or hisaab saved for {selectedContact.name} yet.
                  Add here or simply tell Friday in chat!
                </Text>
              </View>
            ) : (
              contactMemories.map((m) => (
                <MemoryItemCard
                  key={m.id}
                  memory={m}
                  hideContactName
                  onSettle={() => void handleSettleMemory(m.id)}
                  onDelete={() => void handleDeleteMemory(m.id)}
                />
              ))
            )}
          </ScrollView>
        ) : (
          /* SUBVIEW 4: MAIN CONTACTS & MEMORIES DASHBOARD */
          <View style={styles.flex}>
            {/* Summary Strip */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>CONTACTS</Text>
                <Text style={styles.summaryValue}>{contacts.length}</Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>DENE HAIN</Text>
                <Text style={[styles.summaryValue, { color: colors.danger }]}>
                  ₹{pendingPayable}
                </Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>LENE HAIN</Text>
                <Text style={[styles.summaryValue, { color: colors.sage }]}>
                  ₹{pendingReceivable}
                </Text>
              </View>
            </View>

            {/* Search + Add Buttons */}
            <View style={styles.searchBarRow}>
              <View style={styles.searchInputWrap}>
                <Search size={15} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search contacts, bills, birthdays…"
                  placeholderTextColor={colors.subtle}
                  style={styles.searchInput}
                />
                {query ? (
                  <Pressable onPress={() => setQuery("")}>
                    <X size={14} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                onPress={() =>
                  tab === "contacts"
                    ? openNewContactForm()
                    : openNewMemoryForm("ledger")
                }
                style={styles.addMainBtn}
              >
                <UserPlus size={16} color={colors.ctaText} />
                <Text style={styles.addMainBtnText}>Add</Text>
              </Pressable>
            </View>

            {/* Tabs */}
            <View style={styles.tabsRow}>
              {(
                [
                  { id: "contacts", label: `Contacts (${contacts.length})` },
                  { id: "ledger", label: "Hisaab & Bills" },
                  { id: "memories", label: `All Info (${memories.length})` },
                ] as const
              ).map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setTab(t.id)}
                  style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      tab === t.id && styles.tabBtnTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.listScroll}
            >
              {tab === "contacts" ? (
                filteredContacts.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No contacts saved yet</Text>
                    <Text style={styles.emptyText}>
                      Tap &quot;Add&quot; above OR simply write in Friday chat:{"\n"}
                      &quot;Rahul ka number 9876543210 save kar lo&quot; or &quot;Sharma ji ko 500 dene hain&quot;
                    </Text>
                  </View>
                ) : (
                  filteredContacts.map((c) => {
                    const cMems = memories.filter(
                      (m) => m.contactId === c.id && m.status !== "settled"
                    );
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setSelectedContact(c)}
                        style={styles.contactCard}
                      >
                        <View style={styles.avatarSmall}>
                          <Text style={styles.avatarSmallText}>
                            {c.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.contactCardBody}>
                          <View style={styles.contactCardNameRow}>
                            <Text style={styles.contactCardName}>{c.name}</Text>
                            {c.relationship ? (
                              <Text style={styles.relPill}>{c.relationship}</Text>
                            ) : null}
                          </View>
                          <Text style={styles.contactCardSub}>
                            {c.phone || "No phone"}
                            {c.birthday ? ` · 🎂 ${c.birthday}` : ""}
                            {cMems.length > 0 ? ` · ${cMems.length} info` : ""}
                          </Text>
                        </View>
                        <ChevronRight size={16} color={colors.subtle} />
                      </Pressable>
                    );
                  })
                )
              ) : filteredMemories.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No records found</Text>
                  <Text style={styles.emptyText}>
                    Tell Friday things like &quot;Sharma ji ko 500 rupaye dene hain&quot; or &quot;Mummy ka birthday 14 May ko hai&quot; and they will appear here automatically.
                  </Text>
                </View>
              ) : (
                filteredMemories.map((m) => (
                  <MemoryItemCard
                    key={m.id}
                    memory={m}
                    onSettle={() => void handleSettleMemory(m.id)}
                    onDelete={() => void handleDeleteMemory(m.id)}
                  />
                ))
              )}
            </ScrollView>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function MemoryItemCard({
  memory,
  hideContactName,
  onSettle,
  onDelete,
}: {
  memory: MemoryRecord;
  hideContactName?: boolean;
  onSettle: () => void;
  onDelete: () => void;
}) {
  const isSettled = memory.status === "settled";
  const isLedgerOrBill =
    memory.category === "ledger" || memory.category === "bill";

  return (
    <View style={[styles.memCard, isSettled && styles.memCardSettled]}>
      <View style={styles.memTopRow}>
        <View style={styles.memTagWrap}>
          <Text style={styles.memCatTag}>{memory.category.toUpperCase()}</Text>
          {!hideContactName && memory.contactName ? (
            <Text style={styles.memContactTag}>{memory.contactName}</Text>
          ) : null}
        </View>

        {typeof memory.amount === "number" && (
          <View style={styles.amountWrap}>
            <IndianRupee
              size={12}
              color={
                isSettled
                  ? colors.muted
                  : memory.direction === "payable"
                  ? colors.danger
                  : colors.sage
              }
            />
            <Text
              style={[
                styles.amountText,
                {
                  color: isSettled
                    ? colors.muted
                    : memory.direction === "payable"
                    ? colors.danger
                    : colors.sage,
                },
                isSettled && { textDecorationLine: "line-through" },
              ]}
            >
              {memory.amount}{" "}
              {memory.direction === "payable"
                ? "(Dene)"
                : memory.direction === "receivable"
                ? "(Lene)"
                : ""}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.memLabel}>{memory.label}</Text>
      <Text style={styles.memDetail}>{memory.detail}</Text>

      {memory.eventDate ? (
        <Text style={styles.memDate}>📅 {memory.eventDate}</Text>
      ) : null}

      <View style={styles.memActions}>
        {isLedgerOrBill && !isSettled && (
          <Pressable onPress={onSettle} style={styles.settleBtn}>
            <Check size={12} color={colors.sage} />
            <Text style={styles.settleBtnText}>Mark Settled</Text>
          </Pressable>
        )}
        {isSettled && <Text style={styles.settledLabel}>✓ Settled</Text>}
        <Pressable
          onPress={onDelete}
          style={styles.deleteMemBtn}
          hitSlop={6}
        >
          <Trash2 size={13} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 12,
  },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.accent,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginTop: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    paddingHorizontal: 11,
  },
  summaryLabel: {
    fontSize: 9,
    letterSpacing: 1.1,
    color: colors.subtle,
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 3,
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  searchInputWrap: {
    flex: 1,
    height: 41,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  addMainBtn: {
    height: 41,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: colors.ctaBg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addMainBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.ctaText,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabBtnActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.accentBorder,
  },
  tabBtnText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  tabBtnTextActive: {
    color: colors.accent,
    fontWeight: "700",
  },
  listScroll: {
    paddingHorizontal: 14,
    paddingBottom: 28,
    gap: 8,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  avatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSmallText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accent,
  },
  contactCardBody: {
    flex: 1,
  },
  contactCardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  contactCardName: {
    fontSize: 14.5,
    fontWeight: "600",
    color: colors.text,
  },
  relPill: {
    fontSize: 10,
    color: colors.sage,
    backgroundColor: colors.sageSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  contactCardSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  emptyCard: {
    padding: 20,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 8,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: colors.text,
  },
  emptyText: {
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.muted,
  },
  detailScroll: {
    padding: 14,
    paddingBottom: 32,
    gap: 12,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: 15,
    gap: 11,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.accent,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  profileRel: {
    fontSize: 12,
    color: colors.sage,
    marginTop: 1,
  },
  profilePhone: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.sidebar,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  metaText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  profileActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  profileActionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  profileActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sectionHeaderLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.subtle,
  },
  smallAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.ctaBg,
  },
  smallAddBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.ctaText,
  },
  memCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 5,
  },
  memCardSettled: {
    opacity: 0.65,
  },
  memTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memTagWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  memCatTag: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  memContactTag: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.sage,
  },
  amountWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  amountText: {
    fontSize: 13,
    fontWeight: "700",
  },
  memLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  memDetail: {
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  memDate: {
    fontSize: 11.5,
    color: colors.accent,
    marginTop: 2,
  },
  memActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  settleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: colors.sageSoft,
    borderWidth: 1,
    borderColor: colors.sageBorder,
  },
  settleBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.sage,
  },
  settledLabel: {
    fontSize: 11,
    color: colors.sage,
    fontWeight: "600",
  },
  deleteMemBtn: {
    marginLeft: "auto",
    padding: 4,
  },
  formScroll: {
    padding: 16,
    paddingBottom: 34,
    gap: 10,
  },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 6,
  },
  input: {
    height: 45,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 13.5,
  },
  textArea: {
    height: 90,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  catChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  catChipActive: {
    backgroundColor: colors.sageSoft,
    borderColor: colors.sageBorder,
  },
  catChipDanger: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  catChipText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  catChipTextActive: {
    color: colors.sage,
    fontWeight: "700",
  },
  primaryBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: 11,
    backgroundColor: colors.ctaBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ctaText,
  },
});
