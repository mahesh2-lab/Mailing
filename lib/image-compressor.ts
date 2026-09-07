/**
 * Client-side Image Compressor and Restriction Utility
 * 
 * Prevents FUNCTION_PAYLOAD_TOO_LARGE and database/session bloat by
 * validating and compressing user images client-side before upload.
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

// 15 MB raw input restriction before client-side compression
export const DEFAULT_MAX_INPUT_SIZE_BYTES = 15 * 1024 * 1024;

// 150 KB target output size for avatars/profile icons (sharp 400x400 WebP is typically 20-50 KB)
export const DEFAULT_TARGET_OUTPUT_SIZE_BYTES = 150 * 1024;

// Server payload threshold: 500 KB limit for base64 image strings
export const SERVER_MAX_IMAGE_PAYLOAD_BYTES = 500 * 1024;

export interface ImageValidationOptions {
  maxSizeBytes?: number;
  allowedTypes?: string[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  cropToSquare?: boolean;
  outputType?: "image/webp" | "image/jpeg" | "image/png";
  maxOutputSizeBytes?: number;
}

export interface CompressionResult {
  dataUrl: string;
  blob: Blob;
  file: File;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  savedPercentage: number;
  formattedOriginalSize: string;
  formattedCompressedSize: string;
}

/**
 * Format bytes into human-readable strings (e.g. "45 KB", "1.2 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Validate an input image File before attempting to load or compress it.
 */
export function validateImageFile(
  file: File | Blob | null | undefined,
  options?: ImageValidationOptions
): ValidationResult {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  const allowedTypes = options?.allowedTypes || ALLOWED_IMAGE_TYPES;
  const maxSizeBytes = options?.maxSizeBytes || DEFAULT_MAX_INPUT_SIZE_BYTES;

  // Verify MIME type
  const mime = (file.type || "").toLowerCase();
  const isValidType = allowedTypes.some((t) =>
    t === "image/*" ? mime.startsWith("image/") : mime === t.toLowerCase()
  );

  if (!isValidType) {
    return {
      valid: false,
      error: `Invalid file format. Please upload a PNG, JPG, WebP, or GIF image.`,
    };
  }

  // Verify file size
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File is too large (${formatFileSize(file.size)}). Maximum allowed size is ${formatFileSize(maxSizeBytes)}.`,
    };
  }

  return { valid: true };
}

/**
 * Validates a profile image string (data URL or external URL) for server routes.
 */
export function validateProfileImagePayload(
  imageStr: string | null | undefined,
  maxSizeBytes: number = SERVER_MAX_IMAGE_PAYLOAD_BYTES
): ValidationResult {
  if (!imageStr || !imageStr.trim()) {
    return { valid: true };
  }

  const trimmed = imageStr.trim();

  // If HTTP/HTTPS URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    if (trimmed.length > 2048) {
      return { valid: false, error: "Image URL exceeds maximum length (2048 characters)." };
    }
    return { valid: true };
  }

  // If Data URI
  if (trimmed.startsWith("data:image/")) {
    const parts = trimmed.split(",");
    if (parts.length < 2) {
      return { valid: false, error: "Malformed image data URI." };
    }

    // Rough byte size of base64 content
    const base64Len = parts[1].length;
    const approximateBytes = Math.floor((base64Len * 3) / 4);

    if (approximateBytes > maxSizeBytes) {
      return {
        valid: false,
        error: `Profile image exceeds maximum size limit (${formatFileSize(maxSizeBytes)}). Please compress the image before saving.`,
      };
    }

    return { valid: true };
  }

  return {
    valid: false,
    error: "Invalid image format. Must be a valid image data URI or URL.",
  };
}

/**
 * Client-side Canvas Image Compression
 *
 * Resizes, center-crops (for avatars), and compresses image to lightweight WebP/JPEG.
 */
export async function compressImage(
  source: File | Blob,
  options?: ImageCompressionOptions
): Promise<CompressionResult> {
  const {
    maxWidth = 400,
    maxHeight = 400,
    quality = 0.82,
    cropToSquare = true,
    outputType = "image/webp",
    maxOutputSizeBytes = DEFAULT_TARGET_OUTPUT_SIZE_BYTES,
  } = options || {};

  // 1. Validate input
  const validation = validateImageFile(source);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Ensure browser environment
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Client-side image compression must be executed in a browser environment.");
  }

  const originalSize = source.size;
  const originalFileName = source instanceof File ? source.name : "image.webp";

  // 2. Load image into HTMLImageElement
  const objectUrl = URL.createObjectURL(source);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image for compression."));
    image.src = objectUrl;
  });

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) {
      throw new Error("Could not initialize 2D canvas context for image processing.");
    }

    let srcX = 0;
    let srcY = 0;
    let srcWidth = img.naturalWidth || img.width;
    let srcHeight = img.naturalHeight || img.height;

    let destWidth = srcWidth;
    let destHeight = srcHeight;

    if (cropToSquare) {
      // Center-crop to square for profile avatars
      const minDim = Math.min(srcWidth, srcHeight);
      srcX = Math.floor((srcWidth - minDim) / 2);
      srcY = Math.floor((srcHeight - minDim) / 2);
      srcWidth = minDim;
      srcHeight = minDim;

      const targetDim = Math.min(minDim, maxWidth, maxHeight);
      destWidth = targetDim;
      destHeight = targetDim;
    } else {
      // Maintain aspect ratio
      const scale = Math.min(1, maxWidth / srcWidth, maxHeight / srcHeight);
      destWidth = Math.max(1, Math.round(srcWidth * scale));
      destHeight = Math.max(1, Math.round(srcHeight * scale));
    }

    canvas.width = destWidth;
    canvas.height = destHeight;

    // Enable high-quality downsampling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw cropped / scaled image
    ctx.drawImage(
      img,
      srcX,
      srcY,
      srcWidth,
      srcHeight,
      0,
      0,
      destWidth,
      destHeight
    );

    // Iterative quality adjustment if result exceeds target size
    let currentQuality = quality;
    let dataUrl = canvas.toDataURL(outputType, currentQuality);

    // If browser doesn't support WebP export, fallback to JPEG
    if (outputType === "image/webp" && !dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", currentQuality);
    }

    // Helper to estimate base64 byte size
    const getBase64Bytes = (dUrl: string) => {
      const b64 = dUrl.split(",")[1] || "";
      return Math.floor((b64.length * 3) / 4);
    };

    let attempts = 0;
    while (getBase64Bytes(dataUrl) > maxOutputSizeBytes && attempts < 4 && currentQuality > 0.35) {
      currentQuality = Math.max(0.35, currentQuality - 0.15);
      dataUrl = canvas.toDataURL(outputType, currentQuality);
      attempts++;
    }

    // Convert dataUrl to Blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const compressedSize = blob.size;

    // Generate output filename with new extension
    const ext = outputType === "image/webp" ? ".webp" : outputType === "image/jpeg" ? ".jpg" : ".png";
    const nameWithoutExt = originalFileName.substring(0, originalFileName.lastIndexOf(".")) || originalFileName;
    const finalFileName = `${nameWithoutExt}${ext}`;

    const compressedFile = new File([blob], finalFileName, {
      type: blob.type || outputType,
      lastModified: Date.now(),
    });

    const savedPercentage = originalSize > 0
      ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
      : 0;

    return {
      dataUrl,
      blob,
      file: compressedFile,
      width: destWidth,
      height: destHeight,
      originalSize,
      compressedSize,
      savedPercentage,
      formattedOriginalSize: formatFileSize(originalSize),
      formattedCompressedSize: formatFileSize(compressedSize),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
