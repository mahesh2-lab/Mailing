"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  User,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { authClient } from "@/src/lib/auth-client";
import ConfirmDialog from "./confirm-dialog";



function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}



function ProfilePanel() {
  const { data: session, refetch } = authClient.useSession();
  const user = session?.user;

  
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Sync name from session once it arrives
  useEffect(() => {
    if (!user?.name) return;
    const parts = user.name.trim().split(" ").filter(Boolean);
    setFirstName(parts[0] ?? "");
    setLastName(parts.slice(1).join(" ") ?? "");
  }, [user?.name]);

  // password section
  const [showPwSection, setShowPwSection] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState("");

  const displayImage = avatarPreview ?? user?.image ?? null;
  const displayName = user?.name ?? "";

  // ── avatar upload ────────────────────────────────────────────────────────

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
    if (file.size > MAX_SIZE) {
      setProfileError("Image must be under 2 MB.");
      return;
    }

    try {
      setAvatarUploading(true);
      setProfileError("");
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarPreview(dataUrl);

      const { error } = await authClient.updateUser({ image: dataUrl });
      if (error) throw new Error(error.message ?? "Failed to update avatar");
      await refetch();
      flashSaved();
    } catch (err: any) {
      setProfileError(err.message ?? "Failed to upload image");
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── profile save ─────────────────────────────────────────────────────────

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!name) {
      setProfileError("First name is required.");
      return;
    }

    setProfileSaving(true);
    setProfileError("");
    try {
      const { error } = await authClient.updateUser({ name });
      if (error) throw new Error(error.message ?? "Failed to save");
      toast.success("Profile updated successfully");
      await refetch();
      flashSaved();
    } catch (err: any) {
      setProfileError(err.message ?? "Failed to save profile");
      toast.error("Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  }

  

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");

    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("Passwords do not match.");
      return;
    }

    setPwSaving(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: currentPw,
        newPassword: newPw,
        revokeOtherSessions: false,
      });
      if (error) throw new Error(error.message ?? "Failed to change password");
      setPwSaved(true);
      toast.success("Password updated successfully");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err: any) {
      setPwError(err.message ?? "Failed to change password");
      toast.error("Failed to change password");
    } finally {
      setPwSaving(false);
    }
  }

  function flashSaved() {
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 720,
      }}
    >
      {}
      <section className="panel profile-card">
        {}
        <div className="profile-hero">
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div className="profile-avatar-wrap">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt="Profile"
                  className="profile-avatar-img"
                />
              ) : (
                <div className="profile-avatar-initials">
                  {getInitials(displayName)}
                </div>
              )}
              {avatarUploading && (
                <div className="profile-avatar-overlay">
                  <span className="spinner" aria-hidden="true" />
                </div>
              )}
            </div>

            <button
              className="profile-avatar-edit-btn"
              title="Change profile photo"
              aria-label="Change profile photo"
              onClick={() => fileRef.current?.click()}
              disabled={avatarUploading}
            >
              <Camera />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
          </div>

          <div style={{ flex: 1 }}>
            <span className="eyebrow">PERSONAL PROFILE</span>
            <h2 style={{ marginTop: 4 }}>{displayName || "Your Name"}</h2>
            <p style={{ marginTop: 2 }}>{user?.email}</p>
          </div>
        </div>

        {}
        <form onSubmit={handleProfileSave}>
          <div className="profile-form">
            <label className="form-field">
              First name
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
              />
            </label>
            <label className="form-field">
              Last name
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
              />
            </label>
            <label className="form-field full">
              Bio
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short bio about yourself…"
                rows={3}
              />
            </label>
          </div>

          {profileError && <p className="profile-error">{profileError}</p>}

          <div className="profile-actions">
            <button
              type="submit"
              className={`button-primary${profileSaving ? " auth-btn-loading" : ""}`}
              disabled={profileSaving}
            >
              {!profileSaving && <Check />}
              {profileSaving
                ? "Saving…"
                : profileSaved
                  ? "Saved!"
                  : "Save profile"}
            </button>
          </div>
        </form>
      </section>

      {}
      <section className="panel">
        <div
          className="panel-title"
          style={{ marginBottom: showPwSection ? 0 : 0 }}
        >
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Lock style={{ width: 18, opacity: 0.7 }} />
              Password
            </h2>
            <p>Update your login password.</p>
          </div>
          <button
            className="button-secondary"
            onClick={() => {
              setShowPwSection((v) => !v);
              setPwError("");
            }}
          >
            <KeyRound />
            {showPwSection ? "Cancel" : "Change password"}
          </button>
        </div>

        {showPwSection && (
          <form onSubmit={handlePasswordChange} style={{ marginTop: 20 }}>
            <label className="form-field">
              Current password
              <div className="pw-input-wrap">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="pw-toggle-btn"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                >
                  {showCurrent ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
            <label className="form-field">
              New password
              <div className="pw-input-wrap">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="pw-toggle-btn"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
            <label className="form-field">
              Confirm new password
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                autoComplete="new-password"
                required
              />
            </label>

            {}
            {newPw.length > 0 && (
              <div className="pw-strength">
                <div
                  className="pw-strength-bar"
                  data-strength={
                    newPw.length < 6
                      ? "weak"
                      : newPw.length < 10
                        ? "fair"
                        : "strong"
                  }
                />
                <span>
                  {newPw.length < 6
                    ? "Weak"
                    : newPw.length < 10
                      ? "Fair"
                      : "Strong"}
                </span>
              </div>
            )}

            {pwError && <p className="profile-error">{pwError}</p>}

            <div className="profile-actions">
              <button
                type="submit"
                className={`button-primary${pwSaving ? " auth-btn-loading" : ""}`}
                disabled={pwSaving}
              >
                {!pwSaving && (pwSaved ? <Check /> : <KeyRound />)}
                {pwSaving
                  ? "Updating…"
                  : pwSaved
                    ? "Password updated!"
                    : "Update password"}
              </button>
            </div>
          </form>
        )}
      </section>

      {}
      <section className="panel" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
        <div className="panel-title">
          <div>
            <h2 style={{ color: "var(--destructive)" }}>Danger zone</h2>
            <p>These actions cannot be undone.</p>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <strong>Delete account</strong>
            <span>
              Permanently remove your account and all associated data.
            </span>
          </div>
          <button
            className="button-secondary"
            style={{
              borderColor: "var(--destructive)",
              color: "var(--destructive)",
              flexShrink: 0,
            }}
            onClick={() =>
              window.alert("Please contact support to delete your account.")
            }
          >
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}



