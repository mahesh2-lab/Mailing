"use client";

import React, { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  LogOut,
  Shield,
  SlidersHorizontal,
  Zap,
  CheckCircle2,
  AlertTriangle,
  User,
  Settings as SettingsIcon,
} from "@/components/animate-ui/icons";
import { authClient } from "@/src/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { MotionGrid, MotionGridCells, type Frames } from "@animate-ui/react/primitives/motion-grid";
import { useShouldReduceMotion } from "@animate-ui/react/utils/motion";
import { RotatingText, RotatingTextContainer } from "@animate-ui/react/primitives/texts/rotating";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { avatarColor, getInitials, cn, extractErrorMessage } from "@/lib/utils";

const PREFERENCES_KEY = "mailing:preferences";
const PREFERENCES_EVENT = "mailing:preferences-change";
const DEFAULT_PREFERENCES = JSON.stringify({ density: "comfortable", reduceMotion: false });

const IMPORTING_FRAMES: Frames = [
  [[2, 2]],
  [[1, 2], [2, 1], [2, 3], [3, 2]],
  [[2, 2], [0, 2], [1, 1], [1, 3], [2, 0], [2, 4], [3, 1], [3, 3], [4, 2]],
  [[0, 1], [0, 3], [1, 0], [1, 2], [1, 4], [2, 1], [2, 3], [3, 0], [3, 2], [3, 4], [4, 1], [4, 3]],
  [[0, 0], [0, 2], [0, 4], [1, 1], [1, 3], [2, 0], [2, 2], [2, 4], [3, 1], [3, 3], [4, 0], [4, 2], [4, 4]],
  [[0, 1], [0, 3], [1, 0], [1, 2], [1, 4], [2, 1], [2, 3], [3, 0], [3, 2], [3, 4], [4, 1], [4, 3]],
  [[0, 0], [0, 2], [0, 4], [1, 1], [1, 3], [2, 0], [2, 4], [3, 1], [3, 3], [4, 0], [4, 2], [4, 4]],
  [[0, 1], [1, 0], [3, 0], [4, 1], [0, 3], [1, 4], [3, 4], [4, 3]],
  [[0, 0], [0, 4], [4, 0], [4, 4]],
  [],
];
const SYNC_FRAMES: Frames = [
  [[2, 0]],
  [[1, 0], [2, 0], [3, 0], [2, 1]],
  [[2, 0], [1, 1], [2, 1], [3, 1], [2, 2]],
  [[2, 0], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3]],
  [[2, 1], [2, 2], [1, 3], [2, 3], [3, 3], [2, 4]],
  [[2, 2], [2, 3], [1, 4], [2, 4], [3, 4]],
  [[2, 3], [2, 4]],
  [[2, 4]],
  [],
  [[2, 4]],
  [[2, 3], [2, 4]],
  [[2, 2], [2, 3], [1, 4], [2, 4], [3, 4]],
  [[2, 1], [2, 2], [1, 3], [2, 3], [3, 3], [2, 4]],
  [[2, 0], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3]],
  [[2, 0], [1, 1], [2, 1], [3, 1], [2, 2]],
  [[1, 0], [2, 0], [3, 0], [2, 1]],
  [[2, 0]],
  [],
];

function subscribeToPreferences(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PREFERENCES_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PREFERENCES_EVENT, onChange);
  };
}

function getPreferencesSnapshot() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
    return JSON.stringify({
      density: saved.density === "compact" ? "compact" : "comfortable",
      reduceMotion: saved.reduceMotion === true,
    });
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function savePreferences(preferences: { density: "comfortable" | "compact"; reduceMotion: boolean }) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (storageErr) {
    console.warn("Failed to save preferences to localStorage:", storageErr);
  }
  window.dispatchEvent(new Event(PREFERENCES_EVENT));
}

