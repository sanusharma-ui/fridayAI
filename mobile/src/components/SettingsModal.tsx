import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Check,
  CheckCircle2,
  ClipboardPaste,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
  X,
} from "lucide-react-native";
import {
  checkBackendHealth,
  getAutoDetectedBackendUrl,
  verifyGroqKeyWithBackend,
} from "../services/api";
import { maskApiKey } from "../services/settingsStorage";
import { colors } from "../theme/colors";
import type { AppSettings, GroqModelOption } from "../types";

interface SettingsModalProps {
  visible: boolean;
  settings: AppSettings;
  availableModels: GroqModelOption[];
  onClose: () => void;
  onSaveSettings: (next: AppSettings, updatedModels?: GroqModelOption[]) => Promise<void>;
}

export function SettingsModal({
  visible,
  settings,
  availableModels,
  onClose,
  onSaveSettings,
}: SettingsModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState(settings.groqApiKey);
  const [showKey, setShowKey] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState(settings.backendUrl);
  const [selectedModel, setSelectedModel] = useState(settings.selectedModel);
  const [selectedVisionModel, setSelectedVisionModel] = useState(settings.selectedVisionModel);
  const [models, setModels] = useState<GroqModelOption[]>(availableModels);

  const [verifyingKey, setVerifyingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const [testingBackend, setTestingBackend] = useState(false);
  const [backendTestMsg, setBackendTestMsg] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setApiKeyInput(settings.groqApiKey);
      setBackendUrlInput(settings.backendUrl);
      setSelectedModel(settings.selectedModel);
      setSelectedVisionModel(settings.selectedVisionModel);
      setModels(availableModels);
      setShowKey(false);
      setKeyStatus(
        settings.groqApiKey && settings.keyVerified
          ? { type: "success", message: "Groq API key saved & verified on this device." }
          : { type: "idle", message: "" }
      );
      setBackendTestMsg({ type: "idle", message: "" });
    }
  }, [visible, settings, availableModels]);

  const autoUrl = getAutoDetectedBackendUrl();
  const visionModels = models.filter((m) => m.supportsVision);

  async function handlePasteKey() {
    try {
      const text = await Clipboard.getStringAsync();
      if (text?.trim()) {
        setApiKeyInput(text.trim());
        setKeyStatus({ type: "idle", message: "" });
      }
    } catch {
      // Clipboard unavailable
    }
  }

  function handleClearKey() {
    setApiKeyInput("");
    setKeyStatus({ type: "idle", message: "Key cleared. Tap Save Settings to apply." });
  }

  async function handleVerifyKey() {
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      setKeyStatus({ type: "error", message: "Pehle apni Groq API key enter ya paste karein." });
      return;
    }

    setVerifyingKey(true);
    setKeyStatus({ type: "idle", message: "" });

    const res = await verifyGroqKeyWithBackend(backendUrlInput, cleanKey);
    setVerifyingKey(false);

    if (!res.valid) {
      setKeyStatus({ type: "error", message: res.error || "Invalid Groq API key." });
      return;
    }

    const nextModels = res.models && res.models.length > 0 ? res.models : models;
    setModels(nextModels);

    // Ensure selected models exist in updated list
    const nextTextModel = nextModels.some((m) => m.id === selectedModel)
      ? selectedModel
      : nextModels[0]?.id || selectedModel;
    const nextVisModel = nextModels.some((m) => m.id === selectedVisionModel && m.supportsVision)
      ? selectedVisionModel
      : nextModels.find((m) => m.supportsVision)?.id || selectedVisionModel;

    setSelectedModel(nextTextModel);
    setSelectedVisionModel(nextVisModel);

    // Also auto-save immediately so user doesn't lose verified key!
    await onSaveSettings(
      {
        groqApiKey: cleanKey,
        backendUrl: backendUrlInput.trim(),
        selectedModel: nextTextModel,
        selectedVisionModel: nextVisModel,
        keyVerified: true,
      },
      nextModels
    );

    setKeyStatus({
      type: "success",
      message: `Verified & Saved! (${nextModels.length} Groq models unlocked)`,
    });
  }

  async function handleTestBackend() {
    setTestingBackend(true);
    setBackendTestMsg({ type: "idle", message: "" });
    const res = await checkBackendHealth(backendUrlInput);
    setTestingBackend(false);

    if (res.online) {
      setBackendTestMsg({
        type: "success",
        message: "Backend server connected & healthy!",
      });
    } else {
      setBackendTestMsg({
        type: "error",
        message: res.error || "Could not connect to backend server.",
      });
    }
  }

  async function handleSaveAll() {
    setSaving(true);
    const cleanKey = apiKeyInput.trim();
    const keyUnchanged = cleanKey === settings.groqApiKey;
    await onSaveSettings(
      {
        groqApiKey: cleanKey,
        backendUrl: backendUrlInput.trim(),
        selectedModel,
        selectedVisionModel,
        keyVerified: keyUnchanged ? settings.keyVerified && Boolean(cleanKey) : Boolean(keyStatus.type === "success" && cleanKey),
      },
      models
    );
    setSaving(false);
    onClose();
  }

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
          <View>
            <Text style={styles.headerEyebrow}>WORKSPACE CONFIGURATION</Text>
            <Text style={styles.headerTitle}>Settings & API Keys</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            accessibilityLabel="Close settings"
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* SECTION 1: GROQ API KEY */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconBadgeAccent}>
                <KeyRound size={18} color={colors.accent} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Groq API Key (BYOK)</Text>
                <Text style={styles.cardSubtitle}>
                  Apni personal Groq API key setup karein — device par encrypted save hoti hai.
                </Text>
              </View>
            </View>

            <View style={styles.currentKeyBanner}>
              <ShieldCheck size={14} color={apiKeyInput.trim() ? colors.sage : colors.muted} />
              <Text style={styles.currentKeyText}>
                Status:{" "}
                <Text
                  style={{
                    color: apiKeyInput.trim() ? colors.sage : colors.warning,
                    fontWeight: "600",
                  }}
                >
                  {apiKeyInput.trim() ? maskApiKey(apiKeyInput) : "No key configured"}
                </Text>
              </Text>
            </View>

            <Text style={styles.fieldLabel}>GROQ SECRET KEY</Text>
            <View style={styles.keyInputWrap}>
              <TextInput
                value={apiKeyInput}
                onChangeText={(val) => {
                  setApiKeyInput(val);
                  if (keyStatus.type !== "idle") setKeyStatus({ type: "idle", message: "" });
                }}
                placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                placeholderTextColor={colors.subtle}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.keyInput}
              />
              <Pressable
                onPress={() => setShowKey((s) => !s)}
                style={styles.inputIconBtn}
                accessibilityLabel={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? (
                  <EyeOff size={18} color={colors.muted} />
                ) : (
                  <Eye size={18} color={colors.muted} />
                )}
              </Pressable>
            </View>

            <View style={styles.keyActionRow}>
              <Pressable
                onPress={handlePasteKey}
                style={({ pressed }) => [styles.secondarySmallBtn, pressed && styles.pressed]}
              >
                <ClipboardPaste size={14} color={colors.textSecondary} />
                <Text style={styles.secondarySmallBtnText}>Paste Key</Text>
              </Pressable>

              {apiKeyInput.length > 0 && (
                <Pressable
                  onPress={handleClearKey}
                  style={({ pressed }) => [styles.dangerSmallBtn, pressed && styles.pressed]}
                >
                  <Trash2 size={14} color={colors.danger} />
                  <Text style={styles.dangerSmallBtnText}>Clear</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => Linking.openURL("https://console.groq.com/keys")}
                style={({ pressed }) => [styles.linkSmallBtn, pressed && styles.pressed]}
              >
                <Text style={styles.linkSmallBtnText}>Get Free Groq Key</Text>
                <ExternalLink size={13} color={colors.accent} />
              </Pressable>
            </View>

            <Pressable
              onPress={handleVerifyKey}
              disabled={verifyingKey}
              style={({ pressed }) => [
                styles.verifyBtn,
                verifyingKey && styles.disabledBtn,
                pressed && !verifyingKey && styles.pressed,
              ]}
            >
              {verifyingKey ? (
                <ActivityIndicator size="small" color={colors.ctaText} />
              ) : (
                <CheckCircle2 size={17} color={colors.ctaText} />
              )}
              <Text style={styles.verifyBtnText}>
                {verifyingKey ? "Verifying with Groq…" : "Verify & Save Key"}
              </Text>
            </Pressable>

            {keyStatus.message ? (
              <View
                style={[
                  styles.feedbackBox,
                  keyStatus.type === "success" && styles.feedbackSuccess,
                  keyStatus.type === "error" && styles.feedbackError,
                ]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    keyStatus.type === "success" && { color: colors.sage },
                    keyStatus.type === "error" && { color: colors.danger },
                  ]}
                >
                  {keyStatus.message}
                </Text>
              </View>
            ) : null}
          </View>

          {/* SECTION 2: MODEL SELECTION */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconBadgeSage}>
                <Cpu size={18} color={colors.sage} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Groq AI Models</Text>
                <Text style={styles.cardSubtitle}>
                  Chat aur image analysis ke liye model choose karein.
                </Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>PRIMARY CHAT MODEL</Text>
            <View style={styles.modelList}>
              {models.slice(0, 12).map((model) => {
                const active = selectedModel === model.id;
                return (
                  <Pressable
                    key={model.id}
                    onPress={() => setSelectedModel(model.id)}
                    style={[styles.modelOption, active && styles.modelOptionActive]}
                  >
                    <View style={styles.modelOptionInfo}>
                      <View style={styles.modelTitleRow}>
                        <Text
                          style={[styles.modelName, active && styles.modelNameActive]}
                          numberOfLines={1}
                        >
                          {model.label}
                        </Text>
                        {model.supportsVision && (
                          <View style={styles.visionBadge}>
                            <Sparkles size={10} color={colors.accent} />
                            <Text style={styles.visionBadgeText}>VISION</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.modelIdText}>{model.id}</Text>
                    </View>
                    <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                      {active && <Check size={12} color={colors.ctaText} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {visionModels.length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
                  AUTO-VISION MODEL (FOR IMAGES)
                </Text>
                <View style={styles.modelList}>
                  {visionModels.map((model) => {
                    const active = selectedVisionModel === model.id;
                    return (
                      <Pressable
                        key={`vis-${model.id}`}
                        onPress={() => setSelectedVisionModel(model.id)}
                        style={[styles.modelOption, active && styles.modelOptionActive]}
                      >
                        <View style={styles.modelOptionInfo}>
                          <Text
                            style={[styles.modelName, active && styles.modelNameActive]}
                            numberOfLines={1}
                          >
                            {model.label}
                          </Text>
                          <Text style={styles.modelIdText}>{model.id}</Text>
                        </View>
                        <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                          {active && <Check size={12} color={colors.ctaText} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* SECTION 3: BACKEND SERVER CONNECTION */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconBadgeAccent}>
                <Server size={18} color={colors.accent} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Friday Backend Server</Text>
                <Text style={styles.cardSubtitle}>
                  Leave blank to auto-detect ({autoUrl}), or enter your PC LAN IP / deployed server URL.
                </Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>BACKEND BASE URL (OPTIONAL)</Text>
            <TextInput
              value={backendUrlInput}
              onChangeText={(val) => {
                setBackendUrlInput(val);
                setBackendTestMsg({ type: "idle", message: "" });
              }}
              placeholder={autoUrl}
              placeholderTextColor={colors.subtle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.urlInput}
            />

            <View style={styles.backendBtnRow}>
              <Pressable
                onPress={handleTestBackend}
                disabled={testingBackend}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  pressed && styles.pressed,
                ]}
              >
                {testingBackend ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Wifi size={15} color={colors.sage} />
                )}
                <Text style={styles.secondaryBtnText}>
                  {testingBackend ? "Checking…" : "Test Connection"}
                </Text>
              </Pressable>

              {backendUrlInput.trim().length > 0 && (
                <Pressable
                  onPress={() => {
                    setBackendUrlInput("");
                    setBackendTestMsg({ type: "idle", message: "" });
                  }}
                  style={({ pressed }) => [styles.secondarySmallBtn, pressed && styles.pressed]}
                >
                  <RefreshCw size={13} color={colors.muted} />
                  <Text style={styles.secondarySmallBtnText}>Reset to Auto</Text>
                </Pressable>
              )}
            </View>

            {backendTestMsg.message ? (
              <View
                style={[
                  styles.feedbackBox,
                  backendTestMsg.type === "success" && styles.feedbackSuccess,
                  backendTestMsg.type === "error" && styles.feedbackError,
                ]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    backendTestMsg.type === "success" && { color: colors.sage },
                    backendTestMsg.type === "error" && { color: colors.danger },
                  ]}
                >
                  {backendTestMsg.message}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* Sticky Footer Save Button */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleSaveAll}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveAllBtn,
              saving && styles.disabledBtn,
              pressed && styles.pressed,
            ]}
          >
            <Check size={18} color={colors.ctaText} strokeWidth={2.5} />
            <Text style={styles.saveAllBtnText}>
              {saving ? "Saving…" : "Save Settings"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerEyebrow: {
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.accent,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  iconBadgeAccent: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeSage: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.sageSoft,
    borderWidth: 1,
    borderColor: colors.sageBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginTop: 3,
  },
  currentKeyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.sidebar,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    marginBottom: 14,
  },
  currentKeyText: {
    fontSize: 12,
    color: colors.muted,
  },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 1.3,
    color: colors.muted,
    fontWeight: "600",
    marginBottom: 8,
  },
  keyInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingLeft: 12,
    paddingRight: 6,
  },
  keyInput: {
    flex: 1,
    height: 46,
    color: colors.text,
    fontSize: 13,
  },
  inputIconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  keyActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  secondarySmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondarySmallBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  dangerSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  dangerSmallBtnText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: "500",
  },
  linkSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: "auto",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  linkSmallBtnText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: "500",
  },
  verifyBtn: {
    marginTop: 14,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.ctaBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  verifyBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ctaText,
  },
  feedbackBox: {
    marginTop: 12,
    padding: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sidebar,
  },
  feedbackSuccess: {
    borderColor: colors.sageBorder,
    backgroundColor: colors.sageSoft,
  },
  feedbackError: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
  },
  feedbackText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  modelList: {
    gap: 8,
  },
  modelOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.sidebar,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    gap: 10,
  },
  modelOptionActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.sageBorder,
  },
  modelOptionInfo: {
    flex: 1,
  },
  modelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  modelName: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
    flexShrink: 1,
  },
  modelNameActive: {
    color: colors.text,
    fontWeight: "600",
  },
  modelIdText: {
    fontSize: 11,
    color: colors.subtle,
    marginTop: 2,
  },
  visionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  visionBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.accent,
    letterSpacing: 0.6,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    backgroundColor: colors.sage,
    borderColor: colors.sage,
  },
  urlInput: {
    height: 45,
    backgroundColor: colors.sidebar,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 13,
  },
  backendBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 9,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  saveAllBtn: {
    height: 48,
    borderRadius: 11,
    backgroundColor: colors.ctaBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveAllBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ctaText,
  },
  pressed: {
    opacity: 0.82,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
