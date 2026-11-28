import * as Battery from "expo-battery";
import * as Brightness from "expo-brightness";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import {
  AssetField,
  MediaType,
  Query,
  getPermissionsAsync as getMediaPermissionsAsync,
  requestPermissionsAsync as requestMediaPermissionsAsync,
} from "expo-media-library";
import { Linking, Platform } from "react-native";
import type { Attachment } from "../types";

/**
 * Curated Android package directory for popular Indian & utility apps so
 * natural requests like "Blinkit khol de" or "Zomato open kar" work out-of-the-box!
 */
const ANDROID_APP_PACKAGES: Record<
  string,
  { pkg: string; fallbackUrl?: string; label: string }
> = {
  whatsapp: {
    pkg: "com.whatsapp",
    fallbackUrl: "whatsapp://app",
    label: "WhatsApp",
  },
  instagram: {
    pkg: "com.instagram.android",
    fallbackUrl: "https://www.instagram.com",
    label: "Instagram",
  },
  telegram: {
    pkg: "org.telegram.messenger",
    fallbackUrl: "https://web.telegram.org",
    label: "Telegram",
  },
  youtube: {
    pkg: "com.google.android.youtube",
    fallbackUrl: "https://www.youtube.com",
    label: "YouTube",
  },
  spotify: {
    pkg: "com.spotify.music",
    fallbackUrl: "https://open.spotify.com",
    label: "Spotify",
  },
  gmail: {
    pkg: "com.google.android.gm",
    fallbackUrl: "mailto:",
    label: "Gmail",
  },
  chrome: {
    pkg: "com.android.chrome",
    fallbackUrl: "https://www.google.com",
    label: "Chrome",
  },
  maps: {
    pkg: "com.google.android.apps.maps",
    fallbackUrl: "https://maps.google.com",
    label: "Google Maps",
  },
  "google maps": {
    pkg: "com.google.android.apps.maps",
    fallbackUrl: "https://maps.google.com",
    label: "Google Maps",
  },
  gpay: {
    pkg: "com.google.android.apps.nbu.paisa.user",
    label: "Google Pay",
  },
  "google pay": {
    pkg: "com.google.android.apps.nbu.paisa.user",
    label: "Google Pay",
  },
  phonepe: {
    pkg: "com.phonepe.app",
    label: "PhonePe",
  },
  paytm: {
    pkg: "net.one97.paytm",
    label: "Paytm",
  },
  bhim: {
    pkg: "in.org.npci.upiapp",
    label: "BHIM UPI",
  },
  swiggy: {
    pkg: "in.swiggy.android",
    fallbackUrl: "https://www.swiggy.com",
    label: "Swiggy",
  },
  zomato: {
    pkg: "com.application.zomato",
    fallbackUrl: "https://www.zomato.com",
    label: "Zomato",
  },
  blinkit: {
    pkg: "com.grofers.customerapp",
    fallbackUrl: "https://blinkit.com",
    label: "Blinkit",
  },
  zepto: {
    pkg: "com.zeptoconsumerapp",
    fallbackUrl: "https://www.zeptonow.com",
    label: "Zepto",
  },
  bigbasket: {
    pkg: "com.bigbasket.mobileapp",
    fallbackUrl: "https://www.bigbasket.com",
    label: "BigBasket",
  },
  amazon: {
    pkg: "in.amazon.mShop.android.shopping",
    fallbackUrl: "https://www.amazon.in",
    label: "Amazon",
  },
  flipkart: {
    pkg: "com.flipkart.android",
    fallbackUrl: "https://www.flipkart.com",
    label: "Flipkart",
  },
  myntra: {
    pkg: "com.myntra.android",
    fallbackUrl: "https://www.myntra.com",
    label: "Myntra",
  },
  uber: {
    pkg: "com.ubercab",
    fallbackUrl: "https://m.uber.com",
    label: "Uber",
  },
  ola: {
    pkg: "com.olacabs.customer",
    fallbackUrl: "https://www.olacabs.com",
    label: "Ola",
  },
  rapido: {
    pkg: "com.rapido.passenger",
    fallbackUrl: "https://www.rapido.bike",
    label: "Rapido",
  },
  irctc: {
    pkg: "cris.org.in.prs.ima",
    fallbackUrl: "https://www.irctc.co.in",
    label: "IRCTC Rail Connect",
  },
  "where is my train": {
    pkg: "com.whereismytrain.android",
    label: "Where is my Train",
  },
  whereismytrain: {
    pkg: "com.whereismytrain.android",
    label: "Where is my Train",
  },
  calculator: {
    pkg: "com.google.android.calculator",
    label: "Calculator",
  },
  calendar: {
    pkg: "com.google.android.calendar",
    label: "Calendar",
  },
  clock: {
    pkg: "com.google.android.deskclock",
    label: "Clock",
  },
  files: {
    pkg: "com.google.android.apps.nbu.files",
    label: "Files",
  },
  playstore: {
    pkg: "com.android.vending",
    fallbackUrl: "https://play.google.com/store",
    label: "Play Store",
  },
  "play store": {
    pkg: "com.android.vending",
    fallbackUrl: "https://play.google.com/store",
    label: "Play Store",
  },
  linkedin: {
    pkg: "com.linkedin.android",
    fallbackUrl: "https://www.linkedin.com",
    label: "LinkedIn",
  },
  x: {
    pkg: "com.twitter.android",
    fallbackUrl: "https://x.com",
    label: "X (Twitter)",
  },
  twitter: {
    pkg: "com.twitter.android",
    fallbackUrl: "https://x.com",
    label: "Twitter",
  },
};

