import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CalendarPlus,
  Check,
  IndianRupee,
  MessageCircle,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react-native";
import { upsertContact } from "../services/contactsDb";
import {
  formatWhatsAppPhone,
  saveContactToDevicePhonebook,
} from "../services/deviceContacts";
import {
  createPhoneCalendarEvent,
  formatReadableDateTime,
} from "../services/deviceSchedule";
import { colors } from "../theme/colors";
import type { PendingDeviceAction } from "../types";

interface ActionConfirmCardProps {
  action: PendingDeviceAction;
  onUpdateAction: (
    actionId: string,
    patch: Partial<PendingDeviceAction>
  ) => void;
  onDataChanged?: () => void;
}

const WHATSAPP_GREEN = "#25D366";
const WHATSAPP_SOFT = "rgba(37, 211, 102, 0.14)";
const WHATSAPP_BORDER = "rgba(37, 211, 102, 0.36)";

function sanitizePhoneForUri(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function ActionConfirmCard({
  action,
  onUpdateAction,
  onDataChanged,
}: ActionConfirmCardProps) {
  const [draftBody, setDraftBody] = useState(action.messageBody || "");
  const [upiAmountText, setUpiAmountText] = useState(
    typeof action.amount === "number" && action.amount > 0
      ? String(action.amount)
      : ""
  );
  const [upiNoteText, setUpiNoteText] = useState(action.note || "");
  const [contactNameText, setContactNameText] = useState(
    action.contactName || ""
  );
  const [contactPhoneText, setContactPhoneText] = useState(action.phone || "");
  const [calLocationText, setCalLocationText] = useState(
    action.location || ""
  );
  const [busy, setBusy] = useState(false);

  const isPending = action.status === "pending";
  const isConfirmed = action.status === "confirmed";

  function handleCancel() {
    onUpdateAction(action.id, { status: "cancelled" });
  }

  async function handleConfirmCall() {
    const cleanPhone = sanitizePhoneForUri(action.phone);
    if (!cleanPhone) {
      Alert.alert("Invalid Number", "Phone number is invalid or empty.");
      return;
    }

    try {
      await Linking.openURL(`tel:${cleanPhone}`);
      onUpdateAction(action.id, { status: "confirmed" });
    } catch {
      Alert.alert(
        "Could Not Open Dialer",
        `Unable to launch dialer for ${action.phone} on this device.`
      );
    }
  }

  async function handleConfirmSms() {
    const cleanPhone = sanitizePhoneForUri(action.phone);
    if (!cleanPhone) {
      Alert.alert("Invalid Number", "Recipient phone number is invalid.");
      return;
    }

    const separator = Platform.OS === "ios" ? "&" : "?";
    const encodedBody = encodeURIComponent(draftBody.trim());
    const smsUrl = `sms:${cleanPhone}${separator}body=${encodedBody}`;

    try {
      await Linking.openURL(smsUrl);
      onUpdateAction(action.id, {
        status: "confirmed",
        messageBody: draftBody.trim(),
      });
    } catch {
      Alert.alert(
        "Could Not Open SMS App",
        `Unable to launch SMS composer for ${action.phone} on this device.`
      );
    }
  }

  async function handleConfirmWhatsApp() {
    const waPhone = formatWhatsAppPhone(action.phone);
    if (!waPhone) {
      Alert.alert("Invalid Number", "Recipient WhatsApp number is invalid.");
      return;
    }

    const cleanMessage = draftBody.trim();
    const encodedText = encodeURIComponent(cleanMessage);
    const nativeUrl = `whatsapp://send?phone=${waPhone}&text=${encodedText}`;
    const webFallbackUrl = `https://wa.me/${waPhone}?text=${encodedText}`;

    try {
      const canOpenNative =
        Platform.OS !== "web" && (await Linking.canOpenURL(nativeUrl));
      await Linking.openURL(canOpenNative ? nativeUrl : webFallbackUrl);
      onUpdateAction(action.id, {
        status: "confirmed",
        messageBody: cleanMessage,
      });
    } catch {
      try {
        await Linking.openURL(webFallbackUrl);
        onUpdateAction(action.id, {
          status: "confirmed",
          messageBody: cleanMessage,
        });
      } catch {
        Alert.alert(
          "Could Not Open WhatsApp",
          "WhatsApp could not be launched on this device."
        );
      }
    }
  }

  async function handleConfirmUpi() {
    const cleanUpi = (action.upiId || "").trim();
    if (!cleanUpi || !cleanUpi.includes("@")) {
      Alert.alert("Invalid UPI ID", "Please check the recipient's UPI ID.");
      return;
    }

    const parsedAmount = upiAmountText.trim()
      ? Number(upiAmountText.trim())
      : null;
    if (
      upiAmountText.trim() &&
      (parsedAmount === null || Number.isNaN(parsedAmount) || parsedAmount <= 0)
    ) {
      Alert.alert("Invalid Amount", "Enter a valid positive amount in ₹.");
      return;
    }

    const params: string[] = [
      `pa=${encodeURIComponent(cleanUpi)}`,
      `pn=${encodeURIComponent(action.contactName || "Payee")}`,
      "cu=INR",
    ];
    if (parsedAmount && parsedAmount > 0) {
      params.push(`am=${encodeURIComponent(parsedAmount.toFixed(2))}`);
    }
    if (upiNoteText.trim()) {
      params.push(`tn=${encodeURIComponent(upiNoteText.trim())}`);
    }

    const upiUrl = `upi://pay?${params.join("&")}`;

    try {
      await Linking.openURL(upiUrl);
      onUpdateAction(action.id, {
        status: "confirmed",
        amount: parsedAmount,
        note: upiNoteText.trim(),
      });
    } catch {
      Alert.alert(
        "No UPI App Found",
        "Unable to launch GPay, PhonePe, Paytm, or BHIM on this device."
      );
    }
  }

  async function handleConfirmSaveDeviceContact() {
    const cleanName = contactNameText.trim();
    const cleanPhone = contactPhoneText.trim();
    if (!cleanName || !cleanPhone) {
      Alert.alert("Missing Info", "Both name and phone number are required.");
      return;
    }

    setBusy(true);
    try {
      const res = await saveContactToDevicePhonebook({
        name: cleanName,
        phone: cleanPhone,
        email: action.email,
        company: action.company,
        notes: action.note,
      });

      if (!res.ok) {
        Alert.alert(
          "Could Not Save Contact",
          res.error || "Unable to write to phone contacts."
        );
        return;
      }

      // Also sync into Friday's SQLite Vault so memories & hisaab link cleanly!
      await upsertContact({
        name: cleanName,
        phone: cleanPhone,
        relationship: action.relationship,
        notes: action.note,
      });

      onDataChanged?.();
      onUpdateAction(action.id, {
        status: "confirmed",
        contactName: cleanName,
        phone: cleanPhone,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmCalendarEvent() {
    const cleanTitle = contactNameText.trim();
    if (!cleanTitle || !action.startDateIso) {
      Alert.alert("Missing Info", "Event title and start time are required.");
      return;
    }

    setBusy(true);
    try {
      const res = await createPhoneCalendarEvent({
        title: cleanTitle,
        startDateIso: action.startDateIso,
        endDateIso: action.endDateIso,
        location: calLocationText.trim() || undefined,
        notes: upiNoteText.trim() || undefined,
        reminderMinutesBefore: action.reminderMinutesBefore,
      });

      if (!res.ok) {
        Alert.alert(
          "Could Not Add Event",
          res.error || "Unable to create event in phone calendar."
        );
        return;
      }

      onUpdateAction(action.id, {
        status: "confirmed",
        contactName: cleanTitle,
        location: calLocationText.trim() || undefined,
        note: upiNoteText.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  // 1. PHONE CALL CARD
  if (action.type === "call") {
    return (
      <View
        style={[
          styles.card,
          styles.callBorder,
          action.status === "cancelled" && styles.cardCancelled,
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.callIconWrap}>
            <PhoneCall size={18} color={colors.sage} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.callTag}>Phone Call</Text>
            <Text style={styles.contactTitle}>{action.contactName}</Text>
            <Text style={styles.phoneText}>{action.phone}</Text>
          </View>
        </View>

        {isPending ? (
          <View style={styles.btnRow}>
            <Pressable
              onPress={handleConfirmCall}
              style={({ pressed }) => [
                styles.callConfirmBtn,
                pressed && styles.pressed,
              ]}
            >
              <PhoneCall size={15} color="#062118" />
              <Text style={styles.callConfirmText}>Confirm Call</Text>
            </Pressable>

            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && styles.pressed,
              ]}
            >
              <X size={15} color={colors.muted} />
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.statusFooter}>
            {isConfirmed ? (
              <>
                <Check size={14} color={colors.sage} />
                <Text style={[styles.statusFooterText, { color: colors.sage }]}>
                  Opened in Phone Dialer
                </Text>
              </>
            ) : (
              <>
                <X size={14} color={colors.muted} />
                <Text style={styles.statusFooterText}>Call cancelled</Text>
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  // 2. WHATSAPP MESSAGE CARD
  if (action.type === "whatsapp") {
    return (
      <View
        style={[
          styles.card,
          styles.waBorder,
          action.status === "cancelled" && styles.cardCancelled,
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.waIconWrap}>
            <MessageCircle size={18} color={WHATSAPP_GREEN} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.waTag}>WhatsApp Message</Text>
            <Text style={styles.contactTitle}>{action.contactName}</Text>
            <Text style={styles.phoneText}>{action.phone}</Text>
          </View>
        </View>

        {isPending ? (
          <>
            <TextInput
              value={draftBody}
              onChangeText={setDraftBody}
              multiline
              style={styles.smsInput}
              placeholder="Edit WhatsApp message before opening…"
              placeholderTextColor={colors.subtle}
            />
            <View style={styles.btnRow}>
              <Pressable
                onPress={handleConfirmWhatsApp}
                style={({ pressed }) => [
                  styles.waConfirmBtn,
                  pressed && styles.pressed,
                ]}
              >
                <MessageCircle size={15} color="#052310" />
                <Text style={styles.waConfirmText}>Open WhatsApp</Text>
              </Pressable>

              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && styles.pressed,
                ]}
              >
                <X size={15} color={colors.muted} />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.readonlyDraftBox}>
              <Text style={styles.readonlyDraftText}>
                {action.messageBody || draftBody}
              </Text>
            </View>
            <View style={styles.statusFooter}>
              {isConfirmed ? (
                <>
                  <Check size={14} color={WHATSAPP_GREEN} />
                  <Text
                    style={[styles.statusFooterText, { color: WHATSAPP_GREEN }]}
                  >
                    Opened in WhatsApp
                  </Text>
                </>
              ) : (
                <>
                  <X size={14} color={colors.muted} />
                  <Text style={styles.statusFooterText}>
                    WhatsApp draft cancelled
                  </Text>
                </>
              )}
            </View>
          </>
        )}
      </View>
    );
  }

  // 3. UPI PAYMENT CARD (Strict Confirm)
  if (action.type === "upi") {
    return (
      <View
        style={[
          styles.card,
          styles.upiBorder,
          action.status === "cancelled" && styles.cardCancelled,
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.upiIconWrap}>
            <IndianRupee size={18} color={colors.warning} />
          </View>
          <View style={styles.headerTextWrap}>
            <View style={styles.strictTagRow}>
              <ShieldCheck size={12} color={colors.warning} />
              <Text style={styles.upiTag}>UPI Payment · Verify Details</Text>
            </View>
            <Text style={styles.contactTitle}>{action.contactName}</Text>
            <Text style={styles.upiVpaText}>{action.upiId}</Text>
          </View>
        </View>

        {isPending ? (
          <>
            <View style={styles.upiInputsRow}>
              <View style={styles.upiAmountField}>
                <Text style={styles.fieldLabel}>Amount (₹)</Text>
                <TextInput
                  value={upiAmountText}
                  onChangeText={setUpiAmountText}
                  keyboardType="decimal-pad"
                  placeholder="Optional"
                  placeholderTextColor={colors.subtle}
                  style={styles.compactInput}
                />
              </View>
              <View style={styles.upiNoteField}>
                <Text style={styles.fieldLabel}>Note</Text>
                <TextInput
                  value={upiNoteText}
                  onChangeText={setUpiNoteText}
                  placeholder="Remarks (optional)"
                  placeholderTextColor={colors.subtle}
                  style={styles.compactInput}
                />
              </View>
            </View>

            <View style={styles.btnRow}>
              <Pressable
                onPress={handleConfirmUpi}
                style={({ pressed }) => [
                  styles.upiConfirmBtn,
                  pressed && styles.pressed,
                ]}
              >
                <IndianRupee size={15} color="#231503" />
                <Text style={styles.upiConfirmText}>
                  {upiAmountText.trim()
                    ? `Pay ₹${upiAmountText.trim()} via UPI`
                    : "Open UPI App"}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && styles.pressed,
                ]}
              >
                <X size={15} color={colors.muted} />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.statusFooter}>
            {isConfirmed ? (
              <>
                <Check size={14} color={colors.warning} />
                <Text
                  style={[styles.statusFooterText, { color: colors.warning }]}
                >
                  Opened in UPI Payment App
                  {action.amount ? ` (₹${action.amount})` : ""}
                </Text>
              </>
            ) : (
              <>
                <X size={14} color={colors.muted} />
                <Text style={styles.statusFooterText}>UPI payment cancelled</Text>
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  // 4. SAVE TO DEVICE PHONEBOOK CARD
  if (action.type === "save_device_contact") {
    return (
      <View
        style={[
          styles.card,
          styles.contactBorder,
          action.status === "cancelled" && styles.cardCancelled,
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.contactIconWrap}>
            <UserPlus size={18} color={colors.accent} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.contactTag}>Save to Phonebook & Vault</Text>
            <Text style={styles.contactTitle}>
              {action.contactName || contactNameText}
            </Text>
            <Text style={styles.phoneText}>
              {action.phone || contactPhoneText}
            </Text>
          </View>
        </View>

        {isPending ? (
          <>
            <View style={styles.upiInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  value={contactNameText}
                  onChangeText={setContactNameText}
                  placeholder="Full name"
                  placeholderTextColor={colors.subtle}
                  style={styles.compactInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput
                  value={contactPhoneText}
                  onChangeText={setContactPhoneText}
                  keyboardType="phone-pad"
                  placeholder="Phone number"
                  placeholderTextColor={colors.subtle}
                  style={styles.compactInput}
                />
              </View>
            </View>

            <View style={styles.btnRow}>
              <Pressable
                disabled={busy}
                onPress={handleConfirmSaveDeviceContact}
                style={({ pressed }) => [
                  styles.contactConfirmBtn,
                  (pressed || busy) && styles.pressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <UserPlus size={15} color="#FFFFFF" />
                )}
                <Text style={styles.contactConfirmText}>
                  Save to Phonebook
                </Text>
              </Pressable>

              <Pressable
                disabled={busy}
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && styles.pressed,
                ]}
              >
                <X size={15} color={colors.muted} />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.statusFooter}>
            {isConfirmed ? (
              <>
                <Check size={14} color={colors.sage} />
                <Text style={[styles.statusFooterText, { color: colors.sage }]}>
                  Saved to Phone Contacts & Friday Vault
                </Text>
              </>
            ) : (
              <>
                <X size={14} color={colors.muted} />
                <Text style={styles.statusFooterText}>Save cancelled</Text>
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  // 4B. CALENDAR EVENT CONFIRMATION CARD
  if (action.type === "calendar_event") {
    const startObj = action.startDateIso ? new Date(action.startDateIso) : null;
    const endObj = action.endDateIso ? new Date(action.endDateIso) : null;
    const timeSummary =
      startObj && !Number.isNaN(startObj.getTime())
        ? endObj && !Number.isNaN(endObj.getTime())
          ? `${formatReadableDateTime(startObj)} – ${endObj.toLocaleTimeString(
              "en-IN",
              { hour: "numeric", minute: "2-digit", hour12: true }
            )}`
          : formatReadableDateTime(startObj)
        : action.startDateIso || "";

    return (
      <View
        style={[
          styles.card,
          styles.smsBorder,
          action.status === "cancelled" && styles.cardCancelled,
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.smsIconWrap}>
            <CalendarPlus size={18} color={colors.sky} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.smsTag}>
              Phone Calendar Event · Alert {action.reminderMinutesBefore ?? 15}m
              before
            </Text>
            <Text style={styles.contactTitle}>
              {action.contactName || contactNameText}
            </Text>
            <Text style={styles.phoneText}>{timeSummary}</Text>
          </View>
        </View>

        {isPending ? (
          <>
            <View style={styles.upiInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Event Title</Text>
                <TextInput
                  value={contactNameText}
                  onChangeText={setContactNameText}
                  placeholder="Meeting title"
                  placeholderTextColor={colors.subtle}
                  style={styles.compactInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Location (optional)</Text>
                <TextInput
                  value={calLocationText}
                  onChangeText={setCalLocationText}
                  placeholder="Venue or link"
                  placeholderTextColor={colors.subtle}
                  style={styles.compactInput}
                />
              </View>
            </View>

            <View style={styles.btnRow}>
              <Pressable
                disabled={busy}
                onPress={handleConfirmCalendarEvent}
                style={({ pressed }) => [
                  styles.smsConfirmBtn,
                  (pressed || busy) && styles.pressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#061629" />
                ) : (
                  <CalendarPlus size={15} color="#061629" />
                )}
                <Text style={styles.smsConfirmText}>Add to Calendar</Text>
              </Pressable>

              <Pressable
                disabled={busy}
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && styles.pressed,
                ]}
              >
                <X size={15} color={colors.muted} />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.statusFooter}>
            {isConfirmed ? (
              <>
                <Check size={14} color={colors.sage} />
                <Text style={[styles.statusFooterText, { color: colors.sage }]}>
                  Added to Phone Calendar
                  {action.location ? ` · ${action.location}` : ""}
                </Text>
              </>
            ) : (
              <>
                <X size={14} color={colors.muted} />
                <Text style={styles.statusFooterText}>
                  Calendar event cancelled
                </Text>
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  // 5. SMS DRAFT CARD
  return (
    <View
      style={[
        styles.card,
        styles.smsBorder,
        action.status === "cancelled" && styles.cardCancelled,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.smsIconWrap}>
          <MessageSquareText size={18} color={colors.sky} />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.smsTag}>SMS Draft</Text>
          <Text style={styles.contactTitle}>{action.contactName}</Text>
          <Text style={styles.phoneText}>{action.phone}</Text>
        </View>
      </View>

      {isPending ? (
        <>
          <TextInput
            value={draftBody}
            onChangeText={setDraftBody}
            multiline
            style={styles.smsInput}
            placeholder="Edit message before sending…"
            placeholderTextColor={colors.subtle}
          />
          <View style={styles.btnRow}>
            <Pressable
              onPress={handleConfirmSms}
              style={({ pressed }) => [
                styles.smsConfirmBtn,
                pressed && styles.pressed,
              ]}
            >
              <MessageSquareText size={15} color="#061629" />
              <Text style={styles.smsConfirmText}>Confirm & Open SMS</Text>
            </Pressable>

            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && styles.pressed,
              ]}
            >
              <X size={15} color={colors.muted} />
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.readonlyDraftBox}>
            <Text style={styles.readonlyDraftText}>
              {action.messageBody || draftBody}
            </Text>
          </View>
          <View style={styles.statusFooter}>
            {isConfirmed ? (
              <>
                <Check size={14} color={colors.sky} />
                <Text style={[styles.statusFooterText, { color: colors.sky }]}>
                  Opened in SMS app
                </Text>
              </>
            ) : (
              <>
                <X size={14} color={colors.muted} />
                <Text style={styles.statusFooterText}>Draft cancelled</Text>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
    gap: 12,
  },
  callBorder: {
    borderColor: colors.sageBorder,
  },
  smsBorder: {
    borderColor: colors.skyBorder,
  },
  waBorder: {
    borderColor: WHATSAPP_BORDER,
  },
  upiBorder: {
    borderColor: colors.warningBorder,
  },
  contactBorder: {
    borderColor: colors.accentBorder,
  },
  cardCancelled: {
    opacity: 0.65,
    borderColor: colors.line,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  callIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.sageSoft,
    borderWidth: 1,
    borderColor: colors.sageBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  smsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.skySoft,
    borderWidth: 1,
    borderColor: colors.skyBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  waIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: WHATSAPP_SOFT,
    borderWidth: 1,
    borderColor: WHATSAPP_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  upiIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  contactIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  strictTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  callTag: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.sage,
  },
  smsTag: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.sky,
  },
  waTag: {
    fontSize: 11,
    fontWeight: "700",
    color: WHATSAPP_GREEN,
  },
  upiTag: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.warning,
  },
  contactTag: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginTop: 1,
  },
  phoneText: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 1,
  },
  upiVpaText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    fontWeight: "600",
    marginTop: 2,
  },
  upiInputsRow: {
    flexDirection: "row",
    gap: 8,
  },
  upiAmountField: {
    width: 115,
  },
  upiNoteField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 4,
  },
  compactInput: {
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.sidebar,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: 13.5,
  },
  smsInput: {
    minHeight: 72,
    maxHeight: 145,
    borderRadius: 11,
    backgroundColor: colors.sidebar,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  readonlyDraftBox: {
    borderRadius: 10,
    backgroundColor: colors.sidebar,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  readonlyDraftText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  callConfirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    backgroundColor: colors.sage,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  callConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#062118",
  },
  smsConfirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    backgroundColor: colors.sky,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  smsConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#061629",
  },
  waConfirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    backgroundColor: WHATSAPP_GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  waConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#052310",
  },
  upiConfirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    backgroundColor: colors.warning,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  upiConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#231503",
  },
  contactConfirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  contactConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cancelBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  statusFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusFooterText: {
    fontSize: 12.5,
    color: colors.muted,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.84,
  },
});