function GeneralSettingsSection() {
  const { theme, setTheme } = useTheme();
  const preferencesSnapshot = useSyncExternalStore(
    subscribeToPreferences,
    getPreferencesSnapshot,
    () => DEFAULT_PREFERENCES,
  );
  const preferences = JSON.parse(preferencesSnapshot) as {
    density: "comfortable" | "compact";
    reduceMotion: boolean;
  };

  useEffect(() => {
    document.documentElement.dataset.mailDensity = preferences.density;
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);
  }, [preferences.density, preferences.reduceMotion]);

  return (
    <Card className="border-border shadow-xs">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Appearance &amp; accessibility</CardTitle>
        <CardDescription className="text-xs">
          Set how Mailing looks and how much motion it uses in this browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        <div className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <label htmlFor="settings-theme" className="text-sm font-medium">Theme</label>
            <p className="text-xs text-muted-foreground">Choose light, dark, or follow your device.</p>
          </div>
          <Select value={theme ?? "system"} onValueChange={(value) => value && setTheme(value)}>
            <SelectTrigger id="settings-theme" className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Inbox density</p>
            <p className="text-xs text-muted-foreground">Show more conversations at once or give each more room.</p>
          </div>
          <ToggleGroup
            multiple={false}
            value={[preferences.density]}
            onValueChange={(values) => {
              const density = values[0];
              if (density === "comfortable" || density === "compact") {
                savePreferences({ ...preferences, density });
              }
            }}
            aria-label="Inbox density"
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
            <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex items-center justify-between gap-4 py-4 last:pb-0">
          <div className="space-y-0.5">
            <label htmlFor="settings-reduced-motion" className="text-sm font-medium">Reduce motion</label>
            <p className="text-xs text-muted-foreground">Limit interface animations and transitions.</p>
          </div>
          <Checkbox
            id="settings-reduced-motion"
            checked={preferences.reduceMotion}
            onCheckedChange={(checked) => savePreferences({ ...preferences, reduceMotion: checked === true })}
            aria-label="Reduce motion"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ── SKELETON LOADER ──────────────────────────────────────────────────────────

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-64 bg-muted rounded-md" />
        <div className="h-4 w-96 bg-muted/60 rounded-md" />
      </div>

      <div className="h-10 w-full max-w-md bg-muted/70 rounded-xl" />

      <Card className="border-border">
        <CardHeader className="space-y-2">
          <div className="h-5 w-48 bg-muted rounded-md" />
          <div className="h-3.5 w-80 bg-muted/60 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 bg-muted rounded-md" />
            <div className="h-9 w-full bg-muted/40 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3.5 w-36 bg-muted rounded-md" />
            <div className="h-9 w-full bg-muted/40 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3.5 w-40 bg-muted rounded-md" />
            <div className="h-9 w-full bg-muted/40 rounded-lg" />
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t border-border pt-4">
          <div className="h-9 w-32 bg-muted rounded-lg" />
        </CardFooter>
      </Card>
    </div>
  );
}

// ── SUB-COMPONENT: SENDING DEFAULTS (MEMOIZED) ───────────────────────────────