export async function openMapsNavigation(input: {
  destination: string;
  mode?: "navigate" | "search";
  travelMode?: "driving" | "two-wheeler" | "walking" | "transit";
}): Promise<{ ok: boolean; summary?: string; error?: string }> {
  const dest = input.destination.trim();
  if (!dest) {
    return { ok: false, error: "Destination or search query is required." };
  }

  const mode = input.mode === "search" ? "search" : "navigate";
  const travel = input.travelMode || "driving";
  const encoded = encodeURIComponent(dest);

  const webSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  const webDirUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=${
    travel === "two-wheeler" ? "driving" : travel
  }`;

  try {
    if (Platform.OS === "android") {
      if (mode === "navigate") {
        const navCode =
          travel === "walking"
            ? "w"
            : travel === "two-wheeler"
            ? "l"
            : "d";
        const androidNavUri =
          travel === "transit"
            ? webDirUrl
            : `google.navigation:q=${encoded}&mode=${navCode}`;
        const canNav = await Linking.canOpenURL(androidNavUri);
        await Linking.openURL(canNav ? androidNavUri : webDirUrl);
      } else {
        const geoUri = `geo:0,0?q=${encoded}`;
        const canGeo = await Linking.canOpenURL(geoUri);
        await Linking.openURL(canGeo ? geoUri : webSearchUrl);
      }
    } else if (Platform.OS === "ios") {
      const gmapsScheme =
        mode === "navigate"
          ? `comgooglemaps://?daddr=${encoded}&directionsmode=${
              travel === "two-wheeler" ? "driving" : travel
            }`
          : `comgooglemaps://?q=${encoded}`;
      const appleMapsUrl =
        mode === "navigate"
          ? `http://maps.apple.com/?daddr=${encoded}`
          : `http://maps.apple.com/?q=${encoded}`;
      const canGmaps = await Linking.canOpenURL(gmapsScheme);
      await Linking.openURL(canGmaps ? gmapsScheme : appleMapsUrl);
    } else {
      await Linking.openURL(mode === "navigate" ? webDirUrl : webSearchUrl);
    }

    return {
      ok: true,
      summary:
        mode === "navigate"
          ? `Opened Maps navigation to "${dest}"`
          : `Opened Maps search for "${dest}"`,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not launch Maps on device.",
    };
  }
}

