import React, { useState } from "react";
import {
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
  Check,
  MessageSquareText,
  PhoneCall,
  ShieldAlert,
  X,
} from "lucide-react-native";
import { colors } from "../theme/colors";
import type { PendingDeviceAction } from "../types";

interface ActionConfirmCardProps {
  action: PendingDeviceAction;
  onUpdateAction: (
    actionId: string,
    patch: Partial<PendingDeviceAction>
  ) => void;
}

function sanitizePhoneForUri(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function ActionConfirmCard({
  action,
  onUpdateAction,
}: ActionConfirmCardProps) {
  const [smsBody, setSmsBody] = useState(action.messageBody || "");
  const isPending = action.status === "pending";
  const isConfirmed = action.status === "confirmed";

  async function handleConfirmCall() {
    const cleanPhone = sanitizePhoneForUri(action.phone);
    if (!cleanPhone) {
      Alert.alert("Invalid Number", "Phone number is invalid or empty.");
      return;
    }

    const telUrl = `tel:${cleanPhone}`;
    try {
      await Linking.openURL(telUrl);
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
    const encodedBody = encodeURIComponent(smsBody.trim());
    const smsUrl = `sms:${cleanPhone}${separator}body=${encodedBody}`;

    try {
      await Linking.openURL(smsUrl);
      onUpdateAction(action.id, {
        status: "confirmed",
        messageBody: smsBody.trim(),
      });
    } catch {
      Alert.alert(
        "Could Not Open SMS App",
        `Unable to launch SMS composer for ${action.phone} on this device.`
      );
    }
  }

  function handleCancel() {
    onUpdateAction(action.id, { status: "cancelled" });
  }

  if (action.type === "call") {
    return (
      <View
        style={[
          styles.card,
          isConfirmed && styles.cardConfirmed,
          action.status === "cancelled" && styles.cardCancelled,
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.iconWrapSage}>
            <PhoneCall size={16} color={colors.sage} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>
              {isPending
                ? "CONFIRM PHONE CALL"
                : isConfirmed
                ? "CALL CONFIRMED"
                : "CALL CANCELLED"}
            </Text>
            <Text style={styles.contactTitle}>{action.contactName}</Text>
            <Text style={styles.phoneText}>{action.phone}</Text>
          </View>
        </View>

        {isPending ? (
          <>
            <View style={styles.safetyNote}>
              <ShieldAlert size={12} color={colors.accent} />
              <Text style={styles.safetyNoteText}>
                Confirm karne par Android Dialer open hoga.
              </Text>
            </View>
            <View style={styles.btnRow}>
              <Pressable
                onPress={handleConfirmCall}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  pressed && styles.pressed,
                ]}
              >
                <PhoneCall size={14} color={colors.ctaText} />
                <Text style={styles.confirmBtnText}>Confirm Call</Text>
              </Pressable>

              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && styles.pressed,
                ]}
              >
                <X size={14} color={colors.muted} />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.statusFooter}>
            {isConfirmed ? (
              <>
                <Check size={13} color={colors.sage} />
                <Text style={[styles.statusFooterText, { color: colors.sage }]}>
                  Opened in Android Phone Dialer
                </Text>
              </>
            ) : (
              <>
                <X size={13} color={colors.muted} />
                <Text style={styles.statusFooterText}>Call cancelled</Text>
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  // SMS Draft Confirmation Card
  return (
    <View
      style={[
        styles.card,
        isConfirmed && styles.cardConfirmed,
        action.status === "cancelled" && styles.cardCancelled,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconWrapAccent}>
          <MessageSquareText size={16} color={colors.accent} />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            {isPending
              ? "SMS DRAFT · CONFIRM TO SEND"
              : isConfirmed
              ? "SMS OPENED"
              : "SMS CANCELLED"}
          </Text>
          <Text style={styles.contactTitle}>
            To: {action.contactName} ({action.phone})
          </Text>
        </View>
      </View>

      {isPending ? (
        <>
          <Text style={styles.draftLabel}>MESSAGE DRAFT (EDITABLE)</Text>
          <TextInput
            value={smsBody}
            onChangeText={setSmsBody}
            multiline
            style={styles.smsInput}
            placeholder="Write SMS message…"
            placeholderTextColor={colors.subtle}
          />
          <View style={styles.btnRow}>
            <Pressable
              onPress={handleConfirmSms}
              style={({ pressed }) => [
                styles.confirmBtn,
                pressed && styles.pressed,
              ]}
            >
              <MessageSquareText size={14} color={colors.ctaText} />
              <Text style={styles.confirmBtnText}>Confirm & Open SMS</Text>
            </Pressable>

            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && styles.pressed,
              ]}
            >
              <X size={14} color={colors.muted} />
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.readonlyDraftBox}>
            <Text style={styles.readonlyDraftText}>
              {action.messageBody || smsBody}
            </Text>
          </View>
          <View style={styles.statusFooter}>
            {isConfirmed ? (
              <>
                <Check size={13} color={colors.sage} />
                <Text style={[styles.statusFooterText, { color: colors.sage }]}>
                  Opened in SMS app after confirmation
                </Text>
              </>
            ) : (
              <>
                <X size={13} color={colors.muted} />
                <Text style={styles.statusFooterText}>SMS draft cancelled</Text>
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
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: 13,
    marginTop: 8,
    gap: 10,
  },
  cardConfirmed: {
    borderColor: colors.sageBorder,
  },
  cardCancelled: {
    opacity: 0.72,
    borderColor: colors.line,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  iconWrapSage: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.sageSoft,
    borderWidth: 1,
    borderColor: colors.sageBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapAccent: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: colors.sage,
  },
  contactTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.text,
    marginTop: 1,
  },
  phoneText: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 1,
  },
  safetyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.sidebar,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  safetyNoteText: {
    fontSize: 11.5,
    color: colors.muted,
  },
  draftLabel: {
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 1.1,
    color: colors.subtle,
  },
  smsInput: {
    minHeight: 68,
    maxHeight: 140,
    borderRadius: 9,
    backgroundColor: colors.sidebar,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 19,
    textAlignVertical: "top",
  },
  readonlyDraftBox: {
    borderRadius: 8,
    backgroundColor: colors.sidebar,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  readonlyDraftText: {
    fontSize: 13,
    lineHeight: 18.5,
    color: colors.textSecondary,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  confirmBtn: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    backgroundColor: colors.ctaBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  confirmBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.ctaText,
  },
  cancelBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.muted,
  },
  statusFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusFooterText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.82,
  },
});
