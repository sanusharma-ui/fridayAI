import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { AppSettings, GroqModelOption } from "../types";

const SECURE_GROQ_KEY = "friday_groq_api_key_v1";
const SETTINGS_STORAGE_KEY = "friday:mobile:settings:v1";
const MODELS_CACHE_KEY = "friday:mobile:models:v1";

export const DEFAULT_MODELS: GroqModelOption[] = [
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B Versatile (Recommended)",
    ownedBy: "Meta",
    contextWindow: 131072,
    supportsVision: false,
    recommended: true,
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant (Ultra Fast)",
    ownedBy: "Meta",
    contextWindow: 131072,
    supportsVision: false,
    recommended: true,
  },
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B (Deep Reasoning)",
    ownedBy: "OpenAI",
    contextWindow: 131072,
    supportsVision: false,
    recommended: true,
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B (Fast Reasoning)",
    ownedBy: "OpenAI",
    contextWindow: 131072,
    supportsVision: false,
  },
  {
    id: "qwen/qwen3.8-27b",
    label: "Qwen 3.8 27B (Vision + Multimodal)",
    ownedBy: "Alibaba Cloud",
    contextWindow: 131072,
    supportsVision: true,
    recommended: true,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  groqApiKey: "",
  backendUrl: "",
  selectedModel: "llama-3.3-70b-versatile",
  selectedVisionModel: "qwen/qwen3.8-27b",
  keyVerified: false,
};

async function canUseSecureStore(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const rawSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = rawSettings ? (JSON.parse(rawSettings) as Partial<AppSettings>) : {};

    let groqApiKey = "";
    if (await canUseSecureStore()) {
      groqApiKey = (await SecureStore.getItemAsync(SECURE_GROQ_KEY)) || "";
    } else {
      groqApiKey = (await AsyncStorage.getItem(SECURE_GROQ_KEY)) || "";
    }

    return {
      groqApiKey: groqApiKey.trim(),
      backendUrl: typeof parsed.backendUrl === "string" ? parsed.backendUrl.trim() : "",
      selectedModel:
        typeof parsed.selectedModel === "string" && parsed.selectedModel.trim()
          ? parsed.selectedModel.trim()
          : DEFAULT_SETTINGS.selectedModel,
      selectedVisionModel:
        typeof parsed.selectedVisionModel === "string" && parsed.selectedVisionModel.trim()
          ? parsed.selectedVisionModel.trim()
          : DEFAULT_SETTINGS.selectedVisionModel,
      keyVerified: Boolean(parsed.keyVerified && groqApiKey.trim()),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const cleanKey = settings.groqApiKey.trim();

  if (await canUseSecureStore()) {
    if (cleanKey) {
      await SecureStore.setItemAsync(SECURE_GROQ_KEY, cleanKey);
    } else {
      await SecureStore.deleteItemAsync(SECURE_GROQ_KEY);
    }
  } else {
    if (cleanKey) {
      await AsyncStorage.setItem(SECURE_GROQ_KEY, cleanKey);
    } else {
      await AsyncStorage.removeItem(SECURE_GROQ_KEY);
    }
  }

  const nonSecretPayload = {
    backendUrl: settings.backendUrl.trim(),
    selectedModel: settings.selectedModel.trim() || DEFAULT_SETTINGS.selectedModel,
    selectedVisionModel:
      settings.selectedVisionModel.trim() || DEFAULT_SETTINGS.selectedVisionModel,
    keyVerified: Boolean(settings.keyVerified && cleanKey),
  };

  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nonSecretPayload));
}

export async function loadCachedModels(): Promise<GroqModelOption[]> {
  try {
    const raw = await AsyncStorage.getItem(MODELS_CACHE_KEY);
    if (!raw) return DEFAULT_MODELS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as GroqModelOption[];
    }
    return DEFAULT_MODELS;
  } catch {
    return DEFAULT_MODELS;
  }
}

export async function saveCachedModels(models: GroqModelOption[]): Promise<void> {
  try {
    await AsyncStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(models));
  } catch {
    // Ignore cache write errors
  }
}

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "Not configured";
  if (trimmed.length <= 10) return "••••••••";
  return `${trimmed.slice(0, 6)}••••••••${trimmed.slice(-4)}`;
}
