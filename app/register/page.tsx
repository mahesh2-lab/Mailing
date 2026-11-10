"use client";

import { Suspense } from "react";
import { AuthView } from "@/components/auth/auth-view";
import { Spinner } from "@/components/ui/spinner";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground gap-3">
          <Spinner className="size-6 text-primary" />
          <p className="text-xs text-muted-foreground font-mono">Loading Mailing workspace...</p>
        </div>
      }
    >
      <AuthView initialMode="register" />
    </Suspense>
  );
}
