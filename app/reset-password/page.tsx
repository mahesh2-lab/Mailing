import { Suspense } from "react";
import type { Metadata } from "next";
import { Spinner } from "@/components/ui/spinner";
import { ResetPasswordView } from "@/components/auth/reset-password-view";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Spinner className="size-6" /></div>}>
      <ResetPasswordView />
    </Suspense>
  );
}
