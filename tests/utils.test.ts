import { describe, it, expect } from "vitest";
import { extractErrorMessage, getInitials, avatarColor, escapeHtml } from "@/lib/utils";

describe("extractErrorMessage", () => {
  it("extracts message from standard Error", () => {
    expect(extractErrorMessage(new Error("Network timeout"))).toBe("Network timeout");
  });

  it("extracts error from string", () => {
    expect(extractErrorMessage("Something went wrong")).toBe("Something went wrong");
  });

  it("extracts error from Axios-like response object with data.error", () => {
    const axiosError = {
      response: {
        data: {
          error: "Invalid API key format",
        },
      },
      message: "Request failed with status code 400",
    };
    expect(extractErrorMessage(axiosError)).toBe("Invalid API key format");
  });

  it("extracts error from Axios-like response object with data.message", () => {
    const axiosError = {
      response: {
        data: {
          message: "Rate limit exceeded",
        },
      },
      message: "Request failed with status code 429",
    };
    expect(extractErrorMessage(axiosError)).toBe("Rate limit exceeded");
  });

  it("extracts error from Axios-like response object with raw string data", () => {
    const axiosError = {
      response: {
        data: "Bad Gateway",
      },
      message: "Request failed with status code 502",
    };
    expect(extractErrorMessage(axiosError)).toBe("Bad Gateway");
  });

  it("falls back to error.message if response data has no error field", () => {
    const axiosError = {
      response: {
        data: {},
      },
      message: "Network Error",
    };
    expect(extractErrorMessage(axiosError)).toBe("Network Error");
  });

  it("falls back to provided fallback when error is empty or null", () => {
    expect(extractErrorMessage(null, "Default fallback")).toBe("Default fallback");
    expect(extractErrorMessage(undefined, "Default fallback")).toBe("Default fallback");
    expect(extractErrorMessage("", "Default fallback")).toBe("Default fallback");
  });

  it("handles plain object with message property", () => {
    expect(extractErrorMessage({ message: "Custom object error" })).toBe("Custom object error");
  });
});

describe("utils helpers", () => {
  it("computes initials correctly", () => {
    expect(getInitials("John Doe")).toBe("JD");
    expect(getInitials("Alice")).toBe("AL");
  });

  it("computes avatar color consistently", () => {
    const c1 = avatarColor("test@example.com");
    const c2 = avatarColor("test@example.com");
    expect(c1).toBe(c2);
    expect(c1.startsWith("#")).toBe(true);
  });

  it("escapes html characters", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
    );
  });
});
