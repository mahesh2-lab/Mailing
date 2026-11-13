"use client";

import { useState } from "react";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/utils";
import { authClient } from "@/src/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) setError(result.error.message || "Could not request a password reset.");
      else setSent(true);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Could not request a password reset. Please try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Link href="/login" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Back to sign in
        </Link>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Enter the email address on your account and we’ll send a reset link if an account is eligible.
          </p>
        </div>
        {sent ? (
          <p role="status" className="rounded-lg border border-border bg-muted/50 p-3 text-sm leading-relaxed">
            If an account exists for that address, a password reset link will arrive shortly.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="text-xs font-semibold">Email address</label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={sending} className="w-full">
              {sending ? "Sending reset link…" : "Send reset link"}
            </Button>
          </form>
        )}
        <div className="flex justify-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
        </div>
      </section>
    </main>
  );
}
