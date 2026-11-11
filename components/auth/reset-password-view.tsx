"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function ResetPasswordView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invalidLink = searchParams.has("error") || !token;
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(result.error.message || "This reset link may have expired.");
      } else {
        toast.success("Password updated. Sign in with your new password.");
        router.replace("/login");
      }
    } catch {
      setError("Could not reset the password. Please request a new link.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Link href="/login" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Back to sign in
        </Link>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {invalidLink ? "This reset link is missing or expired. Request a new one to continue." : "Choose a new password for your account."}
          </p>
        </div>
        {invalidLink ? (
          <Button render={<Link href="/forgot-password" />} className="w-full">Request a new reset link</Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-xs font-semibold">New password</label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-xs font-semibold">Confirm new password</label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Enter it again"
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Updating password…" : "Update password"}
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