interface SendingDefaultsProps {
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  onChange: (field: "senderName" | "senderEmail" | "replyToEmail", value: string) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

const SendingDefaultsSection = React.memo(function SendingDefaultsSection({
  senderName,
  senderEmail,
  replyToEmail,
  onChange,
  onSave,
  saving,
}: SendingDefaultsProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="border-border shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Default Outbound Identity
              </CardTitle>
              <CardDescription className="text-xs">
                These values pre-populate new compose drafts and automated workflows.
              </CardDescription>
            </div>
            {senderEmail && (
              <Badge
                variant="secondary"
                className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              >
                Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Default Sender Name
            </label>
            <Input
              value={senderName}
              onChange={(e) => onChange("senderName", e.target.value)}
              placeholder="e.g. Alex at Acme Corp"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Default From Email
            </label>
            <Input
              type="email"
              value={senderEmail}
              onChange={(e) => onChange("senderEmail", e.target.value)}
              placeholder="alex@verified-domain.com"
              className="h-9 text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Must belong to a domain verified in your Resend account.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Default Reply-To Email
            </label>
            <Input
              type="email"
              value={replyToEmail}
              onChange={(e) => onChange("replyToEmail", e.target.value)}
              placeholder="replies@verified-domain.com"
              className="h-9 text-xs"
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t border-border pt-4">
          <Button type="submit" disabled={saving} className="text-xs h-8.5 px-4 font-semibold">
            {saving ? <Spinner className="size-3.5" /> : "Save Sending Defaults"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
});

// ── SUB-COMPONENT: RESEND INFRASTRUCTURE (MEMOIZED) ──────────────────────────

interface ResendIntegrationProps {
  resendApiKey: string;
  resendWebhookSecret: string;
  onChange: (field: "resendApiKey" | "resendWebhookSecret", value: string) => void;
  onSave: () => Promise<void>;
  onVerify: () => Promise<void>;
  onSync: () => Promise<void>;
  saving: boolean;
  verifying: boolean;
  syncing: boolean;
  verification: {
    valid: boolean;
    domains?: Array<{ id: string; name: string; status: string }>;
    message?: string;
  } | null;
}

const ResendIntegrationSection = React.memo(function ResendIntegrationSection({
  resendApiKey,
  resendWebhookSecret,
  onChange,
  onSave,
  onVerify,
  onSync,
  saving,
  verifying,
  syncing,
  verification,
}: ResendIntegrationProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const reduceMotion = useShouldReduceMotion();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="border-border shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Resend API Connection
              </CardTitle>
              <CardDescription className="text-xs">
                Configure your API key and inbound webhook secret for sending and receiving messages.
              </CardDescription>
            </div>
            {resendApiKey && (
              <Badge
                variant="secondary"
                className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              >
                Credentials Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Resend API Key
            </label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={resendApiKey}
                onChange={(e) => onChange("resendApiKey", e.target.value)}
                placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                className="pr-10 font-mono text-xs h-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground size-7 cursor-pointer"
                aria-label={showApiKey ? "Hide API Key" : "Show API Key"}
              >
                {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Encrypted at rest using AES-256 in your Postgres database.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Resend Webhook Secret
            </label>
            <div className="relative">
              <Input
                type={showWebhookSecret ? "text" : "password"}
                value={resendWebhookSecret}
                onChange={(e) => onChange("resendWebhookSecret", e.target.value)}
                placeholder="whsec_xxxxxxxxxxxxxxxx"
                className="pr-10 font-mono text-xs h-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground size-7 cursor-pointer"
                aria-label={showWebhookSecret ? "Hide Webhook Secret" : "Show Webhook Secret"}
              >
                {showWebhookSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Verifies inbound Svix webhook signatures from Resend.
            </p>
          </div>

          {verification && (
            <div
              className={cn(
                "p-3.5 rounded-xl border text-xs space-y-2 animate-in fade-in-0 duration-200",
                verification.valid
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-destructive/10 border-destructive/30 text-destructive",
              )}
            >
              <div className="flex items-center gap-2 font-semibold">
                {verification.valid ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="size-4 text-destructive shrink-0" />
                )}
                <span>
                  {verification.valid
                    ? "Verified & Operational"
                    : "Verification Failed"}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">{verification.message}</p>
              {verification.domains && verification.domains.length > 0 && (
                <div className="pt-2 border-t border-current/20 flex flex-wrap gap-1.5">
                  {verification.domains.map((d) => (
                    <Badge
                      key={d.id}
                      variant="secondary"
                      className="text-[10px] font-mono"
                    >
                      {d.name} ({d.status})
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-between border-t border-border pt-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onVerify}
              disabled={verifying || !resendApiKey.trim()}
              className="text-xs gap-1.5 h-8.5 font-medium cursor-pointer"
            >
              {verifying ? <Spinner className="size-3.5" /> : <Shield className="size-3.5" />}
              <span>Verify Connection</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={syncing || !resendApiKey.trim()}
              className="text-xs gap-1.5 h-8.5 font-medium cursor-pointer"
            >
              <MotionGrid
                key={syncing ? "syncing" : "importing"}
                gridSize={[5, 5]}
                frames={syncing ? SYNC_FRAMES : IMPORTING_FRAMES}
                duration={140}
                animate={!reduceMotion}
                aria-hidden="true"
                className="w-fit gap-0.5"
              >
                <MotionGridCells
                  className="aspect-square size-0.75 rounded-full bg-current/20"
                  activeProps={{ className: "bg-current/80" }}
                />
              </MotionGrid>
              <RotatingTextContainer
                text={syncing ? "Syncing…" : "Import Emails"}
                align="start"
                aria-live="polite"
              >
                <RotatingText className="text-xs" />
              </RotatingTextContainer>
            </Button>
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="text-xs h-8.5 px-4 font-semibold cursor-pointer"
          >
            {saving ? <Spinner className="size-3.5" /> : "Save API Credentials"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
});

// ── SUB-COMPONENT: ACCOUNT & SECURITY WITH LOGOUT (MEMOIZED) ─────────────────

const AccountSessionSection = React.memo(function AccountSessionSection({
  onLogout,
  loggingOut,
}: {
  onLogout: () => Promise<void>;
  loggingOut: boolean;
}) {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <Card className="border-border shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Active Account Session
              </CardTitle>
              <CardDescription className="text-xs">
                Your credentials and active authentication session in this browser.
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 gap-1.5"
            >
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3.5 p-3 rounded-xl bg-muted/40 border border-border/60">
            <Avatar className="size-11 shrink-0 ring-1 ring-border/50">
              {user?.image && <AvatarImage src={user.image} alt={user.name || "User"} />}
              <AvatarFallback
                style={{
                  background: avatarColor(user?.name || "User"),
                  color: "#ffffff",
                }}
                className="text-xs font-semibold"
              >
                {getInitials(user?.name || "User")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-foreground truncate">
                {user?.name || "User"}
              </div>
              <div className="text-xs text-muted-foreground truncate font-mono">
                {user?.email || "No email"}
              </div>
              <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                Auth ID: <span className="font-mono text-[10px]">{user?.id || "local"}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logout Action Card */}
      <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-destructive flex items-center gap-2">
            <LogOut className="size-4" />
            <span>Sign Out of Workspace</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Terminates your active session in this browser. You will need to sign back in with your credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Signing out clears your local session tokens and disconnects real-time Pusher and webhook synchronization.
          </p>
        </CardContent>
        <CardFooter className="justify-between border-t border-destructive/20 pt-4 flex-wrap gap-3">
          <span className="text-[11px] text-muted-foreground">
            Session expires automatically after inactivity.
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onLogout}
            disabled={loggingOut}
            className="text-xs font-semibold gap-2 h-9 px-4 cursor-pointer shadow-xs"
          >
            {loggingOut ? (
              <>
                <Spinner className="size-3.5" />
                <span>Signing out...</span>
              </>
            ) : (
              <>
                <LogOut className="size-3.5" />
                <span>Sign Out Now</span>
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
});

// ── SUB-COMPONENT: DANGER ZONE (MEMOIZED) ───────────────────────────────────

const DangerZoneSection = React.memo(function DangerZoneSection() {
  const handleClearCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      toast.success("Local cache and storage cleared");
      setTimeout(() => window.location.reload(), 500);
    } catch (clearErr: unknown) {
      console.error("Failed to clear local cache:", clearErr);
      toast.error(extractErrorMessage(clearErr, "Failed to clear local cache"));
    }
  };

  return (
    <Card className="border-destructive/30 shadow-xs">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-destructive">
          Danger Zone
        </CardTitle>
        <CardDescription className="text-xs">
          Irreversible account operations and workspace resets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-destructive/20 bg-destructive/5">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-foreground">
              Reset Local Browser Storage
            </span>
            <p className="text-[11px] text-muted-foreground">
              Clears temporary cached messages, draft state, and indexed filters.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer h-8"
          >
            Clear Cache
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

// ── MASTER SETTINGS VIEW ─────────────────────────────────────────────────────

export function SettingsView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [settings, setSettings] = useState({
    senderName: "",
    senderEmail: "",
    resendApiKey: "",
    resendWebhookSecret: "",
    replyToEmail: "",
  });

  const [verification, setVerification] = useState<{
    valid: boolean;
    domains?: Array<{ id: string; name: string; status: string }>;
    message?: string;
  } | null>(null);

  // Fetch initial settings
  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      try {
        const res = await fetch("/api/v1/settings").then((r) => r.json());
        const data = res?.data || res;
        if (mounted && data && typeof data === "object") {
          setSettings((prev) => ({
            ...prev,
            senderName: data.senderName || prev.senderName || "",
            senderEmail: data.senderEmail || prev.senderEmail || "",
            replyToEmail: data.replyToEmail || data.senderEmail || prev.replyToEmail || "",
            resendApiKey: data.resendApiKey || prev.resendApiKey || "",
            resendWebhookSecret: data.resendWebhookSecret || prev.resendWebhookSecret || "",
          }));
        }
      } catch (loadErr: unknown) {
        console.error("Failed to load settings:", loadErr);
        if (mounted) toast.error(extractErrorMessage(loadErr, "Failed to load settings"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const handleFieldChange = useCallback(
    (field: keyof typeof settings, value: string) => {
      setSettings((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSaveSettings = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }).then((r) => r.json());

      if (res?.success || res?.data) {
        toast.success("Settings saved successfully");
      } else {
        toast.error(res?.error || "Failed to save settings");
      }
    } catch (saveErr: unknown) {
      console.error("Failed to save settings:", saveErr);
      toast.error(extractErrorMessage(saveErr, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const handleVerifyResend = useCallback(async () => {
    if (!settings.resendApiKey.trim()) {
      toast.error("Please enter a Resend API key first");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/v1/resend/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.resendApiKey,
          webhookSecret: settings.resendWebhookSecret,
          senderEmail: settings.senderEmail,
        }),
      }).then((r) => r.json());

      setVerification(res);
      if (res.valid || res.success) {
        toast.success("Resend credentials verified successfully!");
      } else {
        toast.error(res.error || res.message || "Verification failed");
      }
    } catch (verifyErr: unknown) {
      console.error("Failed to verify credentials:", verifyErr);
      toast.error(extractErrorMessage(verifyErr, "Failed to verify credentials"));
    } finally {
      setVerifying(false);
    }
  }, [settings.resendApiKey, settings.resendWebhookSecret, settings.senderEmail]);

  const handleSyncEmails = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(result.message || "Failed to sync emails");
        return;
      }

      const totalNew = result.stats?.totalNew ?? 0;
      toast.success(
        totalNew
          ? `Synced ${totalNew} new email${totalNew === 1 ? "" : "s"}`
          : "Emails are up to date",
      );
    } catch (syncErr: unknown) {
      console.error("Failed to sync emails:", syncErr);
      toast.error(extractErrorMessage(syncErr, "Failed to sync emails"));
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Signed out successfully");
            router.push("/login");
          },
        },
      });
    } catch (logoutErr: unknown) {
      console.error("Failed to sign out:", logoutErr);
      toast.error(extractErrorMessage(logoutErr, "Failed to sign out"));
    } finally {
      setLoggingOut(false);
    }
  }, [router]);

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your preferences, sending setup, integrations, and account.
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-border/60 bg-muted/60 p-1 sm:w-fit">
          <TabsTrigger value="general" className="text-xs gap-1.5 cursor-pointer">
            <SettingsIcon className="size-3.5" />
            <span>General</span>
          </TabsTrigger>
          <TabsTrigger value="sending" className="text-xs gap-1.5 cursor-pointer">
            <SlidersHorizontal className="size-3.5" />
            <span>Sending</span>
          </TabsTrigger>
          <TabsTrigger value="integration" className="text-xs gap-1.5 cursor-pointer">
            <Zap className="size-3.5" />
            <span>Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="text-xs gap-1.5 cursor-pointer">
            <User className="size-3.5" />
            <span>Account</span>
          </TabsTrigger>
          <TabsTrigger
            value="danger"
            className="text-xs gap-1.5 text-destructive hover:text-destructive data-active:text-destructive cursor-pointer"
          >
            <Shield className="size-3.5" />
            <span>Advanced</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="focus-visible:outline-none">
          <GeneralSettingsSection />
        </TabsContent>

        {/* Sending Defaults Tab */}
        <TabsContent value="sending" className="focus-visible:outline-none">
          <SendingDefaultsSection
            senderName={settings.senderName}
            senderEmail={settings.senderEmail}
            replyToEmail={settings.replyToEmail}
            onChange={handleFieldChange}
            onSave={handleSaveSettings}
            saving={saving}
          />
        </TabsContent>

        {/* Resend Infrastructure Tab */}
        <TabsContent value="integration" className="focus-visible:outline-none">
          <ResendIntegrationSection
            resendApiKey={settings.resendApiKey}
            resendWebhookSecret={settings.resendWebhookSecret}
            onChange={handleFieldChange}
            onSave={handleSaveSettings}
            onVerify={handleVerifyResend}
            onSync={handleSyncEmails}
            saving={saving}
            verifying={verifying}
            syncing={syncing}
            verification={verification}
          />
        </TabsContent>

        {/* Account & Session Tab (with Logout) */}
        <TabsContent value="account" className="focus-visible:outline-none">
          <AccountSessionSection
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        </TabsContent>

        {/* Danger Zone Tab */}
        <TabsContent value="danger" className="focus-visible:outline-none">
          <DangerZoneSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
