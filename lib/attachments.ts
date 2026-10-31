import { extractTextFromPdf } from "@/lib/pdf";
import type { Attachment } from "@/lib/types";

/**
 * Reads a File object and processes it into an Attachment with dataUrl
 * and, if applicable, extracted text (for PDFs) and optimized size (for images).
 */
export async function processUploadedFile(file: File): Promise<Attachment> {
  const id = crypto.randomUUID();
  const name = file.name;
  const type = file.type || (name.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
  const size = file.size;

  if (type.startsWith("image/")) {
    const dataUrl = await optimizeImage(file);
    return {
      id,
      name,
      type,
      size,
      dataUrl,
    };
  }

  if (type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    const arrayBuffer = await file.arrayBuffer();
    const dataUrl = await fileToDataUrl(file);
    let extractedText = "";
    try {
      extractedText = await extractTextFromPdf(arrayBuffer);
    } catch (e) {
      console.warn("Could not extract text from PDF in browser:", e);
    }

    return {
      id,
      name,
      type: "application/pdf",
      size,
      dataUrl,
      extractedText: extractedText.trim() || undefined,
    };
  }

  // Fallback for any other file
  const dataUrl = await fileToDataUrl(file);
  return {
    id,
    name,
    type,
    size,
    dataUrl,
  };
}

/**
 * Standard FileReader to DataURL conversion
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Optimizes large images using canvas to prevent exceeding localStorage quota
 * while preserving high fidelity.
 */
async function optimizeImage(file: File): Promise<string> {
  // If image is already reasonably small (< 800KB), return direct dataUrl
  if (file.size < 800 * 1024 && !file.type.includes("tiff")) {
    return fileToDataUrl(file);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Use JPEG for photographic formats, preserve PNG for transparency if needed
        const outFormat = file.type === "image/png" ? "image/png" : "image/jpeg";
        const compressed = canvas.toDataURL(outFormat, 0.88);
        resolve(compressed);
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}
