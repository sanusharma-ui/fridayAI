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
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
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
import { colors, getAvatarPalette } from "../theme/colors";
import { useResponsive } from "../theme/responsive";
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
  const { horizontalPad, contentMaxWidth } = useResponsive();

  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [tab, setTab] = useState<TabMode>("contacts");
  const [query, setQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(
    null
  );

  // Contact Form
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(
    null
  );
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cRel, setCRel] = useState("");
  const [cBirthday, setCBirthday] = useState("");
  const [cNotes, setCNotes] = useState("");

  // Memory / Hisaab Form
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
      Alert.alert("Detail Required", "Title ya detail zaroor likhein.");
      return;
    }
    const parsedAmt = mAmount.trim() ? Number(mAmount.trim()) : null;
    await saveMemoryRecord({
      contactId: selectedContact?.id,
      contactName: selectedContact?.name,
      category: mCategory,
      label: mLabel.trim() || mCategory,
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
    Alert.alert(
      "Confirm SMS",
      `Open SMS app for ${contact.name} (${contact.phone})?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open SMS", onPress: () => void Linking.openURL(`sms:${digits}`) },
      ]
    );
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

  const responsiveContainerStyle = [
    { paddingHorizontal: horizontalPad },
    contentMaxWidth
      ? { maxWidth: contentMaxWidth, alignSelf: "center" as const, width: "100%" as const }
      : null,
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: horizontalPad }]}>
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
              <Users size={18} color={colors.sky} />
            </View>
          )}

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {showContactForm
                ? editingContact
                  ? "Edit Contact"
                  : "New Contact"
                : showMemoryForm
                ? "Add Note or Hisaab"
                : selectedContact
                ? selectedContact.name
                : "Contacts & Vault"}
            </Text>
            <Text style={styles.headerSub}>Stored privately on your phone</Text>
          </View>

          <Pressable onPress={onClose} style={styles.iconBtn}>
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* SUBVIEW 1: CONTACT FORM */}
        {showContactForm ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.formScroll, ...responsiveContainerStyle]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput
              value={cName}
              onChangeText={setCName}
              placeholder="Rahul, Mummy, Sharma ji…"
              placeholderTextColor={colors.subtle}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Phone number</Text>
            <TextInput
              value={cPhone}
              onChangeText={setCPhone}
              placeholder="+91 9876543210"
              placeholderTextColor={colors.subtle}
              keyboardType="phone-pad"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Relationship or tag</Text>
            <TextInput
              value={cRel}
              onChangeText={setCRel}
              placeholder="Mother, Friend, Landlord…"
              placeholderTextColor={colors.subtle}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Birthday</Text>
            <TextInput
              value={cBirthday}
              onChangeText={setCBirthday}
              placeholder="14 May or 1998-05-14"
              placeholderTextColor={colors.subtle}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              value={cNotes}
              onChangeText={setCNotes}
              placeholder="Anything helpful to remember…"
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
          /* SUBVIEW 2: MEMORY / HISAAB FORM */
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.formScroll, ...responsiveContainerStyle]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.pillRow}>
              {(
                [
                  { id: "ledger", label: "Hisaab / Money" },
                  { id: "bill", label: "Bill" },
                  { id: "birthday", label: "Birthday" },
                  { id: "note", label: "Note" },
                  { id: "custom", label: "Custom" },
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

            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              value={mLabel}
              onChangeText={setMLabel}
              placeholder="Electricity Bill, Udhaar, UPI ID…"
              placeholderTextColor={colors.subtle}
              style={styles.input}
            />

            {(mCategory === "ledger" || mCategory === "bill") && (
              <>
                <Text style={styles.fieldLabel}>Amount (₹)</Text>
                <TextInput
                  value={mAmount}
                  onChangeText={setMAmount}
                  placeholder="500"
                  placeholderTextColor={colors.subtle}
                  keyboardType="numeric"
                  style={styles.input}
                />

                <Text style={styles.fieldLabel}>Who owes whom?</Text>
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
                      Mujhe Dene Hain
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMDirection("receivable")}
                    style={[
                      styles.catChip,
                      mDirection === "receivable" && styles.catChipEmerald,
                    ]}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        mDirection === "receivable" && { color: colors.sage },
                      ]}
                    >
                      Mujhe Lene Hain
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>Date / Reminder (optional)</Text>
            <TextInput
              value={mDate}
              onChangeText={setMDate}
              placeholder="14 May, 5th of month…"
              placeholderTextColor={colors.subtle}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Details *</Text>
            <TextInput
              value={mDetail}
              onChangeText={setMDetail}
              placeholder="Write full note…"
              placeholderTextColor={colors.subtle}
              multiline
              style={[styles.input, styles.textArea]}
            />

            <Pressable onPress={handleSaveMemory} style={styles.primaryBtn}>
              <Check size={17} color={colors.ctaText} />
              <Text style={styles.primaryBtnText}>Save Entry</Text>
            </Pressable>
          </ScrollView>
        ) : selectedContact ? (
          /* SUBVIEW 3: SINGLE CONTACT PROFILE */
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.detailScroll, ...responsiveContainerStyle]}
          >
            {(() => {
              const pal = getAvatarPalette(selectedContact.name);
              return (
                <View style={styles.profileCard}>
                  <View style={styles.profileTop}>
                    <View
                      style={[
                        styles.avatarCircle,
                        { backgroundColor: pal.bg, borderColor: pal.border },
                      ]}
                    >
                      <Text style={[styles.avatarInitial, { color: pal.text }]}>
                        {selectedContact.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.profileInfo}>
                      <Text style={styles.profileName}>
                        {selectedContact.name}
                      </Text>
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
                      <Cake size={15} color={colors.warning} />
                      <Text style={styles.metaText}>
                        Birthday · {selectedContact.birthday}
                      </Text>
                    </View>
                  ) : null}

                  {selectedContact.notes ? (
                    <View style={styles.metaRow}>
                      <StickyNote size={15} color={colors.sky} />
                      <Text style={styles.metaText}>
                        {selectedContact.notes}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.profileActionRow}>
                    <Pressable
                      onPress={() => confirmCallContact(selectedContact)}
                      style={[styles.profileActionBtn, styles.callBtnTint]}
                    >
                      <PhoneCall size={15} color={colors.sage} />
                      <Text
                        style={[
                          styles.profileActionText,
                          { color: colors.sage },
                        ]}
                      >
                        Call
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => confirmSmsContact(selectedContact)}
                      style={[styles.profileActionBtn, styles.smsBtnTint]}
                    >
                      <MessageSquareText size={15} color={colors.sky} />
                      <Text
                        style={[styles.profileActionText, { color: colors.sky }]}
                      >
                        SMS
                      </Text>
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
                      style={styles.profileDeleteBtn}
                    >
                      <Trash2 size={15} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              );
            })()}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>
                Memories & Hisaab ({contactMemories.length})
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
                  No memories or balances for {selectedContact.name} yet. Tap
                  &quot;Add Info&quot; or just tell Friday in chat!
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
          /* SUBVIEW 4: MAIN DASHBOARD */
          <View style={styles.flex}>
            <View style={responsiveContainerStyle}>
              {/* 3 Colorful Metric Cards */}
              <View style={styles.summaryRow}>
                <View style={[styles.summaryBox, styles.summarySky]}>
                  <View style={styles.summaryTopRow}>
                    <Users size={13} color={colors.sky} />
                    <Text style={[styles.summaryLabel, { color: colors.sky }]}>
                      People
                    </Text>
                  </View>
                  <Text style={styles.summaryValue}>{contacts.length}</Text>
                </View>

                <View style={[styles.summaryBox, styles.summaryDanger]}>
                  <View style={styles.summaryTopRow}>
                    <ArrowUpRight size={13} color={colors.danger} />
                    <Text
                      style={[styles.summaryLabel, { color: colors.danger }]}
                    >
                      To Pay
                    </Text>
                  </View>
                  <Text style={[styles.summaryValue, { color: colors.danger }]}>
                    ₹{pendingPayable}
                  </Text>
                </View>

                <View style={[styles.summaryBox, styles.summaryEmerald]}>
                  <View style={styles.summaryTopRow}>
                    <ArrowDownLeft size={13} color={colors.sage} />
                    <Text style={[styles.summaryLabel, { color: colors.sage }]}>
                      To Collect
                    </Text>
                  </View>
                  <Text style={[styles.summaryValue, { color: colors.sage }]}>
                    ₹{pendingReceivable}
                  </Text>
                </View>
              </View>

              {/* Search + Add */}
              <View style={styles.searchBarRow}>
                <View style={styles.searchInputWrap}>
                  <Search size={15} color={colors.muted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search people, bills, birthdays…"
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
                  <UserPlus size={15} color={colors.ctaText} />
                  <Text style={styles.addMainBtnText}>New</Text>
                </Pressable>
              </View>

              {/* Segmented Pill Tabs */}
              <View style={styles.tabsSegment}>
                {(
                  [
                    { id: "contacts", label: `Contacts (${contacts.length})` },
                    { id: "ledger", label: "Hisaab" },
                    { id: "memories", label: `Notes (${memories.length})` },
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
            </View>

            <ScrollView
              style={styles.flex}
              contentContainerStyle={[styles.listScroll, ...responsiveContainerStyle]}
            >
              {tab === "contacts" ? (
                filteredContacts.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No contacts yet</Text>
                    <Text style={styles.emptyText}>
                      Tap &quot;New&quot; above, or simply tell Friday in chat:{"\n"}
                      &quot;Rahul ka number 9876543210 save kar lo&quot;
                    </Text>
                  </View>
                ) : (
                  filteredContacts.map((c) => {
                    const pal = getAvatarPalette(c.name);
                    const cMems = memories.filter(
                      (m) => m.contactId === c.id && m.status !== "settled"
                    );
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setSelectedContact(c)}
                        style={({ pressed }) => [
                          styles.contactCard,
                          pressed && { backgroundColor: colors.surfaceElevated },
                        ]}
                      >
                        <View
                          style={[
                            styles.avatarSmall,
                            { backgroundColor: pal.bg, borderColor: pal.border },
                          ]}
                        >
                          <Text
                            style={[styles.avatarSmallText, { color: pal.text }]}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.contactCardBody}>
                          <View style={styles.contactCardNameRow}>
                            <Text style={styles.contactCardName}>{c.name}</Text>
                            {c.relationship ? (
                              <Text style={styles.relPill}>
                                {c.relationship}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={styles.contactCardSub} numberOfLines={1}>
                            {c.phone || "No phone"}
                            {c.birthday ? ` · 🎂 ${c.birthday}` : ""}
                            {cMems.length > 0 ? ` · ${cMems.length} saved` : ""}
                          </Text>
                        </View>
                        <ChevronRight size={16} color={colors.subtle} />
                      </Pressable>
                    );
                  })
                )
              ) : filteredMemories.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nothing saved here yet</Text>
                  <Text style={styles.emptyText}>
                    Tell Friday things like &quot;Sharma ji ko 500 dene hain&quot; or
                    &quot;Mummy ka birthday 14 May ko hai&quot; and they show up here.
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

  const catColor =
    memory.category === "birthday"
      ? colors.warning
      : memory.category === "ledger" || memory.category === "bill"
      ? colors.accent
      : colors.sky;

  const catBg =
    memory.category === "birthday"
      ? colors.warningBg
      : memory.category === "ledger" || memory.category === "bill"
      ? colors.accentSoft
      : colors.skySoft;

  return (
    <View style={[styles.memCard, isSettled && styles.memCardSettled]}>
      <View style={styles.memTopRow}>
        <View style={styles.memTagWrap}>
          <Text
            style={[
              styles.memCatTag,
              { color: catColor, backgroundColor: catBg },
            ]}
          >
            {memory.category}
          </Text>
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
                ? "to pay"
                : memory.direction === "receivable"
                ? "to collect"
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
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSubtle,
    gap: 12,
  },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.skySoft,
    borderWidth: 1,
    borderColor: colors.skyBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  headerSub: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12,
  },
  summaryBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 11,
    gap: 4,
  },
  summarySky: {
    backgroundColor: colors.skySoft,
    borderColor: colors.skyBorder,
  },
  summaryDanger: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  summaryEmerald: {
    backgroundColor: colors.sageSoft,
    borderColor: colors.sageBorder,
  },
  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
  },
  searchInputWrap: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13.5,
  },
  addMainBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.ctaBg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addMainBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ctaText,
  },
  tabsSegment: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: colors.surfaceElevated,
  },
  tabBtnText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
  },
  tabBtnTextActive: {
    color: colors.text,
    fontWeight: "700",
  },
  listScroll: {
    paddingBottom: 28,
    gap: 8,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  avatarSmall: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSmallText: {
    fontSize: 16,
    fontWeight: "800",
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
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  relPill: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.sky,
    backgroundColor: colors.skySoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  contactCardSub: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  emptyCard: {
    padding: 20,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 6,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  detailScroll: {
    paddingTop: 14,
    paddingBottom: 32,
    gap: 12,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: 16,
    gap: 12,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 21,
    fontWeight: "800",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
  },
  profileRel: {
    fontSize: 12.5,
    color: colors.sky,
    fontWeight: "600",
    marginTop: 1,
  },
  profilePhone: {
    fontSize: 13.5,
    color: colors.muted,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.sidebar,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
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
    height: 40,
    borderRadius: 11,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  callBtnTint: {
    backgroundColor: colors.sageSoft,
    borderColor: colors.sageBorder,
  },
  smsBtnTint: {
    backgroundColor: colors.skySoft,
    borderColor: colors.skyBorder,
  },
  profileDeleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  profileActionText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.text,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  smallAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: colors.ctaBg,
  },
  smallAddBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ctaText,
  },
  memCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 13,
    gap: 5,
  },
  memCardSettled: {
    opacity: 0.62,
  },
  memTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memTagWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  memCatTag: {
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "capitalize",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  memContactTag: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
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
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.text,
  },
  memDetail: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18.5,
  },
  memDate: {
    fontSize: 12,
    color: colors.warning,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.sageSoft,
    borderWidth: 1,
    borderColor: colors.sageBorder,
  },
  settleBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.sage,
  },
  settledLabel: {
    fontSize: 11.5,
    color: colors.sage,
    fontWeight: "700",
  },
  deleteMemBtn: {
    marginLeft: "auto",
    padding: 4,
  },
  formScroll: {
    paddingTop: 16,
    paddingBottom: 34,
    gap: 10,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: 6,
  },
  input: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 14,
  },
  textArea: {
    height: 92,
    paddingTop: 11,
    textAlignVertical: "top",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  catChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  catChipEmerald: {
    backgroundColor: colors.sageSoft,
    borderColor: colors.sageBorder,
  },
  catChipDanger: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  catChipText: {
    fontSize: 12.5,
    color: colors.muted,
    fontWeight: "600",
  },
  catChipTextActive: {
    color: colors.accent,
    fontWeight: "700",
  },
  primaryBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.ctaBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.ctaText,
  },
});