export async function openAppOrMediaSearch(input: {
  target: "youtube" | "spotify" | "google_search" | "open_url" | "app";
  queryOrAppName: string;
  packageName?: string;
}): Promise<{ ok: boolean; summary?: string; error?: string }> {
  const raw = input.queryOrAppName.trim();
  if (!raw) {
    return { ok: false, error: "queryOrAppName cannot be empty." };
  }

  try {
    if (input.target === "youtube") {
      const encoded = encodeURIComponent(raw);
      const nativeUrl = `vnd.youtube://results?search_query=${encoded}`;
      const webUrl = `https://www.youtube.com/results?search_query=${encoded}`;
      const canNative =
        Platform.OS !== "web" && (await Linking.canOpenURL(nativeUrl));
      await Linking.openURL(canNative ? nativeUrl : webUrl);
      return { ok: true, summary: `Opened YouTube: "${raw}"` };
    }

    if (input.target === "spotify") {
      const encoded = encodeURIComponent(raw);
      const nativeUrl = `spotify:search:${encoded}`;
      const webUrl = `https://open.spotify.com/search/${encoded}`;
      const canNative =
        Platform.OS !== "web" && (await Linking.canOpenURL(nativeUrl));
      await Linking.openURL(canNative ? nativeUrl : webUrl);
      return { ok: true, summary: `Opened Spotify: "${raw}"` };
    }

    if (input.target === "google_search") {
      const url = `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
      await Linking.openURL(url);
      return { ok: true, summary: `Searched Google: "${raw}"` };
    }

    if (input.target === "open_url") {
      const normalizedUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      await Linking.openURL(normalizedUrl);
      return { ok: true, summary: `Opened URL: ${normalizedUrl}` };
    }

    // target === "app"
    const key = raw.toLowerCase().trim();

    if (key === "camera" && Platform.OS === "android") {
      await IntentLauncher.startActivityAsync(
        "android.media.action.IMAGE_CAPTURE"
      );
      return { ok: true, summary: "Opened Camera" };
    }
    if (key === "settings") {
      if (Platform.OS === "android") {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.SETTINGS
        );
      } else {
        await Linking.openSettings();
      }
      return { ok: true, summary: "Opened System Settings" };
    }

    const mapped = ANDROID_APP_PACKAGES[key];
    const targetPkg = input.packageName?.trim() || mapped?.pkg;
    const displayLabel = mapped?.label || raw;

    if (Platform.OS === "android" && targetPkg) {
      try {
        IntentLauncher.openApplication(targetPkg);
        return { ok: true, summary: `Launched ${displayLabel}` };
      } catch {
        // Fallback below if app isn't installed
      }
    }

    if (mapped?.fallbackUrl) {
      await Linking.openURL(mapped.fallbackUrl);
      return {
        ok: true,
        summary: `Opened ${displayLabel}`,
      };
    }

    return {
      ok: false,
      error: `Could not launch "${raw}". It may not be installed on this phone (or requires custom APK package visibility for unlisted apps).`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : `Unable to open "${raw}".`,
    };
  }
}

function mapBatteryState(state: Battery.BatteryState): string {
  switch (state) {
    case Battery.BatteryState.CHARGING:
      return "Charging ⚡";
    case Battery.BatteryState.FULL:
      return "Full (100%)";
    case Battery.BatteryState.UNPLUGGED:
      return "Unplugged (On Battery)";
    default:
      return "Unknown";
  }
}

export async function executeSystemControl(input: {
  action:
    | "battery_status"
    | "get_brightness"
    | "set_brightness"
    | "restore_auto_brightness"
    | "open_settings";
  brightnessPercent?: number;
  settingsPanel?: string;
}): Promise<{
  ok: boolean;
  summary?: string;
  details?: Record<string, unknown>;
  error?: string;
}> {
  try {
    if (input.action === "battery_status") {
      if (Platform.OS === "web") {
        return {
          ok: false,
          error: "Battery telemetry requires the Android or iOS app.",
        };
      }
      const power = await Battery.getPowerStateAsync();
      const pct =
        power.batteryLevel >= 0 ? Math.round(power.batteryLevel * 100) : null;
      const stateLabel = mapBatteryState(power.batteryState);

      return {
        ok: true,
        summary:
          pct !== null
            ? `Battery: ${pct}% · ${stateLabel}`
            : `Battery: ${stateLabel}`,
        details: {
          batteryPercent: pct,
          state: stateLabel,
          lowPowerMode: Boolean(power.lowPowerMode),
        },
      };
    }

    if (input.action === "get_brightness") {
      if (Platform.OS === "web") {
        return {
          ok: false,
          error: "Screen brightness control requires Android or iOS.",
        };
      }
      const val = await Brightness.getBrightnessAsync();
      const pct = Math.round(val * 100);
      return {
        ok: true,
        summary: `Screen brightness: ${pct}%`,
        details: { brightnessPercent: pct },
      };
    }

    if (input.action === "set_brightness") {
      if (Platform.OS === "web") {
        return {
          ok: false,
          error: "Screen brightness control requires Android or iOS.",
        };
      }
      const rawPct =
        typeof input.brightnessPercent === "number" &&
        !Number.isNaN(input.brightnessPercent)
          ? input.brightnessPercent
          : 50;
      const clampedPct = Math.max(1, Math.min(100, Math.round(rawPct)));
      await Brightness.setBrightnessAsync(clampedPct / 100);
      return {
        ok: true,
        summary: `Brightness set to ${clampedPct}%`,
        details: { brightnessPercent: clampedPct },
      };
    }

    if (input.action === "restore_auto_brightness") {
      if (Platform.OS === "android") {
        await Brightness.restoreSystemBrightnessAsync();
      }
      return {
        ok: true,
        summary: "Restored system screen brightness",
      };
    }

    if (input.action === "open_settings") {
      const panel = (input.settingsPanel || "main").toLowerCase();
      if (Platform.OS === "android") {
        const panelActionMap: Record<string, IntentLauncher.ActivityAction> = {
          main: IntentLauncher.ActivityAction.SETTINGS,
          wifi: IntentLauncher.ActivityAction.WIFI_SETTINGS,
          bluetooth: IntentLauncher.ActivityAction.BLUETOOTH_SETTINGS,
          location: IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS,
          display: IntentLauncher.ActivityAction.DISPLAY_SETTINGS,
          sound: IntentLauncher.ActivityAction.SOUND_SETTINGS,
          airplane: IntentLauncher.ActivityAction.AIRPLANE_MODE_SETTINGS,
          mobile_data: IntentLauncher.ActivityAction.DATA_ROAMING_SETTINGS,
          battery_saver: IntentLauncher.ActivityAction.BATTERY_SAVER_SETTINGS,
          storage: IntentLauncher.ActivityAction.INTERNAL_STORAGE_SETTINGS,
          apps: IntentLauncher.ActivityAction.APPLICATION_SETTINGS,
          security: IntentLauncher.ActivityAction.SECURITY_SETTINGS,
        };
        const chosenAction =
          panelActionMap[panel] || IntentLauncher.ActivityAction.SETTINGS;
        await IntentLauncher.startActivityAsync(chosenAction);
        return {
          ok: true,
          summary: `Opened ${panel.replace("_", " ")} Settings`,
        };
      }

      await Linking.openSettings();
      return {
        ok: true,
        summary: "Opened System Settings",
      };
    }

    return { ok: false, error: `Unsupported action: ${input.action}` };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "System hardware action failed.",
    };
  }
}

export async function executeClipboardTool(input: {
  action: "read" | "copy";
  textToCopy?: string;
}): Promise<{
  ok: boolean;
  clipboardText?: string;
  summary?: string;
  error?: string;
}> {
  try {
    if (input.action === "copy") {
      const text = (input.textToCopy || "").trim();
      if (!text) {
        return { ok: false, error: "textToCopy cannot be empty." };
      }
      await Clipboard.setStringAsync(text);
      return {
        ok: true,
        summary: "Copied to phone clipboard",
      };
    }

    const current = await Clipboard.getStringAsync();
    return {
      ok: true,
      clipboardText: current ? current.slice(0, 8000) : "",
      summary: current
        ? `Read clipboard (${current.length} chars)`
        : "Clipboard is empty",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Clipboard access failed.",
    };
  }
}

function makeAttachmentId(): string {
  return `gal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function fetchLatestGalleryImage(input: {
  filter?: "screenshot" | "any";
  offset?: number;
}): Promise<{
  ok: boolean;
  attachment?: Attachment;
  summary?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}> {
  if (Platform.OS === "web") {
    return {
      ok: false,
      error:
        "Automatic gallery/screenshot lookup requires the Android or iOS app. On web, attach images with the + button.",
    };
  }

  try {
    const existing = await getMediaPermissionsAsync(false, ["photo"]);
    let granted = existing.granted;
    if (!granted) {
      const requested = await requestMediaPermissionsAsync(false, ["photo"]);
      granted = requested.granted;
    }

    if (!granted) {
      return {
        ok: false,
        error:
          "Photos/Gallery permission denied. Please grant Photo Library permission so Friday can inspect screenshots.",
      };
    }

    const wantScreenshot = input.filter === "screenshot";
    const safeOffset =
      typeof input.offset === "number" &&
      !Number.isNaN(input.offset) &&
      input.offset >= 0
        ? Math.min(10, Math.floor(input.offset))
        : 0;

    const assets = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
      .limit(wantScreenshot ? 20 : Math.max(5, safeOffset + 2))
      .exe();

    if (assets.length === 0) {
      return {
        ok: false,
        error: "No images found in your photo gallery.",
      };
    }

    let pickedAsset = assets[Math.min(safeOffset, assets.length - 1)];
    let pickedFilename = await pickedAsset.getFilename();

    if (wantScreenshot) {
      const screenshotCandidates: Array<{
        asset: (typeof assets)[number];
        filename: string;
      }> = [];

      for (const candidate of assets) {
        const fname = await candidate.getFilename();
        if (/screenshot|screen_shot|scrn|capture/i.test(fname)) {
          screenshotCandidates.push({ asset: candidate, filename: fname });
        }
      }

      if (screenshotCandidates.length > 0) {
        const chosen =
          screenshotCandidates[
            Math.min(safeOffset, screenshotCandidates.length - 1)
          ];
        pickedAsset = chosen.asset;
        pickedFilename = chosen.filename;
      }
    }

    const [uri, width, height, creationSec] = await Promise.all([
      pickedAsset.getUri(),
      pickedAsset.getWidth(),
      pickedAsset.getHeight(),
      pickedAsset.getCreationTime(),
    ]);

    const lowerName = pickedFilename.toLowerCase();
    const mimeType = lowerName.endsWith(".png")
      ? "image/png"
      : lowerName.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

    let base64 = "";
    try {
      const directFile = new File(uri);
      base64 = await directFile.base64();
    } catch {
      // Fallback: copy content:// or ph:// URI into app cache first, then read base64
      const ext = mimeType === "image/png" ? "png" : "jpg";
      const tempCopy = new File(
        Paths.cache,
        `friday_gallery_${Date.now()}.${ext}`
      );
      const srcFile = new File(uri);
      srcFile.copy(tempCopy);
      base64 = await tempCopy.base64();
      try {
        tempCopy.delete();
      } catch {
        // Ignore temp cleanup error
      }
    }

    const approxBytes = Math.round((base64.length * 3) / 4);
    if (approxBytes > 20 * 1024 * 1024) {
      return {
        ok: false,
        error: `"${pickedFilename}" is larger than the 20 MB limit.`,
      };
    }

    const attachment: Attachment = {
      id: makeAttachmentId(),
      name: pickedFilename || "gallery-image.jpg",
      type: mimeType,
      size: approxBytes,
      dataUrl: `data:${mimeType};base64,${base64}`,
      uri,
    };

    const createdAtLabel = creationSec
      ? new Date(creationSec * 1000).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : undefined;

    return {
      ok: true,
      attachment,
      summary: `Loaded gallery image: ${attachment.name}`,
      metadata: {
        filename: attachment.name,
        dimensions: `${width}x${height}`,
        capturedAt: createdAtLabel,
        note: "The image is now attached to this turn and will be visually analyzed immediately.",
      },
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Could not read latest image from gallery.",
    };
  }
}
