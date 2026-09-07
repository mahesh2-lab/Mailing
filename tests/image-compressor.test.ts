import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateImageFile,
  validateProfileImagePayload,
  formatFileSize,
  compressImage,
  ALLOWED_IMAGE_TYPES,
  DEFAULT_MAX_INPUT_SIZE_BYTES,
  SERVER_MAX_IMAGE_PAYLOAD_BYTES,
} from "../lib/image-compressor";

describe("Image Compressor & Restrictions Utility", () => {
  describe("formatFileSize", () => {
    it("formats 0 bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 B");
    });

    it("formats bytes, kilobytes and megabytes correctly", () => {
      expect(formatFileSize(500)).toBe("500 B");
      expect(formatFileSize(1024)).toBe("1.0 KB");
      expect(formatFileSize(150 * 1024)).toBe("150.0 KB");
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    });
  });

  describe("validateImageFile", () => {
    it("rejects null or undefined files", () => {
      expect(validateImageFile(null).valid).toBe(false);
      expect(validateImageFile(undefined).valid).toBe(false);
    });

    it("accepts valid image MIME types", () => {
      for (const type of ALLOWED_IMAGE_TYPES) {
        const file = new File(["dummy data"], `avatar.${type.split("/")[1]}`, { type });
        const result = validateImageFile(file);
        expect(result.valid).toBe(true);
      }
    });

    it("rejects non-image files like text, pdf, or exe", () => {
      const pdf = new File(["%PDF-1.4"], "document.pdf", { type: "application/pdf" });
      const txt = new File(["hello world"], "notes.txt", { type: "text/plain" });
      const exe = new File(["binary"], "app.exe", { type: "application/x-msdownload" });

      expect(validateImageFile(pdf).valid).toBe(false);
      expect(validateImageFile(pdf).error).toContain("Invalid file format");
      expect(validateImageFile(txt).valid).toBe(false);
      expect(validateImageFile(exe).valid).toBe(false);
    });

    it("rejects files that exceed the maximum input size limit", () => {
      // Create a mock large file
      const largeFile = {
        name: "huge.png",
        type: "image/png",
        size: DEFAULT_MAX_INPUT_SIZE_BYTES + 1024,
      } as File;

      const result = validateImageFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File is too large");
    });

    it("respects custom maxSizeBytes and allowedTypes options", () => {
      const file = new File(["test"], "photo.png", { type: "image/png" });
      
      // Allow only jpeg
      const typeResult = validateImageFile(file, { allowedTypes: ["image/jpeg"] });
      expect(typeResult.valid).toBe(false);

      // Custom small size limit (2 bytes)
      const sizeResult = validateImageFile(file, { maxSizeBytes: 2 });
      expect(sizeResult.valid).toBe(false);
      expect(sizeResult.error).toContain("File is too large");
    });
  });

  describe("validateProfileImagePayload", () => {
    it("accepts empty or null string because image is optional", () => {
      expect(validateProfileImagePayload(null).valid).toBe(true);
      expect(validateProfileImagePayload("").valid).toBe(true);
      expect(validateProfileImagePayload("   ").valid).toBe(true);
    });

    it("accepts valid HTTP/HTTPS image URLs", () => {
      expect(validateProfileImagePayload("https://avatar.example.com/me.png").valid).toBe(true);
      expect(validateProfileImagePayload("http://res.cloudinary.com/user.jpg").valid).toBe(true);
      expect(validateProfileImagePayload("/avatars/default.png").valid).toBe(true);
    });

    it("rejects excessively long URLs", () => {
      const longUrl = "https://example.com/" + "a".repeat(2100);
      expect(validateProfileImagePayload(longUrl).valid).toBe(false);
    });

    it("accepts valid, compact data URIs under payload limit", () => {
      // 100 bytes base64 data URI
      const validDataUri = "data:image/webp;base64," + "A".repeat(120);
      expect(validateProfileImagePayload(validDataUri).valid).toBe(true);
    });

    it("rejects oversized data URIs exceeding max payload limit", () => {
      // Server max payload is 500 KB, so ~700,000 base64 chars
      const oversizedBase64 = "data:image/jpeg;base64," + "A".repeat(800 * 1024);
      const result = validateProfileImagePayload(oversizedBase64);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum size limit");
    });

    it("rejects malformed data URIs and invalid strings", () => {
      expect(validateProfileImagePayload("data:image/jpeg").valid).toBe(false);
      expect(validateProfileImagePayload("not-a-valid-image-format").valid).toBe(false);
    });
  });

  describe("compressImage in browser environment", () => {
    it("throws clear error if executed outside a browser environment", async () => {
      // Temporarily simulate non-browser environment
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      const file = new File(["dummy"], "photo.png", { type: "image/png" });
      await expect(compressImage(file)).rejects.toThrow("must be executed in a browser environment");

      global.window = originalWindow;
    });
  });
});
