"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/src/lib/auth-client";
import { Loader2, CheckCircle2, ShieldCheck, AlertCircle, Sparkles, Image as ImageIcon, X } from "lucide-react";
import { compressImage, validateImageFile, formatFileSize, validateProfileImagePayload } from "@/lib/image-compressor";

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

    // 1. Validate input file restrictions
    const validation = validateImageFile(file, {
      maxSizeBytes: 15 * 1024 * 1024, // 15MB input limit
    });
    if (!validation.valid) {
      setImageError(validation.error || "Invalid image file");
      return;
    }

    try {
      setCompressingImage(true);
      // 2. Client-side canvas compression: resize & center-crop to 400x400 WebP
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
    } catch (err: any) {
      console.error("Image processing error:", err);
      setImageError(err.message || "Failed to process image");
    } finally {
      setCompressingImage(false);
    }
  };

  // Pre-fill profile info if available
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
    } catch (err: any) {
      setError(err.message || "Failed to reach verification service");
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
    setVerifyStatus("Verifying Resend API and webhook credentials before proceeding...");

    // Mandatory Resend API and Webhook check before proceeding
    const isValid = await handleCheckConnection();
    if (!isValid) {
      setLoading(false);
      setVerifyStatus(null);
      return;
    }

    // Safety check on profile image payload size before dispatch
    if (formData.profileImage) {
      const imgCheck = validateProfileImagePayload(formData.profileImage);
      if (!imgCheck.valid) {
        setError(imgCheck.error || "Profile image exceeds size limits. Please select a compressed image.");
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

      // Move to the full-page sync state
      setStep(4);
      
      // Call the sync API in the background
      try {
        await fetch("/api/sync", { method: "POST" });
      } catch (syncErr) {
        console.error("Sync failed:", syncErr);
      }
      
      // Finally redirect to the app
      router.push("/");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      setVerifyStatus(null);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-zinc-500 w-6 h-6" />
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
      <div className="min-h-screen flex items-center justify-center bg-white selection:bg-zinc-900 selection:text-white flex-col relative overflow-hidden">
        {/* Animated background subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-zinc-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          {/* Animated icon / loader */}
          <div className="relative w-20 h-20 mb-8">
            <svg className="absolute inset-0 w-full h-full text-zinc-100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="6" />
            </svg>
            <svg className="absolute inset-0 w-full h-full text-brand animate-spin" viewBox="0 0 100 100">
              <circle 
                cx="50" 
                cy="50" 
                r="46" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="6" 
                strokeDasharray="289" 
                strokeDashoffset="216" 
                strokeLinecap="round" 
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg 
                className="w-7 h-7 text-zinc-900 animate-pulse" 
                style={{ animationDuration: '2s' }}
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-.1-9.999 5.002 5.002 0 1 0-9.78 2.096A4.001 4.001 0 0 0 3 15z"></path>
              </svg>
            </div>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-950 mb-3 animate-in slide-in-from-bottom-2 fade-in duration-500">
            Syncing your workspace
          </h2>
          <p className="text-sm text-zinc-500 max-w-sm text-center animate-in slide-in-from-bottom-3 fade-in duration-700 delay-150 fill-mode-both">
            We're securely connecting to Resend and downloading your recent emails. This usually takes just a few moments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-dashed-border {
          background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='12' ry='12' stroke='%23E4E4E7' stroke-width='1.5' stroke-dasharray='4%2c 4' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
        }
        .custom-dashed-border:hover {
          background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='12' ry='12' stroke='%23A1A1AA' stroke-width='1.5' stroke-dasharray='4%2c 4' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
        }
      `}} />
      <div className="min-h-screen flex flex-col md:flex-row overflow-x-hidden font-sans selection:bg-zinc-900 selection:text-white">
        {/* BEGIN: LeftSidebar */}
        <aside className="w-full md:w-95 lg:w-105 shrink-0 border-b md:border-b-0 md:border-r border-zinc-200/80 bg-[#FAFAFA] flex flex-col justify-between p-8 lg:p-12">
          <div className="space-y-12">
            {/* App Brand / Logo */}
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-white border border-zinc-200/90 shadow-sm flex items-center justify-center text-zinc-900">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                  viewBox="0 0 24 24"
                >
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
                  <path d="M5 3v4"></path>
                  <path d="M19 17v4"></path>
                  <path d="M3 5h4"></path>
                  <path d="M17 19h4"></path>
                </svg>
              </div>
              <span className="font-semibold text-base tracking-tight text-zinc-950">
                Mailing
              </span>
            </div>

            {/* Section Title */}
            <div>
              <h1 className="text-2xl lg:text-[28px] font-semibold tracking-tight text-zinc-950 leading-tight">
                Configure your<br />workspace settings.
              </h1>
            </div>

            {/* Stepper Nav List */}
            <nav aria-label="Onboarding Progress" className="relative">
              <ol className="space-y-7 relative">
                {/* Continuous connecting line */}
                <div
                  aria-hidden="true"
                  className="absolute left-3.25 top-3 bottom-3 w-[1.5px] bg-zinc-200"
                ></div>
                
                {steps.map((s) => {
                  const isCurrent = step === s.id;
                  const isCompleted = step > s.id;
                  const isPending = step < s.id;

                  return (
                    <li key={s.id} className={`relative flex items-start gap-3.5 group ${isPending ? 'opacity-75' : ''}`}>
                      {isCurrent && (
                        <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white border border-zinc-900 shadow-sm">
                          <span className="h-2 w-2 rounded-full bg-zinc-900"></span>
                        </span>
                      )}
                      {isCompleted && (
                        <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 shadow-sm">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                             <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                      {isPending && (
                        <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-500">
                          {s.id}
                        </span>
                      )}

                      <div className="pt-0.5">
                        <p className={`text-sm ${isCurrent ? 'font-semibold text-zinc-950' : 'font-medium text-zinc-700'} flex items-center gap-2`}>
                          {s.title}
                          {isCurrent && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                              Current
                            </span>
                          )}
                        </p>
                        <p className={`text-xs mt-0.5 leading-relaxed ${isCurrent ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          {s.desc}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="pt-10 mt-10 md:mt-0">
            <p className="text-xs text-zinc-400 font-normal">
              © 2026 Mailing — All rights reserved.
            </p>
          </div>
        </aside>
        {/* END: LeftSidebar */}

        {/* BEGIN: MainContent */}
        <main className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-16 overflow-y-auto bg-white">
          <div className="w-full max-w-125 py-4">
            
            {/* Form Header */}
            <header className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                {step === 1 && "Complete your profile"}
                {step === 2 && "Sending defaults"}
                {step === 3 && "Connect integration"}
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                {step === 1 && "Let's personalize your Mailing experience."}
                {step === 2 && "These will be the default sender details for your campaigns."}
                {step === 3 && "You need a Resend API key to send emails."}
              </p>
            </header>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2.5 text-sm rounded-md mb-6 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                {error}
              </div>
            )}

            <form
              onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}
              className="space-y-7"
            >
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-7">
                    {/* Field 1: Name Input */}
                    <div>
                      <label
                        htmlFor="full-name"
                        className="block text-xs font-medium text-zinc-700 mb-1.5 uppercase tracking-wide"
                      >
                        Your Name
                      </label>
                      <div className="relative">
                        <input
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
                          placeholder="Enter your full name"
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition duration-150 shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Field 2: Profile Image Elevated UX Zone with Client-side Compression */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wide">
                          Profile Image{" "}
                          <span className="text-zinc-400 font-normal lowercase">
                            (optional)
                          </span>
                        </label>
                        <span className="text-xs text-zinc-400">Auto-compressed (Max 15MB)</span>
                      </div>

                      {/* Elevated Drag & Drop Card Container */}
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
                        className={`rounded-xl border transition-all duration-200 p-4 sm:p-5 ${
                          isDraggingOver
                            ? "border-zinc-900 bg-zinc-100/90 shadow-sm ring-2 ring-zinc-900/10"
                            : "border-zinc-200/90 bg-zinc-50/40 hover:bg-zinc-50/70"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
                          {/* Avatar Preview with quick hover badge */}
                          <div className="relative group shrink-0">
                            <div className="relative h-20 w-20 rounded-full border-2 border-dashed border-zinc-300 bg-white flex items-center justify-center overflow-hidden shadow-sm transition-all duration-200 group-hover:border-zinc-400">
                              {compressingImage ? (
                                <div className="flex flex-col items-center justify-center gap-1 text-zinc-600">
                                  <Loader2 className="w-6 h-6 animate-spin text-zinc-900" />
                                  <span className="text-[9px] font-medium uppercase tracking-tight">Optimizing</span>
                                </div>
                              ) : formData.profileImage ? (
                                <img
                                  src={formData.profileImage}
                                  alt="Avatar preview"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <svg
                                  className="h-9 w-9 text-zinc-400 transition-transform duration-200 group-hover:scale-105"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.75"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                                  <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                              )}
                              
                              {/* Subtle overlay edit on hover */}
                              {!compressingImage && (
                                <div
                                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full cursor-pointer"
                                  onClick={() => document.getElementById("file-upload")?.click()}
                                  title="Change photo"
                                >
                                  <svg
                                    className="w-5 h-5 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" x2="12" y1="3" y2="15"></line>
                                  </svg>
                                </div>
                              )}
                            </div>

                            {/* Verified status indicator / small badge */}
                            {formData.profileImage && !compressingImage && (
                              <span
                                className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white"
                                title="Ready to upload"
                              ></span>
                            )}
                          </div>

                          {/* Drag & Drop / Details Area */}
                          <div className="flex-1 text-center sm:text-left min-w-0 w-full">
                            {/* Dropzone trigger area */}
                            <label className="cursor-pointer block" htmlFor="file-upload">
                              <div className="custom-dashed-border rounded-xl p-3.5 sm:p-4 bg-white hover:border-zinc-400 transition text-center sm:text-left">
                                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 justify-center sm:justify-start">
                                  <div className="h-7 w-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 shrink-0">
                                    {compressingImage ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                                    ) : (
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                      >
                                        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
                                        <path d="M12 12v9"></path>
                                        <path d="m16 16-4-4-4 4"></path>
                                      </svg>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-zinc-900">
                                      <span className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900">
                                        Click to upload
                                      </span>{" "}
                                      or drag & drop
                                    </p>
                                    <p className="text-[11px] text-zinc-500 mt-0.5">
                                      PNG, JPG, or WebP (client-side compressed to &lt;150KB)
                                    </p>
                                  </div>
                                </div>
                              </div>
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

                            {/* Compression success badge or error notice */}
                            {imageStats && !imageError && (
                              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 rounded-md px-2.5 py-1">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>
                                  Optimized: <strong>{imageStats.compressedSize}</strong>{" "}
                                  <span className="text-emerald-600">(-{imageStats.savedPercentage}% saved from {imageStats.originalSize})</span>
                                </span>
                              </div>
                            )}

                            {imageError && (
                              <div className="mt-2.5 flex items-center justify-between gap-1.5 text-xs text-red-700 bg-red-50/80 border border-red-200/60 rounded-md px-2.5 py-1">
                                <div className="flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                  <span>{imageError}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setImageError(null)}
                                  className="text-red-500 hover:text-red-700 p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {/* Micro Action Buttons: Upload & Camera & Remove */}
                            <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                              <button
                                type="button"
                                disabled={compressingImage}
                                onClick={() => document.getElementById("file-upload")?.click()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-200 bg-white text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition disabled:opacity-50"
                                style={{
                                  fontSize:"12px"
                                }}
                              >
                                <svg
                                  className="w-3.5 h-3.5 text-zinc-500"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                  <polyline points="17 8 12 3 7 8"></polyline>
                                  <line x1="12" x2="12" y1="3" y2="15"></line>
                                </svg>
                                Upload File
                              </button>
                              <button
                                type="button"
                                disabled={compressingImage}
                                onClick={() => document.getElementById("camera-upload")?.click()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-200 bg-white text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition disabled:opacity-50"
                                style={{fontSize:"12px"}}
                              >
                                <svg
                                  className="w-3.5 h-3.5 text-zinc-500"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                                  <circle cx="12" cy="13" r="3"></circle>
                                </svg>
                                Use Camera
                              </button>
                              {formData.profileImage && (
                                <button
                                  type="button"
                                  disabled={compressingImage}
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, profileImage: "" }));
                                    setImageStats(null);
                                    setImageError(null);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none transition disabled:opacity-50"
                                  style={{fontSize:"12px"}}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-7">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5 uppercase tracking-wide">
                        Sender Name
                      </label>
                      <input
                        type="text"
                        autoFocus
                        required
                        value={formData.senderName}
                        onChange={(e) =>
                          setFormData({ ...formData, senderName: e.target.value })
                        }
                        placeholder="e.g. Acme Corp"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition duration-150 shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5 uppercase tracking-wide">
                        Sender Email
                      </label>
                      <input
                        type="email"
                        required
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            senderEmail: e.target.value,
                          })
                        }
                        placeholder="e.g. hello@example.com"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition duration-150 shadow-sm"
                      />
                      <p className="text-[11px] text-zinc-500 mt-1.5">
                        This domain must be verified in your Resend account.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wide">
                          Resend API Key
                        </label>
                        <span className="text-[11px] text-zinc-400">
                          Format: <code className="font-mono text-zinc-600">re_...</code>
                        </span>
                      </div>
                      <input
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
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition duration-150 shadow-sm font-mono"
                      />
                      <p className="text-[11px] text-zinc-500 mt-1.5">
                        Found in your <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="underline hover:text-zinc-900">Resend dashboard &rarr; API Keys</a>.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wide">
                          Resend Webhook Secret{" "}
                          <span className="text-zinc-400 font-normal lowercase">
                            (optional)
                          </span>
                        </label>
                        <span className="text-[11px] text-zinc-400">
                          Format: <code className="font-mono text-zinc-600">whsec_...</code>
                        </span>
                      </div>
                      <input
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
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition duration-150 shadow-sm font-mono"
                      />
                      <p className="text-[11px] text-zinc-500 mt-1.5">
                        Signing secret generated by Resend Webhooks to receive inbound mail in real-time.
                      </p>
                    </div>

                    {/* Pre-flight Connection Test Button */}
                    <div className="pt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleCheckConnection}
                        disabled={checking || loading || !formData.resendApiKey.trim()}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800 hover:text-zinc-950 px-3.5 py-2 rounded-lg border border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                      >
                        {checking ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600" />
                            <span>Checking Resend credentials...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4 text-zinc-700" />
                            <span>Test API & Webhook Connection</span>
                          </>
                        )}
                      </button>

                      {verificationResult?.valid && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Ready to proceed
                        </span>
                      )}
                    </div>

                    {/* Verification Card Result */}
                    {verificationResult?.valid && (
                      <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/70 p-4 text-xs text-emerald-950 space-y-2 animate-in fade-in duration-200 shadow-2xs">
                        <div className="flex items-center gap-2 font-semibold text-emerald-900">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Resend API Key verified successfully</span>
                        </div>

                        {verificationResult.domains && verificationResult.domains.length > 0 ? (
                          <div className="text-[11px] text-emerald-800 pl-6 space-y-1">
                            <p>
                              <span className="font-medium">Detected sending domains:</span>{" "}
                              <span className="font-mono bg-emerald-100/90 px-1.5 py-0.5 rounded border border-emerald-200/70">
                                {verificationResult.domains.map((d) => d.name).join(", ")}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-emerald-700 pl-6">
                            Connected with active sending permissions.
                          </p>
                        )}

                        {formData.resendWebhookSecret ? (
                          <div className="flex items-center gap-2 text-[11px] text-emerald-800 pl-6">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Webhook signing secret format validated (Svix compatible).</span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-zinc-500 pl-6">
                            Webhook secret omitted (inbound emails will rely on periodic sync).
                          </p>
                        )}

                        {verificationResult.domainMatch?.warning && (
                          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>{verificationResult.domainMatch.warning}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={loading || checking}
                    className="h-12 px-5 rounded-lg border border-zinc-200 bg-white text-zinc-700 font-semibold text-sm flex items-center justify-center hover:bg-zinc-50 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                     Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || checking}
                  className="group flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-950 py-3 px-4 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 active:scale-[0.99] transition duration-150 disabled:opacity-70 disabled:pointer-events-none cursor-pointer"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{verifyStatus || "Verifying credentials..."}</span>
                    </div>
                  ) : (
                    <>
                      <span>{step === 3 ? "Complete Setup & Proceed" : "Next"}</span>
                      {step < 3 && (
                        <svg
                          className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M5 12h14"></path>
                          <path d="m12 5 7 7-7 7"></path>
                        </svg>
                      )}
                    </>
                  )}
                </button>
              </div>
              
              <p className="text-center text-[11px] text-zinc-400 mt-3">
                You can always update this from your workspace preferences later.
              </p>
            </form>
          </div>
        </main>
        {/* END: MainContent */}
      </div>
    </>
  );
}
