"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/src/lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    await authClient.signUp.email(
      { name, email, password },
      {
        onSuccess: () => {
          router.push("/inbox");
          router.refresh();
        },
        onError: (ctx) => {
          setIsLoading(false);
          setError(ctx.error.message || "Failed to create account. Please try again.");
        },
      }
    );
    setIsLoading(false);
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--muted-foreground)",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 38,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--foreground)",
    padding: "0 12px",
    fontSize: 13,
    outline: "none",
    transition: "border-color 0.12s",
    boxSizing: "border-box",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) =>
    (e.target.style.borderColor = "var(--foreground)");
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) =>
    (e.target.style.borderColor = "var(--border)");

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 52 }}>
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
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--foreground)" }}>Mailing</span>
          </div>

          <p
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 28,
              fontWeight: 400,
              lineHeight: 1.4,
              color: "var(--foreground)",
              margin: "0 0 32px",
              maxWidth: 300,
            }}
          >
            Join thousands who trust Mailing for every important conversation.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {[
              { label: "Free to start", desc: "Get a full-featured workspace at no cost." },
              { label: "Private by default", desc: "Your data is never shared or sold." },
              { label: "Works everywhere", desc: "Desktop, tablet and mobile — all in sync." },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
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
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: "0 0 2px" }}>{f.label}</p>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>
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
        <div style={{ width: "100%", maxWidth: 360 }}>
          {}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 32 }}>
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
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
                Mailing
              </span>
            </div>
            <h1
              style={{
                fontFamily: "Georgia, serif",
                fontWeight: 400,
                fontSize: 26,
                color: "var(--foreground)",
                margin: "0 0 6px",
                lineHeight: 1.25,
              }}
            >
              Create account
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
              Get started with your free workspace today.
            </p>
          </div>

          {}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                padding: "10px 14px",
                fontSize: 13,
                color: "var(--destructive)",
                marginBottom: 20,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
            {}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="name" style={labelStyle}>Full name</label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                suppressHydrationWarning
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Chen"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="email" style={labelStyle}>Email address</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                suppressHydrationWarning
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {}
            <div style={{ marginBottom: 24 }}>
              <label htmlFor="password" style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  suppressHydrationWarning
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={{ ...inputStyle, padding: "0 40px 0 12px" }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
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
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.75"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75"/>
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
                height: 38,
                justifyContent: "center",
                fontSize: 13,
              }}
            >
              Create account
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
            Already have an account?{" "}
            <Link
              href="/login"
              style={{ color: "var(--foreground)", fontWeight: 600, textDecoration: "underline" }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 860px) {
          .auth-brand-col { display: flex !important; }
        }
        input::placeholder { color: var(--muted-foreground); opacity: 0.6; }
      `}</style>
    </div>
  );
}
