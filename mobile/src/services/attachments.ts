import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import type { Attachment } from "../types";

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function pickImagesFromLibrary(): Promise<Attachment[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Gallery permission is required to attach images.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: 3,
    quality: 0.8,
    base64: true,
  });

  if (result.canceled || !result.assets?.length) return [];

  return result.assets
    .filter((asset) => Boolean(asset.base64 || asset.uri))
    .map((asset, idx) => {
      const mimeType = asset.mimeType || "image/jpeg";
      const dataUrl = asset.base64
        ? `data:${mimeType};base64,${asset.base64}`
        : asset.uri;
      const name =
        asset.fileName ||
        `image-${idx + 1}.${mimeType.split("/")[1] || "jpg"}`;
      const approxBytes =
        asset.fileSize ||
        (asset.base64 ? Math.round((asset.base64.length * 3) / 4) : 0);

      return {
        id: makeId(),
        name,
        type: mimeType,
        size: approxBytes,
        dataUrl,
        uri: asset.uri,
      };
    });
}

export async function pickPdfDocuments(): Promise<Attachment[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return [];

  const attachments: Attachment[] = [];

  for (const asset of result.assets) {
    if (asset.size && asset.size > 20 * 1024 * 1024) {
      throw new Error(`"${asset.name}" exceeds the 20 MB limit.`);
    }

    let dataUrl = "";
    if (Platform.OS === "web") {
      // On web, asset.uri is already a data URL or blob URL
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      dataUrl = `data:application/pdf;base64,${base64}`;
    }

    attachments.push({
      id: makeId(),
      name: asset.name || "document.pdf",
      type: "application/pdf",
      size: asset.size || Math.round((dataUrl.length * 3) / 4),
      dataUrl,
      uri: asset.uri,
    });
  }

  return attachments;
}
