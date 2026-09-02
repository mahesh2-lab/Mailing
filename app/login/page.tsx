"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/src/lib/auth-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/inbox";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    await authClient.signIn.email(
      { email, password, callbackURL: "/inbox" },
      {
        onSuccess: () => {
          router.push(callbackUrl);
          router.refresh();
        },
        onError: (ctx) => {
          setIsLoading(false);
          setError(
            ctx.error.message ||
              "Failed to sign in. Please check your credentials.",
          );
        },
      },
    );
    setIsLoading(false);
  };

  return (
    <div style={{ width: "100%", maxWidth: 360 }}>
      {}
      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: "var(--brand)",
              color: "var(--brand-fg)",
              display: "grid",
              placeItems: "center",
              borderRadius: 7,
              boxShadow: "0 1px 3px rgba(99,102,241,0.35)",
              flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="3"/>
              <path d="M2 7l10 7 10-7"/>
            </svg>
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--foreground)",
            }}
          >
            Mailing
          </span>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-geist-sans)",
            fontWeight: 600,
            fontSize: 24,
            letterSpacing: "-0.03em",
            color: "var(--foreground)",
            margin: "0 0 8px",
            lineHeight: 1.25,
          }}
        >
          Sign in
        </h1>
        <p
          style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}
        >
          Enter your credentials to access your workspace.
        </p>
      </div>

      {}
      {error && (
        <div
          className="bg-destructive/10 border border-destructive/20 text-destructive"
          style={{
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 0 }}
      >
        {}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="email"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--foreground)",
              marginBottom: 8,
            }}
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            suppressHydrationWarning
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: "100%",
              height: 40,
              border: "1px solid var(--border)",
              background: "var(--background)",
              color: "var(--foreground)",
              padding: "0 12px",
              fontSize: 14,
              borderRadius: "6px",
              outline: "none",
              transition: "border-color 0.15s, box-shadow 0.15s",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--foreground)";
              e.target.style.boxShadow = "0 0 0 1px var(--foreground)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border)";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>

        {}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <label
              htmlFor="password"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--foreground)",
              }}
            >
              Password
            </label>
            <a
              href="#"
              style={{
                fontSize: 11,
                color: "var(--muted-foreground)",
                textDecoration: "underline",
              }}
            >
              Forgot password?
            </a>
          </div>
          <div style={{ position: "relative" }}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              suppressHydrationWarning
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              style={{
                width: "100%",
                height: 40,
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
                padding: "0 40px 0 12px",
                fontSize: 14,
                borderRadius: "6px",
                outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--foreground)";
                e.target.style.boxShadow = "0 0 0 1px var(--foreground)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border)";
                e.target.style.boxShadow = "none";
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                height: 38,
                width: 38,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted-foreground)",
                display: "grid",
                placeItems: "center",
                padding: 0,
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {}
        <button
          type="submit"
          disabled={isLoading}
          className={`compose-button${isLoading ? " auth-btn-loading" : ""}`}
          style={{
            width: "100%",
            height: 40,
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Sign in
        </button>
      </form>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          marginTop: 28,
          paddingTop: 18,
          fontSize: 12,
          color: "var(--muted-foreground)",
          display: "flex",
          gap: 4,
        }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          style={{
            color: "var(--foreground)",
            fontWeight: 600,
            textDecoration: "underline",
          }}
        >
          Create one
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        display: "flex",
      }}
    >
      {}
      <div
        className="auth-brand-col"
        style={{
          display: "none",
          width: 420,
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          padding: "48px 52px",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "var(--card)",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginBottom: 52,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                background: "var(--brand)",
                color: "var(--brand-fg)",
                display: "grid",
                placeItems: "center",
                borderRadius: 8,
                boxShadow: "0 2px 6px rgba(99,102,241,0.4)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="3"/>
                <path d="M2 7l10 7 10-7"/>
              </svg>
            </div>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--foreground)",
              }}
            >
              Mailing
            </span>
          </div>

          <p
            style={{
              fontFamily: "var(--font-geist-sans)",
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              color: "var(--foreground)",
              margin: "0 0 32px",
              maxWidth: 300,
            }}
          >
            Your workspace for every conversation that matters.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {[
              {
                label: "Unified inbox",
                desc: "All your email in one fast, focused view.",
              },
              {
                label: "Smart labels",
                desc: "Organise automatically with rules and automations.",
              },
              {
                label: "Keyboard-first",
                desc: "Full keyboard navigation — zero mouse required.",
              },
            ].map((f) => (
              <div
                key={f.label}
                style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    background: "var(--primary)",
                    borderRadius: "50%",
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--foreground)",
                      margin: "0 0 2px",
                    }}
                  >
                    {f.label}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      margin: 0,
                    }}
                  >
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p
          style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}
        >
          © 2026 Mailing — All rights reserved.
        </p>
      </div>

      {}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>

      <style>{`
        @media (min-width: 860px) {
          .auth-brand-col { display: flex !important; }
        }
        input[type="email"]::placeholder,
        input[type="password"]::placeholder,
        input[type="text"]::placeholder {
          color: var(--muted-foreground);
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}
