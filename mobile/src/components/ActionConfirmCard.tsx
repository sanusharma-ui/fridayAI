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
import { Check, MessageSquareText, PhoneCall, X } from "lucide-react-native";
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
            value={smsBody}
            onChangeText={setSmsBody}
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
              {action.messageBody || smsBody}
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
  headerTextWrap: {
    flex: 1,
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
