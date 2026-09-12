"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/src/lib/auth-client";
import {
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  X,
  Upload,
  Camera,
  ArrowRight,
  ArrowLeft,
  Mail,
  KeyRound,
  User,
} from "lucide-react";
import {
  compressImage,
  validateImageFile,
  validateProfileImagePayload,
} from "@/lib/image-compressor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/theme-toggle";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    domains?: Array<{ id: string; name: string; status: string }>;
    webhooksCount?: number;
    domainMatch?: { domain: string; verified: boolean; warning?: string };
    message?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Image upload and compression states
  const [compressingImage, setCompressingImage] = useState(false);
  const [imageStats, setImageStats] = useState<{
    originalSize: string;
    compressedSize: string;
    savedPercentage: number;
  } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [formData, setFormData] = useState({
    profileName: "",
    profileImage: "",
    senderName: "",
    senderEmail: "",
    resendApiKey: "",
    resendWebhookSecret: "",
  });

  const handleProcessImage = async (file: File) => {
    setImageError(null);
    setError(null);

    const validation = validateImageFile(file, {
      maxSizeBytes: 15 * 1024 * 1024, // 15MB input limit
    });
    if (!validation.valid) {
      setImageError(validation.error || "Invalid image file");
      return;
    }

    try {
      setCompressingImage(true);
      const result = await compressImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.82,
        cropToSquare: true,
        maxOutputSizeBytes: 150 * 1024, // Guaranteed < 150KB
      });

      setFormData((prev) => ({
        ...prev,
        profileImage: result.dataUrl,
      }));

      setImageStats({
        originalSize: result.formattedOriginalSize,
        compressedSize: result.formattedCompressedSize,
        savedPercentage: result.savedPercentage,
      });
    } catch (err: unknown) {
      console.error("Image processing error:", err);
      const msg = err instanceof Error ? err.message : "Failed to process image";
      setImageError(msg);
    } finally {
      setCompressingImage(false);
    }
  };

  useEffect(() => {
    if (session?.user && !formData.profileName && !formData.senderName) {
      setFormData((prev) => ({
        ...prev,
        profileName: session.user.name || "",
        senderName: session.user.name || "",
        senderEmail: session.user.email || "",
        profileImage: session.user.image || "",
      }));
    }
  }, [session, formData.profileName, formData.senderName]);

  const handleNext = () => {
    if (step === 1 && !formData.profileName) {
      setError("Please enter your name");
      return;
    }
    if (step === 2 && (!formData.senderName || !formData.senderEmail)) {
      setError("Please fill out your sending preferences");
      return;
    }
    setError(null);
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => prev - 1);
  };

  const handleCheckConnection = async (): Promise<boolean> => {
    if (!formData.resendApiKey.trim()) {
      setError("Please enter your Resend API Key to test connection");
      return false;
    }

    setChecking(true);
    setError(null);
    setVerifyStatus("Checking Resend API key and webhook secret...");

    try {
      const res = await fetch("/api/v1/resend/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: formData.resendApiKey,
          webhookSecret: formData.resendWebhookSecret || undefined,
          senderEmail: formData.senderEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Resend API key or webhook check failed");
        setVerificationResult(null);
        return false;
      }

      setVerificationResult({
        valid: true,
        domains: data.domains,
        webhooksCount: data.webhooksCount,
        domainMatch: data.domainMatch,
        message: data.message,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reach verification service";
      setError(msg);
      setVerificationResult(null);
      return false;
    } finally {
      setChecking(false);
      setVerifyStatus(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.resendApiKey) {
      setError("Resend API Key is required");
      return;
    }

    setLoading(true);
    setError(null);
    setVerifyStatus(
      "Verifying Resend API and webhook credentials before proceeding...",
    );

    const isValid = await handleCheckConnection();
    if (!isValid) {
      setLoading(false);
      setVerifyStatus(null);
      return;
    }

    if (formData.profileImage) {
      const imgCheck = validateProfileImagePayload(formData.profileImage);
      if (!imgCheck.valid) {
        setError(
          imgCheck.error ||
            "Profile image exceeds size limits. Please select a compressed image.",
        );
        setLoading(false);
        setVerifyStatus(null);
        return;
      }
    }

    try {
      const res = await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      setStep(4);

      try {
        await fetch("/api/sync", { method: "POST" });
      } catch (syncErr) {
        console.error("Sync failed:", syncErr);
      }

      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings";
      setError(msg);
      setLoading(false);
      setVerifyStatus(null);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  const steps = [
    { id: 1, title: "Your Profile", desc: "Personalize your account." },
    { id: 2, title: "Sending Defaults", desc: "Set how your emails appear." },
    { id: 3, title: "Integration", desc: "Connect to Resend API." },
  ];

  if (step === 4) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground flex-col relative overflow-hidden p-6">
        <div className="relative z-10 flex flex-col items-center max-w-sm text-center space-y-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Spinner className="size-7" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Syncing your workspace
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We&apos;re securely connecting to Resend and downloading your recent
            emails. This usually takes just a few moments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground relative">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Left Stepper Sidebar */}
      <aside className="w-full md:w-80 lg:w-96 shrink-0 border-b md:border-b-0 md:border-r border-border bg-muted/30 flex flex-col justify-between p-6 lg:p-10">
        <div className="space-y-8">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="16" rx="3" />
                <path d="M2 7l10 7 10-7" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">
              Mailing
            </span>
          </div>

          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground leading-tight">
              Configure your workspace
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Complete these three quick steps to start sending and receiving emails.
            </p>
          </div>

          {/* Stepper */}
          <nav aria-label="Onboarding Progress" className="relative">
            <ol className="space-y-6 relative">
              <div
                aria-hidden="true"
                className="absolute left-3.5 top-3 bottom-3 w-px bg-border"
              />

              {steps.map((s) => {
                const isCurrent = step === s.id;
                const isCompleted = step > s.id;
                const isPendingStep = step < s.id;

                return (
                  <li
                    key={s.id}
                    className={`relative flex items-start gap-3.5 ${
                      isPendingStep ? "opacity-60" : ""
                    }`}
                  >
                    {isCurrent && (
                      <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-background border-2 border-primary shadow-xs">
                        <span className="size-2 rounded-full bg-primary" />
                      </span>
                    )}
                    {isCompleted && (
                      <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                        <CheckCircle2 className="size-4" />
                      </span>
                    )}
                    {isPendingStep && (
                      <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted border border-border text-xs font-semibold text-muted-foreground">
                        {s.id}
                      </span>
                    )}

                    <div className="pt-0.5">
                      <p
                        className={`text-xs ${
                          isCurrent
                            ? "font-semibold text-foreground"
                            : "font-medium text-foreground"
                        } flex items-center gap-2`}
                      >
                        {s.title}
                        {isCurrent && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            Current
                          </Badge>
                        )}
                      </p>
                      <p className="text-[11px] mt-0.5 text-muted-foreground leading-relaxed">
                        {s.desc}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <div className="pt-8">
          <p className="text-[11px] text-muted-foreground">
            © 2026 Mailing — All rights reserved.
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-16 overflow-y-auto">
        <div className="w-full max-w-lg py-4">
          <header className="mb-6">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {step === 1 && "Complete your profile"}
              {step === 2 && "Sending defaults"}
              {step === 3 && "Connect integration"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {step === 1 && "Let's personalize your Mailing workspace appearance."}
              {step === 2 &&
                "These will be the default sender details attached to your outbound emails."}
              {step === 3 &&
                "Enter your Resend credentials to enable secure email delivery."}
            </p>
          </header>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed mb-6 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={
              step === 3
                ? handleSubmit
                : (e) => {
                    e.preventDefault();
                    handleNext();
                  }
            }
            className="space-y-6"
          >
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label
                    htmlFor="full-name"
                    className="text-xs font-semibold text-foreground"
                  >
                    Your Name
                  </label>
                  <Input
                    id="full-name"
                    type="text"
                    autoFocus
                    required
                    value={formData.profileName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        profileName: e.target.value,
                      })
                    }
                    placeholder="e.g. Alex Chen"
                    className="h-9"
                  />
                </div>

                {/* Profile Image Zone */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">
                      Profile Image{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      Auto-compressed (Max 15MB)
                    </span>
                  </div>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(true);
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleProcessImage(file);
                    }}
                    className={`rounded-xl border p-4 sm:p-5 transition-all ${
                      isDraggingOver
                        ? "border-primary bg-accent/40 ring-1 ring-primary"
                        : "border-dashed border-border bg-card hover:bg-accent/20"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                      {/* Avatar preview */}
                      <div className="relative group shrink-0">
                        <div className="relative size-18 rounded-full border border-border bg-muted flex items-center justify-center overflow-hidden shadow-xs">
                          {compressingImage ? (
                            <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                              <Spinner className="size-5 text-primary" />
                              <span className="text-[8px] font-semibold uppercase tracking-wider">
                                Optimizing
                              </span>
                            </div>
                          ) : formData.profileImage ? (
                            <img
                              src={formData.profileImage}
                              alt="Avatar preview"
                              className="size-full object-cover"
                            />
                          ) : (
                            <User className="size-8 text-muted-foreground" />
                          )}
                        </div>

                        {formData.profileImage && !compressingImage && (
                          <span
                            className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-background"
                            title="Ready to upload"
                          />
                        )}
                      </div>

                      {/* Dropzone description & buttons */}
                      <div className="flex-1 text-center sm:text-left min-w-0 w-full space-y-2">
                        <label
                          htmlFor="file-upload"
                          className="cursor-pointer block"
                        >
                          <p className="text-xs font-semibold text-foreground">
                            <span className="underline underline-offset-4 decoration-border hover:decoration-foreground">
                              Click to upload
                            </span>{" "}
                            or drag & drop
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            PNG, JPG, or WebP (client-side compressed to &lt;150KB)
                          </p>
                          <input
                            id="file-upload"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                            className="sr-only"
                            disabled={compressingImage}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleProcessImage(file);
                              e.target.value = "";
                            }}
                          />
                          <input
                            id="camera-upload"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                            capture="user"
                            className="sr-only"
                            disabled={compressingImage}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleProcessImage(file);
                              e.target.value = "";
                            }}
                          />
                        </label>

                        {imageStats && !imageError && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-1">
                            <Sparkles className="size-3.5 shrink-0" />
                            <span>
                              Optimized: <strong>{imageStats.compressedSize}</strong>{" "}
                              (-{imageStats.savedPercentage}% saved from{" "}
                              {imageStats.originalSize})
                            </span>
                          </div>
                        )}

                        {imageError && (
                          <div className="flex items-center justify-between gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2.5 py-1">
                            <div className="flex items-center gap-1.5">
                              <AlertCircle className="size-3.5 shrink-0" />
                              <span>{imageError}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setImageError(null)}
                              className="text-destructive hover:opacity-80 p-0.5"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={compressingImage}
                            onClick={() =>
                              document.getElementById("file-upload")?.click()
                            }
                            className="h-7 text-xs gap-1.5"
                          >
                            <Upload className="size-3" />
                            Upload File
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={compressingImage}
                            onClick={() =>
                              document.getElementById("camera-upload")?.click()
                            }
                            className="h-7 text-xs gap-1.5"
                          >
                            <Camera className="size-3" />
                            Camera
                          </Button>
                          {formData.profileImage && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={compressingImage}
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  profileImage: "",
                                }));
                                setImageStats(null);
                                setImageError(null);
                              }}
                              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="sender-name"
                    className="text-xs font-semibold text-foreground"
                  >
                    Sender Name
                  </label>
                  <Input
                    id="sender-name"
                    type="text"
                    autoFocus
                    required
                    value={formData.senderName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        senderName: e.target.value,
                      })
                    }
                    placeholder="e.g. Acme Corp or Jane Doe"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="sender-email"
                    className="text-xs font-semibold text-foreground"
                  >
                    Sender Email
                  </label>
                  <Input
                    id="sender-email"
                    type="email"
                    required
                    value={formData.senderEmail}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        senderEmail: e.target.value,
                      })
                    }
                    placeholder="e.g. hello@yourdomain.com"
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This domain should be verified in your Resend account to prevent bounce or spam issues.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="resend-api-key"
                      className="text-xs font-semibold text-foreground"
                    >
                      Resend API Key
                    </label>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      re_...
                    </span>
                  </div>
                  <Input
                    id="resend-api-key"
                    type="password"
                    autoFocus
                    required
                    value={formData.resendApiKey}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        resendApiKey: e.target.value,
                      });
                      setVerificationResult(null);
                      setError(null);
                    }}
                    placeholder="re_..."
                    className="h-9 font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Obtained from your{" "}
                    <a
                      href="https://resend.com/api-keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground underline underline-offset-4 font-medium hover:opacity-80"
                    >
                      Resend Dashboard &rarr; API Keys
                    </a>
                    .
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="webhook-secret"
                      className="text-xs font-semibold text-foreground"
                    >
                      Resend Webhook Secret{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </label>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      whsec_...
                    </span>
                  </div>
                  <Input
                    id="webhook-secret"
                    type="password"
                    value={formData.resendWebhookSecret}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        resendWebhookSecret: e.target.value,
                      });
                      setVerificationResult(null);
                      setError(null);
                    }}
                    placeholder="whsec_..."
                    className="h-9 font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Signing secret configured on your Resend Webhooks endpoint to receive incoming mail in real-time.
                  </p>
                </div>

                {/* Pre-flight Connection Test Button */}
                <div className="pt-1 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCheckConnection}
                    disabled={
                      checking || loading || !formData.resendApiKey.trim()
                    }
                    className="text-xs gap-1.5"
                  >
                    {checking ? (
                      <>
                        <Spinner className="size-3.5" />
                        <span>Checking credentials…</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-3.5" />
                        <span>Test API & Webhook Connection</span>
                      </>
                    )}
                  </Button>

                  {verificationResult?.valid && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      Ready to proceed
                    </span>
                  )}
                </div>

                {/* Verification Result Feedback */}
                {verificationResult?.valid && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-foreground space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-emerald-600">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>Resend API Key verified successfully</span>
                    </div>

                    {verificationResult.domains &&
                    verificationResult.domains.length > 0 ? (
                      <div className="text-[11px] text-muted-foreground pl-6 space-y-1">
                        <p>
                          <span className="font-medium text-foreground">
                            Detected sending domains:
                          </span>{" "}
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-foreground">
                            {verificationResult.domains
                              .map((d) => d.name)
                              .join(", ")}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground pl-6">
                        Connected with active sending permissions.
                      </p>
                    )}

                    {formData.resendWebhookSecret ? (
                      <div className="flex items-center gap-2 text-[11px] text-emerald-600 pl-6">
                        <CheckCircle2 className="size-3.5 shrink-0" />
                        <span>Webhook signing secret format validated.</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground pl-6">
                        Webhook secret omitted (inbound emails will rely on periodic sync).
                      </p>
                    )}

                    {verificationResult.domainMatch?.warning && (
                      <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
                        <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{verificationResult.domainMatch.warning}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Stepper Footer Buttons */}
            <div className="pt-2 flex gap-3">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={loading || checking}
                  className="h-10 px-4 text-xs font-semibold gap-1.5"
                >
                  <ArrowLeft className="size-3.5" />
                  Back
                </Button>
              )}
              <Button
                type="submit"
                disabled={loading || checking}
                className="flex-1 h-10 text-xs font-semibold gap-2"
              >
                {loading ? (
                  <>
                    <Spinner className="size-3.5" />
                    <span>{verifyStatus || "Verifying credentials…"}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {step === 3 ? "Complete Setup & Proceed" : "Next"}
                    </span>
                    {step < 3 && <ArrowRight className="size-3.5" />}
                  </>
                )}
              </Button>
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              You can always update these settings from your workspace preferences later.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