const PROVIDERS = [
  "Resend",
  "SendGrid",
  "Postmark",
  "Mailgun",
  "Custom",
] as const;

type SavedKey = {
  id: string;
  provider: string;
  domain: string | null;
  keyLastFour: string;
  webhookKeyLastFour: string | null;
  createdAt: string;
  updatedAt: string | null;
};

function ApiKeysPanel() {
  const [keys, setKeys] = useState<SavedKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [domain, setDomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookKey, setWebhookKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookKey, setShowWebhookKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, provider: string } | null>(null);

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/keys");
      const data = await res.json();
      if (data.keys) setKeys(data.keys);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          webhookKey: webhookKey || undefined,
          domain: domain || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      setShowForm(false);
      setApiKey("");
      setWebhookKey("");
      setDomain("");
      await fetchKeys();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(keyProvider: string, id: string) {
    setDeletingId(id);
    try {
      await fetch("/api/v1/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: keyProvider }),
      });
      await fetchKeys();
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  return (
    <section className="panel" style={{ gridColumn: "1 / -1" }}>
      <div className="panel-title">
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <KeyRound style={{ width: 18, opacity: 0.7 }} />
            API Keys
          </h2>
          <p>Connect email providers to send and receive mail.</p>
        </div>
        <button
          className="button-secondary"
          onClick={() => {
            setShowForm((v) => !v);
            setError("");
          }}
        >
          <Plus />
          {showForm ? "Cancel" : "Add key"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <div className="profile-form">
            <label className="form-field">
              Provider
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as typeof provider)}
              >
                {PROVIDERS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Sending domain{" "}
              <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="mail.example.com"
              />
            </label>
            <label className="form-field full">
              API key
              <div className="pw-input-wrap">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key here"
                  required
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="pw-toggle-btn"
                  onClick={() => setShowApiKey((v) => !v)}
                  aria-label={showApiKey ? "Hide key" : "Show key"}
                >
                  {showApiKey ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
            <label className="form-field full">
              Webhook signing secret{" "}
              <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span>
              <div className="pw-input-wrap">
                <input
                  type={showWebhookKey ? "text" : "password"}
                  value={webhookKey}
                  onChange={(e) => setWebhookKey(e.target.value)}
                  placeholder="Paste webhook secret"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="pw-toggle-btn"
                  onClick={() => setShowWebhookKey((v) => !v)}
                  aria-label={showWebhookKey ? "Hide secret" : "Show secret"}
                >
                  {showWebhookKey ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
          </div>

          {error && <p className="profile-error">{error}</p>}

          <div className="profile-actions">
            <button
              type="submit"
              className={`button-primary${saving ? " auth-btn-loading" : ""}`}
              disabled={saving}
            >
              {!saving && (success ? <Check /> : <KeyRound />)}
              {saving ? "Saving…" : success ? "Saved!" : "Save key"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ marginTop: 16, opacity: 0.5 }}>Loading…</p>
      ) : keys.length === 0 ? (
        <div className="empty-page-state" style={{ marginTop: 16 }}>
          <KeyRound />
          <strong>No API keys saved</strong>
          <span>Add a provider key to start sending mail.</span>
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {keys.map((k) => (
            <div className="setting-row" key={k.id}>
              <div>
                <strong>{k.provider}</strong>
                <span>
                  ···· {k.keyLastFour}
                  {k.domain && <> · {k.domain}</>}
                  {k.webhookKeyLastFour && (
                    <> · webhook ···· {k.webhookKeyLastFour}</>
                  )}
                </span>
              </div>
              <button
                className="button-secondary"
                style={{
                  color: "var(--destructive)",
                  borderColor: "rgba(239,68,68,0.4)",
                  flexShrink: 0,
                }}
                disabled={deletingId === k.id}
                onClick={() => setConfirmDelete({ id: k.id, provider: k.provider })}
                aria-label={`Remove ${k.provider} key`}
              >
                <Trash2 style={{ width: 14 }} />
                {deletingId === k.id ? "Removing…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Remove API Key"
        description={`Are you sure you want to remove the ${confirmDelete?.provider} API key? This action cannot be undone and mail sending/receiving may stop working.`}
        confirmLabel="Remove key"
        onConfirm={() => {
          if (confirmDelete) handleDelete(confirmDelete.provider, confirmDelete.id);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}



const pageData = {
  automation: {
    eyebrow: "WORKFLOWS",
    title: "Automation",
    description: "Let Mailing handle the repetitive parts of your inbox.",
  },
  settings: {
    eyebrow: "ACCOUNT",
    title: "Settings",
    description: "Tune your workspace, notifications, and security.",
  },
  profile: {
    eyebrow: "ACCOUNT",
    title: "Profile",
    description: "Your identity and personal preferences.",
  },
  contacts: {
    eyebrow: "PEOPLE",
    title: "Contacts",
    description: "Keep your most important correspondents close.",
  },
  help: {
    eyebrow: "SUPPORT",
    title: "Help center",
    description: "Answers for getting more from Mailing.",
  },
} as const;

type PageKey = keyof typeof pageData;



export function SitePage({ type }: { type: PageKey }) {
  const [saved, setSaved] = useState(false);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    receipts: true,
    newsletter: false,
    followups: true,
  });
  const [query, setQuery] = useState("");
  const data = pageData[type];

  const notify = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };
  const toggle = (key: string) =>
    setEnabled((state) => ({ ...state, [key]: !state[key] }));

  return (
    <main className="site-page">
      <nav className="site-nav">
        <a className="site-brand" href="/inbox">
          <span className="site-brand-mark">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="M2 7l10 7 10-7" />
            </svg>
          </span>
          Mailing
        </a>
        <div className="site-links">
          <a href="/inbox">Inbox</a>
          <a href="/contacts">Contacts</a>
          <a href="/automations">Automations</a>
          <a href="/help">Help</a>
          <a href="/profile">Profile</a>
        </div>
      </nav>
      <header className="page-header">
        <div>
          <span className="eyebrow">{data.eyebrow}</span>
          <h1>{data.title}</h1>
          <p>{data.description}</p>
        </div>
        {type !== "profile" && (
          <button className="button-primary" onClick={notify}>
            <Check /> Save changes
          </button>
        )}
      </header>

      {type === "automation" && (
        <div className="page-grid">
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Rules</h2>
                <p>Automations run quietly in the background.</p>
              </div>
              <Zap />
            </div>
            {[
              [
                "receipts",
                "Receipts to Finance",
                "Move receipts and invoices to Finance",
              ],
              [
                "newsletter",
                "Newsletter digest",
                "Bundle newsletters into a daily digest",
              ],
              [
                "followups",
                "Follow-up reminders",
                "Remind me when a thread needs a reply",
              ],
            ].map(([key, title, copy]) => (
              <div className="setting-row" key={key}>
                <div>
                  <strong>{title}</strong>
                  <span>{copy}</span>
                </div>
                <button
                  className={`toggle ${enabled[key] ? "on" : ""}`}
                  onClick={() => toggle(key)}
                  aria-label={`Toggle ${title}`}
                >
                  <i />
                </button>
              </div>
            ))}
          </section>
          <section className="panel accent-panel">
            <Mail />
            <h2>Build a rule</h2>
            <p>
              Start with a sender, subject, or attachment. Mailing will suggest
              the next step.
            </p>
            <button className="text-button" onClick={notify}>
              Create automation <ChevronRight />
            </button>
          </section>
        </div>
      )}

      {type === "settings" && (
        <div className="page-grid">
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>General</h2>
                <p>How Mailing behaves for you.</p>
              </div>
              <SlidersHorizontal />
            </div>
            <label className="form-field">
              Display name
              <input placeholder="Enter your display name" />
            </label>
            <label className="form-field">
              Email address
              <input type="email" placeholder="Enter your email address" />
            </label>
            <label className="form-field">
              Theme
              <select defaultValue="System">
                <option>System</option>
                <option>Light</option>
                <option>Dark</option>
              </select>
            </label>
          </section>
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Notifications</h2>
                <p>Choose when Mailing speaks up.</p>
              </div>
              <CircleHelp />
            </div>
            {["Desktop notifications", "Unread digest", "Sound effects"].map(
              (item, index) => (
                <div className="setting-row" key={item}>
                  <strong>{item}</strong>
                  <button
                    className={`toggle ${index < 2 ? "on" : ""}`}
                    onClick={notify}
                  >
                    <i />
                  </button>
                </div>
              ),
            )}
          </section>
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Data Sync</h2>
                <p>Manually sync emails with the server.</p>
              </div>
              <Mail />
            </div>
            <div className="setting-row">
              <div>
                <strong>Sync Emails</strong>
                <span>Fetch the latest sent and received emails</span>
              </div>
              <button
                className="button-secondary"
                onClick={async () => {
                  toast.loading("Syncing emails...", { id: "sync" });
                  try {
                    const res = await fetch("/api/sync", { method: "POST" });
                    if (!res.ok) throw new Error("Sync failed");
                    toast.success("Emails synced successfully", { id: "sync" });
                  } catch (e) {
                    toast.error("Failed to sync emails", { id: "sync" });
                  }
                }}
              >
                Sync Now
              </button>
            </div>
          </section>
          <ApiKeysPanel />
        </div>
      )}

      {type === "profile" && <ProfilePanel />}

      {type === "contacts" && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>People you email</h2>
              <p>Connect an account to sync your contacts.</p>
            </div>
            <button className="button-secondary" onClick={notify}>
              <UserPlus /> Add contact
            </button>
          </div>
          <div className="empty-page-state">
            <Users />
            <strong>No contacts connected</strong>
            <span>Add an account connection to see people you email.</span>
          </div>
        </section>
      )}

      {type === "help" && (
        <div className="help-layout">
          <section className="help-search">
            <Search />
            <input
              placeholder="Search help articles"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </section>
          <div className="help-cards">
            {[
              ["Getting started", "Learn the basics of your new inbox."],
              ["Keyboard shortcuts", "Move faster with quick actions."],
              ["Privacy & security", "Understand how your mail is protected."],
            ]
              .filter(([title, copy]) =>
                `${title} ${copy}`.toLowerCase().includes(query.toLowerCase()),
              )
              .map(([title, copy]) => (
                <button className="help-card" key={title} onClick={notify}>
                  <div>
                    <strong>{title}</strong>
                    <span>{copy}</span>
                  </div>
                  <ChevronRight />
                </button>
              ))}
          </div>
          <div className="panel support-panel">
            <Shield />
            <div>
              <h2>Still need a hand?</h2>
              <p>Our support team is here to help with anything unusual.</p>
            </div>
            <button className="text-button" onClick={notify}>
              Contact support <ChevronRight />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export function NotFoundPage() {
  return (
    <main className="site-page not-found">
      <span className="eyebrow">404 / NOT FOUND</span>
      <h1>That page is missing.</h1>
      <p>
        The link may have moved, but your inbox is still right where you left
        it.
      </p>
      <a className="button-primary" href="/inbox">
        Return to inbox
      </a>
    </main>
  );
}
