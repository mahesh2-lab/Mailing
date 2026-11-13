"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Zap,
  Inbox,
  Send,
  Star,
  CheckCircle2,
  SlidersHorizontal,
  Search,
} from "@/components/animate-ui/icons";
import { authClient } from "@/src/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { cn, extractErrorMessage } from "@/lib/utils";

export interface AuthViewProps {
  initialMode?: "login" | "register";
}

const COMMON_DOMAINS = ["gmail.com", "outlook.com", "hey.com", "icloud.com"];

function calculatePasswordStrength(pass: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!pass) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pass.length >= 8) score += 1;
  if (pass.length >= 12) score += 1;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;

  switch (score) {
    case 1:
      return { score: 1, label: "Weak", color: "bg-destructive" };
    case 2:
      return { score: 2, label: "Fair", color: "bg-amber-500" };
    case 3:
      return { score: 3, label: "Good", color: "bg-primary/80" };
    case 4:
      return { score: 4, label: "Strong", color: "bg-emerald-500" };
    default:
      return { score: 0, label: "Too short", color: "bg-muted" };
  }
}

export function AuthView({ initialMode = "login" }: AuthViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/inbox";

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const passwordStrength = calculatePasswordStrength(password);

  const handleDomainClick = (domain: string) => {
    const atIndex = email.indexOf("@");
    const prefix = atIndex >= 0 ? email.slice(0, atIndex) : email;
    setEmail(`${prefix || "user"}@${domain}`);
  };

  const handleModeSwitch = (newMode: "login" | "register") => {
    setMode(newMode);
    setError(null);
    window.history.replaceState(
      null,
      "",
      newMode === "login" ? "/login" : "/register",
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === "login") {
        await authClient.signIn.email(
          { email, password, callbackURL: "/inbox" },
          {
            onSuccess: () => {
              toast.success("Welcome back! Signing you in...");
              router.push(callbackUrl);
              router.refresh();
            },
            onError: (ctx) => {
              setIsLoading(false);
              setError(
                ctx.error.message ||
                  "Invalid email or password. Please try again.",
              );
            },
          },
        );
      } else {
        await authClient.signUp.email(
          { name, email, password },
          {
            onSuccess: () => {
              toast.success("Account created! Welcome to Mailing.");
              router.push("/inbox");
              router.refresh();
            },
            onError: (ctx) => {
              setIsLoading(false);
              setError(
                ctx.error.message ||
                  "Failed to create account. Please try again.",
              );
            },
          },
        );
      }
    } catch (err: unknown) {
      console.error("Auth error:", err);
      setError(extractErrorMessage(err, "An unexpected error occurred. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail("demo@heymahesh.in");
    setPassword("DemoPassword123!");
    if (mode === "register") setName("Demo Operator");
    toast.info("Demo credentials filled");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background text-foreground relative selection:bg-primary selection:text-primary-foreground">
      {/* Top right ThemeToggle matching Onboarding and App Shells */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* LEFT PANEL: Authentic Mailing Workspace Gateway (Desktop) */}
      <aside className="w-full lg:w-[48%] xl:w-[50%] shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-muted/30 flex flex-col justify-between p-8 lg:p-12 xl:p-16 relative overflow-hidden">
        {/* Subtle grid pattern matching site aesthetic */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Top Header: Official Mailing Brand & Resend Connection Pill */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105 duration-200">
              <svg
                width="18"
                height="18"
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
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-foreground flex items-center gap-2">
                Mailing
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                  v2.4
                </Badge>
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                High-Speed Email Workspace
              </span>
            </div>
          </Link>

        </div>

        {/* Center: Mission statement + Realistic 3-Pane Mini Preview */}
        <div className="relative z-10 my-auto py-8 lg:py-10 space-y-7 max-w-xl">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Zap className="size-3.5 text-foreground" />
              <span>Built on Resend API &amp; Webhooks</span>
            </div>
            <h1 className="text-2xl sm:text-3xl xl:text-4xl font-bold tracking-tight text-foreground leading-[1.18]">
              The email client designed for high-output velocity.
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md">
              Full 3-pane triage, instant local full-text search, visual automation workflows, and zero intermediary tracking.
            </p>
          </div>

          {/* Interactive Workspace Preview Card (Mirrors real /inbox) */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3.5">
            {/* Header / Mini Command Bar */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3 text-xs">
              <div className="flex items-center gap-2">
                <Search className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground font-mono text-[11px]">
                  Search messages, tags, or jump to folder...
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">⌘K</kbd>
              </div>
            </div>

            {/* Mini 3-Pane Workspace Mock */}
            <div className="grid grid-cols-12 gap-2 text-xs">
              {/* Mini Sidebar */}
              <div className="col-span-4 rounded-lg bg-muted/40 p-2 space-y-1 font-medium text-[11px]">
                <div className="flex items-center justify-between px-2 py-1 rounded-md bg-accent text-accent-foreground font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Inbox className="size-3" /> Inbox
                  </span>
                  <span className="text-[10px] font-mono">4</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 rounded-md text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Star className="size-3" /> Starred
                  </span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 rounded-md text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Send className="size-3" /> Sent
                  </span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 rounded-md text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="size-3" /> Rules
                  </span>
                </div>
              </div>

              {/* Mini Thread Card */}
              <div className="col-span-8 rounded-lg border border-border bg-background p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-foreground text-[11px]">
                      Satya Nadella
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] h-4 px-1 py-0">
                    VIP
                  </Badge>
                </div>
                <p className="font-medium text-foreground text-[11px] truncate">
                  Enterprise API Integration &amp; Roadmap
                </p>
                <p className="text-muted-foreground text-[10px] line-clamp-1">
                  Let&apos;s review the custom webhook queue latency and Resend pipeline...
                </p>
                {/* Real Keyboard Action Ribbon */}
                <div className="flex items-center gap-1.5 pt-1 text-[10px] font-mono text-muted-foreground border-t border-border/50">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-foreground">
                    <kbd className="font-bold">E</kbd> Archive
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-foreground">
                    <kbd className="font-bold">R</kbd> Reply
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-foreground">
                    <kbd className="font-bold">S</kbd> Star
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Strip */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/60 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Zap className="size-3 text-amber-500" />
                <span className="font-mono text-foreground font-semibold">14ms</span>
                <span>keystroke</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center">
                <CheckCircle2 className="size-3 text-emerald-500" />
                <span className="font-mono text-foreground font-semibold">0.04s</span>
                <span>search</span>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <ShieldCheck className="size-3 text-primary" />
                <span>Zero tracker</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Trust & Documentation Link */}
        <div className="relative z-10 pt-6 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Mailing Cloud</span>
            <span>·</span>
            <Link
              href="/docs"
              className="hover:text-foreground underline underline-offset-4 decoration-border"
            >
              Read Documentation
            </Link>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>SOC2 Type II Ready</span>
          </div>
        </div>
      </aside>

      {/* RIGHT PANEL: Authentication Form */}
      <main className="flex-1 flex flex-col justify-between p-6 sm:p-10 md:p-12 lg:p-16 overflow-y-auto">
        {/* Mobile Header Brand */}
        <div className="lg:hidden flex items-center gap-2 mb-6">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Inbox className="size-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground">
            Mailing
          </span>
        </div>

        {/* Center: Auth Card */}
        <div className="w-full max-w-md mx-auto my-auto py-6 space-y-6">
          {/* Segmented Mode Switcher (Shadcn Tabs Style) */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-muted border border-border text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleModeSwitch("login")}
              className={cn(
                "py-2 rounded-lg transition-all duration-150 cursor-pointer text-center text-xs",
                mode === "login"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch("register")}
              className={cn(
                "py-2 rounded-lg transition-all duration-150 cursor-pointer text-center text-xs",
                mode === "register"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Create Account
            </button>
          </div>

          {/* Form Header */}
          <div className="space-y-1.5 text-left">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {mode === "login" ? "Welcome back" : "Create your workspace"}
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {mode === "login"
                ? "Enter your credentials to access your unified email inbox."
                : "Join thousands of operators managing communications with Resend."}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in-0 duration-150">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed font-medium">{error}</div>
            </div>
          )}

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name Field (Register Mode Only) */}
            {mode === "register" && (
              <div className="space-y-1.5 animate-in fade-in-0 duration-150">
                <label
                  htmlFor="auth-name"
                  className="text-xs font-semibold text-foreground flex items-center justify-between"
                >
                  <span>Full name</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="auth-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mahesh Chopade"
                    className="h-10 pl-9 rounded-xl text-xs"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="auth-email"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>Email address</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@company.com"
                  className="h-10 pl-9 rounded-xl text-xs"
                />
              </div>

              {/* Smart Domain Completion Pills */}
              {email && !email.includes("@") && (
                <div className="flex items-center gap-1.5 pt-1 overflow-x-auto scrollbar-none">
                  <span className="text-[11px] text-muted-foreground shrink-0 font-medium mr-1">
                    Quick:
                  </span>
                  {COMMON_DOMAINS.map((domain) => (
                    <button
                      key={domain}
                      type="button"
                      onClick={() => handleDomainClick(domain)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-mono border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                    >
                      @{domain}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="auth-password"
                  className="text-xs font-semibold text-foreground"
                >
                  Password
                </label>
                {mode === "login" && (
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border cursor-pointer transition-colors"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "login" ? "••••••••••••" : "Min. 8 characters"
                  }
                  className="h-10 pl-9 pr-9 rounded-xl font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>

              {/* Password Strength Indicator (Register Mode Only) */}
              {mode === "register" && password && (
                <div className="space-y-1.5 pt-1 animate-in fade-in-0 duration-150">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">
                      Strength:
                    </span>
                    <span className="font-semibold text-foreground">
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          step <= passwordStrength.score
                            ? passwordStrength.color
                            : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Remember Me Checkbox (Login Mode) */}
            {mode === "login" && (
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="size-3.5 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                  />
                  <span>Keep me signed in for 30 days</span>
                </label>
              </div>
            )}

            {/* Primary Action Button */}
            <Button
              type="submit"
              size="lg"
              disabled={
                isLoading ||
                !email.trim() ||
                !password.trim() ||
                (mode === "register" && !name.trim())
              }
              className="w-full h-10 rounded-xl font-semibold text-xs gap-2 cursor-pointer shadow-sm active:scale-[0.99] transition-all"
            >
              {isLoading ? (
                <>
                  <Spinner className="size-4 text-primary-foreground" />
                  <span>
                    {mode === "login"
                      ? "Signing in to workspace..."
                      : "Creating workspace..."}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {mode === "login"
                      ? "Sign in to workspace"
                      : "Create account"}
                  </span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>

            {/* Quick Demo Credentials Autofill */}
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFillDemo}
                className="w-full h-8 rounded-lg text-xs font-medium border-dashed border-border hover:bg-muted/50 cursor-pointer gap-1.5"
              >
                <Sparkles className="size-3.5 text-amber-500" />
                <span>Fill sample demo credentials</span>
              </Button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative text-center text-xs text-muted-foreground after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-background px-3 text-muted-foreground font-medium text-[11px]">
              Fast, private, and secure
            </span>
          </div>

          {/* Security & Privacy Badges */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-0.5">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>Encrypted credentials</span>
            </span>
            <span className="text-border">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-3.5 text-primary" />
              <span>Zero-tracker policy</span>
            </span>
          </div>
        </div>

        {/* Footer info */}
        <footer className="w-full max-w-md mx-auto text-center text-[11px] text-muted-foreground pt-4 border-t border-border">
          <p>
            By continuing, you agree to our{" "}
            <Link
              href="/terms"
              className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}
