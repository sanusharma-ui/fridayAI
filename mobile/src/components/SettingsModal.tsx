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
  Gauge,
  KeyRound,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Wifi,
  X,
} from "lucide-react-native";
import {
  checkBackendHealth,
  getAutoDetectedBackendUrl,
  verifyGroqKeyWithBackend,
} from "../services/api";
import {
  DEFAULT_TOKEN_BUDGET,
  maskApiKey,
} from "../services/settingsStorage";
import { colors } from "../theme/colors";
import { useResponsive } from "../theme/responsive";
import type {
  AppSettings,
  GroqModelOption,
  TokenBudgetMode,
} from "../types";

interface SettingsModalProps {
  visible: boolean;
  settings: AppSettings;
  availableModels: GroqModelOption[];
  onClose: () => void;
  onSaveSettings: (
    next: AppSettings,
    updatedModels?: GroqModelOption[]
  ) => Promise<void>;
}

export function SettingsModal({
  visible,
  settings,
  availableModels,
  onClose,
  onSaveSettings,
}: SettingsModalProps) {
  const { horizontalPad, contentMaxWidth } = useResponsive();

  const [apiKeyInput, setApiKeyInput] = useState(settings.groqApiKey);
  const [showKey, setShowKey] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState(settings.backendUrl);
  const [selectedModel, setSelectedModel] = useState(settings.selectedModel);
  const [selectedVisionModel, setSelectedVisionModel] = useState(
    settings.selectedVisionModel
  );
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

  // Universal Token & Rate-Limit Budget controls
  const [tokenMode, setTokenMode] = useState<TokenBudgetMode>(
    settings.tokenBudget?.mode || "balanced"
  );
  const [maxInputText, setMaxInputText] = useState(
    String(
      settings.tokenBudget?.maxInputTokens ||
        DEFAULT_TOKEN_BUDGET.maxInputTokens
    )
  );
  const [maxOutputText, setMaxOutputText] = useState(
    String(
      settings.tokenBudget?.maxOutputTokens ||
        DEFAULT_TOKEN_BUDGET.maxOutputTokens
    )
  );
  const [maxHistoryText, setMaxHistoryText] = useState(
    String(
      settings.tokenBudget?.maxHistoryTurns ||
        DEFAULT_TOKEN_BUDGET.maxHistoryTurns
    )
  );
  const [toolPageSizeText, setToolPageSizeText] = useState(
    String(
      settings.tokenBudget?.toolPageSize || DEFAULT_TOKEN_BUDGET.toolPageSize
    )
  );

  useEffect(() => {
    if (visible) {
      setApiKeyInput(settings.groqApiKey);
      setBackendUrlInput(settings.backendUrl);
      setSelectedModel(settings.selectedModel);
      setSelectedVisionModel(settings.selectedVisionModel);
      setModels(availableModels);
      setShowKey(false);
      setTokenMode(settings.tokenBudget?.mode || "balanced");
      setMaxInputText(
        String(
          settings.tokenBudget?.maxInputTokens ||
            DEFAULT_TOKEN_BUDGET.maxInputTokens
        )
      );
      setMaxOutputText(
        String(
          settings.tokenBudget?.maxOutputTokens ||
            DEFAULT_TOKEN_BUDGET.maxOutputTokens
        )
      );
      setMaxHistoryText(
        String(
          settings.tokenBudget?.maxHistoryTurns ||
            DEFAULT_TOKEN_BUDGET.maxHistoryTurns
        )
      );
      setToolPageSizeText(
        String(
          settings.tokenBudget?.toolPageSize ||
            DEFAULT_TOKEN_BUDGET.toolPageSize
        )
      );
      setKeyStatus(
        settings.groqApiKey && settings.keyVerified
          ? { type: "success", message: "Key verified & active on this phone." }
          : { type: "idle", message: "" }
      );
      setBackendTestMsg({ type: "idle", message: "" });
    }
  }, [visible, settings, availableModels]);

  function buildTokenBudgetPayload() {
    const parseClamped = (
      txt: string,
      fallback: number,
      min: number,
      max: number
    ) => {
      const n = Number(txt.trim());
      if (!txt.trim() || Number.isNaN(n)) return fallback;
      return Math.max(min, Math.min(max, Math.round(n)));
    };

    return {
      mode: tokenMode,
      maxInputTokens: parseClamped(
        maxInputText,
        DEFAULT_TOKEN_BUDGET.maxInputTokens,
        800,
        20000
      ),
      maxOutputTokens: parseClamped(
        maxOutputText,
        DEFAULT_TOKEN_BUDGET.maxOutputTokens,
        256,
        8192
      ),
      maxHistoryTurns: parseClamped(
        maxHistoryText,
        DEFAULT_TOKEN_BUDGET.maxHistoryTurns,
        2,
        20
      ),
      toolPageSize: parseClamped(
        toolPageSizeText,
        DEFAULT_TOKEN_BUDGET.toolPageSize,
        4,
        25
      ),
    };
  }

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
    setKeyStatus({
      type: "idle",
      message: "Key cleared. Tap Save to apply.",
    });
  }

  async function handleVerifyKey() {
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      setKeyStatus({
        type: "error",
        message: "Please enter or paste your Groq API key first.",
      });
      return;
    }

    setVerifyingKey(true);
    setKeyStatus({ type: "idle", message: "" });

    const res = await verifyGroqKeyWithBackend(backendUrlInput, cleanKey);
    setVerifyingKey(false);

    if (!res.valid) {
      setKeyStatus({
        type: "error",
        message: res.error || "Invalid Groq API key.",
      });
      return;
    }

    const nextModels =
      res.models && res.models.length > 0 ? res.models : models;
    setModels(nextModels);

    const nextTextModel = nextModels.some((m) => m.id === selectedModel)
      ? selectedModel
      : nextModels[0]?.id || selectedModel;
    const nextVisModel = nextModels.some(
      (m) => m.id === selectedVisionModel && m.supportsVision
    )
      ? selectedVisionModel
      : nextModels.find((m) => m.supportsVision)?.id || selectedVisionModel;

    setSelectedModel(nextTextModel);
    setSelectedVisionModel(nextVisModel);

    await onSaveSettings(
      {
        groqApiKey: cleanKey,
        backendUrl: backendUrlInput.trim(),
        selectedModel: nextTextModel,
        selectedVisionModel: nextVisModel,
        keyVerified: true,
        tokenBudget: buildTokenBudgetPayload(),
      },
      nextModels
    );

    setKeyStatus({
      type: "success",
      message: `Verified & saved (${nextModels.length} Groq models available)`,
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
        keyVerified: keyUnchanged
          ? settings.keyVerified && Boolean(cleanKey)
          : Boolean(keyStatus.type === "success" && cleanKey),
        tokenBudget: buildTokenBudgetPayload(),
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
        <View style={[styles.header, { paddingHorizontal: horizontalPad }]}>
          <View>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSub}>
              API keys, Groq models & server connection
            </Text>
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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontalPad },
            contentMaxWidth
              ? { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }
              : null,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* GROQ API KEY */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconBadgeAmber}>
                <KeyRound size={18} color={colors.warning} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Groq API Key</Text>
                <Text style={styles.cardSubtitle}>
                  Encrypted locally on your phone via SecureStore.
                </Text>
              </View>
            </View>

            <View style={styles.currentKeyBanner}>
              <ShieldCheck
                size={14}
                color={apiKeyInput.trim() ? colors.sage : colors.muted}
              />
              <Text style={styles.currentKeyText}>
                {apiKeyInput.trim()
                  ? maskApiKey(apiKeyInput)
                  : "No API key saved yet"}
              </Text>
            </View>

            <View style={styles.keyInputWrap}>
              <TextInput
                value={apiKeyInput}
                onChangeText={(val) => {
                  setApiKeyInput(val);
                  if (keyStatus.type !== "idle")
                    setKeyStatus({ type: "idle", message: "" });
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
                style={({ pressed }) => [
                  styles.secondarySmallBtn,
                  pressed && styles.pressed,
                ]}
              >
                <ClipboardPaste size={14} color={colors.textSecondary} />
                <Text style={styles.secondarySmallBtnText}>Paste</Text>
              </Pressable>

              {apiKeyInput.length > 0 && (
                <Pressable
                  onPress={handleClearKey}
                  style={({ pressed }) => [
                    styles.dangerSmallBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Trash2 size={14} color={colors.danger} />
                  <Text style={styles.dangerSmallBtnText}>Clear</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => Linking.openURL("https://console.groq.com/keys")}
                style={({ pressed }) => [
                  styles.linkSmallBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.linkSmallBtnText}>Get Groq Key</Text>
                <ExternalLink size={13} color={colors.sky} />
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
                <ActivityIndicator size="small" color="#062118" />
              ) : (
                <CheckCircle2 size={17} color="#062118" />
              )}
              <Text style={styles.verifyBtnText}>
                {verifyingKey ? "Verifying…" : "Verify & Save Key"}
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

          {/* MODEL SELECTION */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconBadgeCoral}>
                <Cpu size={18} color={colors.accent} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>AI Models</Text>
                <Text style={styles.cardSubtitle}>
                  Select your preferred Groq chat & vision models.
                </Text>
              </View>
            </View>

            <Text style={styles.sectionSubLabel}>Chat & Tool Calling Model</Text>
            <View style={styles.modelList}>
              {models.slice(0, 12).map((model) => {
                const active = selectedModel === model.id;
                return (
                  <Pressable
                    key={model.id}
                    onPress={() => setSelectedModel(model.id)}
                    style={[
                      styles.modelOption,
                      active && styles.modelOptionActive,
                    ]}
                  >
                    <View style={styles.modelOptionInfo}>
                      <View style={styles.modelTitleRow}>
                        <Text
                          style={[
                            styles.modelName,
                            active && styles.modelNameActive,
                          ]}
                          numberOfLines={1}
                        >
                          {model.label}
                        </Text>
                        {model.supportsVision && (
                          <View style={styles.visionBadge}>
                            <Text style={styles.visionBadgeText}>Vision</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.modelIdText}>{model.id}</Text>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        active && styles.radioOuterActive,
                      ]}
                    >
                      {active && <Check size={12} color="#FFFFFF" />}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {visionModels.length > 0 && (
              <>
                <Text style={[styles.sectionSubLabel, { marginTop: 16 }]}>
                  Image Vision Model
                </Text>
                <View style={styles.modelList}>
                  {visionModels.map((model) => {
                    const active = selectedVisionModel === model.id;
                    return (
                      <Pressable
                        key={`vis-${model.id}`}
                        onPress={() => setSelectedVisionModel(model.id)}
                        style={[
                          styles.modelOption,
                          active && styles.modelOptionActive,
                        ]}
                      >
                        <View style={styles.modelOptionInfo}>
                          <Text
                            style={[
                              styles.modelName,
                              active && styles.modelNameActive,
                            ]}
                            numberOfLines={1}
                          >
                            {model.label}
                          </Text>
                          <Text style={styles.modelIdText}>{model.id}</Text>
                        </View>
                        <View
                          style={[
                            styles.radioOuter,
                            active && styles.radioOuterActive,
                          ]}
                        >
                          {active && <Check size={12} color="#FFFFFF" />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* TOKEN & RATE-LIMIT BUDGET */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconBadgeAmber}>
                <Gauge size={18} color={colors.sage} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Token & Rate-Limit Budget</Text>
                <Text style={styles.cardSubtitle}>
                  Prevents Groq free-tier TPM rate limit spikes
                </Text>
              </View>
            </View>

            <View style={styles.modeSegment}>
              <Pressable
                onPress={() => setTokenMode("balanced")}
                style={[
                  styles.modeSegmentBtn,
                  tokenMode === "balanced" && styles.modeSegmentBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.modeSegmentText,
                    tokenMode === "balanced" && styles.modeSegmentTextActive,
                  ]}
                >
                  Balanced (Groq Auto)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setTokenMode("custom")}
                style={[
                  styles.modeSegmentBtn,
                  tokenMode === "custom" && styles.modeSegmentBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.modeSegmentText,
                    tokenMode === "custom" && styles.modeSegmentTextActive,
                  ]}
                >
                  Custom Tokens
                </Text>
              </Pressable>
            </View>

            {tokenMode === "balanced" ? (
              <View style={[styles.feedbackBox, styles.feedbackSuccess]}>
                <Text style={[styles.feedbackText, { color: colors.sage }]}>
                  Auto-tuned for Groq: attaches tools only when needed, caps
                  input to ~2,800 tokens, dynamically sizes output (640–1,600
                  tokens), and paginates large lists (8 items/page) with
                  automatic fast-model failover on 429 limits.
                </Text>
              </View>
            ) : (
              <View style={styles.customTokensWrap}>
                <View style={styles.tokenFieldRow}>
                  <View style={styles.tokenFieldCol}>
                    <Text style={styles.tokenFieldLabel}>
                      Max Input Tokens (800–20000)
                    </Text>
                    <TextInput
                      value={maxInputText}
                      onChangeText={setMaxInputText}
                      keyboardType="number-pad"
                      placeholder="2800"
                      placeholderTextColor={colors.subtle}
                      style={styles.urlInput}
                    />
                  </View>

                  <View style={styles.tokenFieldCol}>
                    <Text style={styles.tokenFieldLabel}>
                      Max Output Tokens (256–8192)
                    </Text>
                    <TextInput
                      value={maxOutputText}
                      onChangeText={setMaxOutputText}
                      keyboardType="number-pad"
                      placeholder="1024"
                      placeholderTextColor={colors.subtle}
                      style={styles.urlInput}
                    />
                  </View>
                </View>

                <View style={styles.tokenFieldRow}>
                  <View style={styles.tokenFieldCol}>
                    <Text style={styles.tokenFieldLabel}>
                      History Turns (2–20)
                    </Text>
                    <TextInput
                      value={maxHistoryText}
                      onChangeText={setMaxHistoryText}
                      keyboardType="number-pad"
                      placeholder="6"
                      placeholderTextColor={colors.subtle}
                      style={styles.urlInput}
                    />
                  </View>

                  <View style={styles.tokenFieldCol}>
                    <Text style={styles.tokenFieldLabel}>
                      Tool Page Size (4–25 items)
                    </Text>
                    <TextInput
                      value={toolPageSizeText}
                      onChangeText={setToolPageSizeText}
                      keyboardType="number-pad"
                      placeholder="8"
                      placeholderTextColor={colors.subtle}
                      style={styles.urlInput}
                    />
                  </View>
                </View>

                <View style={styles.presetRow}>
                  {(
                    [
                      {
                        label: "Saver (2k / 512)",
                        inTok: "2000",
                        outTok: "512",
                        hist: "4",
                        page: "6",
                      },
                      {
                        label: "Standard (3.2k / 1k)",
                        inTok: "3200",
                        outTok: "1024",
                        hist: "6",
                        page: "8",
                      },
                      {
                        label: "Deep (6k / 2.5k)",
                        inTok: "6000",
                        outTok: "2560",
                        hist: "10",
                        page: "12",
                      },
                    ] as const
                  ).map((preset) => (
                    <Pressable
                      key={preset.label}
                      onPress={() => {
                        setMaxInputText(preset.inTok);
                        setMaxOutputText(preset.outTok);
                        setMaxHistoryText(preset.hist);
                        setToolPageSizeText(preset.page);
                      }}
                      style={({ pressed }) => [
                        styles.secondarySmallBtn,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.secondarySmallBtnText}>
                        {preset.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* BACKEND SERVER */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconBadgeSky}>
                <Server size={18} color={colors.sky} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Backend Server</Text>
                <Text style={styles.cardSubtitle}>
                  Auto-detected: {autoUrl}
                </Text>
              </View>
            </View>

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
                  style={({ pressed }) => [
                    styles.secondarySmallBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <RefreshCw size={13} color={colors.muted} />
                  <Text style={styles.secondarySmallBtnText}>Reset</Text>
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

        <View style={[styles.footer, { paddingHorizontal: horizontalPad }]}>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSubtle,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  headerSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
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
    paddingTop: 16,
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  iconBadgeAmber: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeCoral: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeSky: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.skySoft,
    borderWidth: 1,
    borderColor: colors.skyBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15.5,
    fontWeight: "700",
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  currentKeyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.sidebar,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    marginBottom: 12,
  },
  currentKeyText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  sectionSubLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 8,
  },
  keyInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingLeft: 13,
    paddingRight: 6,
  },
  keyInput: {
    flex: 1,
    height: 46,
    color: colors.text,
    fontSize: 13.5,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondarySmallBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  dangerSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  dangerSmallBtnText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: "600",
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
    fontSize: 12.5,
    color: colors.sky,
    fontWeight: "600",
  },
  verifyBtn: {
    marginTop: 14,
    height: 45,
    borderRadius: 12,
    backgroundColor: colors.sage,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  verifyBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#062118",
  },
  feedbackBox: {
    marginTop: 12,
    padding: 11,
    borderRadius: 10,
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
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  modelList: {
    gap: 8,
  },
  modelOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.sidebar,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    gap: 10,
  },
  modelOptionActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.accentBorder,
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
    fontSize: 13.5,
    color: colors.textSecondary,
    fontWeight: "500",
    flexShrink: 1,
  },
  modelNameActive: {
    color: colors.text,
    fontWeight: "700",
  },
  modelIdText: {
    fontSize: 11,
    color: colors.subtle,
    marginTop: 2,
  },
  visionBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.skySoft,
    borderWidth: 1,
    borderColor: colors.skyBorder,
  },
  visionBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.sky,
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
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  urlInput: {
    height: 46,
    backgroundColor: colors.sidebar,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 13.5,
  },
  modeSegment: {
    flexDirection: "row",
    backgroundColor: colors.sidebar,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 3,
    gap: 4,
  },
  modeSegmentBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modeSegmentBtnActive: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  modeSegmentText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.muted,
  },
  modeSegmentTextActive: {
    color: colors.text,
    fontWeight: "700",
  },
  customTokensWrap: {
    marginTop: 12,
    gap: 10,
  },
  tokenFieldRow: {
    flexDirection: "row",
    gap: 10,
  },
  tokenFieldCol: {
    flex: 1,
  },
  tokenFieldLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 5,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
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
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  secondaryBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.text,
  },
  footer: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lineSubtle,
    backgroundColor: colors.bg,
  },
  saveAllBtn: {
    height: 48,
    borderRadius: 13,
    backgroundColor: colors.ctaBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveAllBtnText: {
    fontSize: 14.5,
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
