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
import { SiteNav } from "./site-nav";
import { AuthenticatedPageShell } from "./authenticated-page-shell";
import { compressImage, validateImageFile } from "@/lib/image-compressor";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { getInitials, avatarColor, cn } from "@/lib/utils";

// ── Profile Panel ────────────────────────────────────────────────────────────

function ProfilePanel() {
  const { data: session, refetch } = authClient.useSession();
  const user = session?.user;

  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    if (!user?.name) return;
    const parts = user.name.trim().split(" ").filter(Boolean);
    setFirstName(parts[0] ?? "");
    setLastName(parts.slice(1).join(" ") ?? "");
  }, [user?.name]);

  const [showPwSection, setShowPwSection] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  const displayImage = avatarPreview ?? user?.image ?? null;
  const displayName = user?.name ?? "";

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file, {
      maxSizeBytes: 15 * 1024 * 1024,
    });
    if (!validation.valid) {
      setProfileError(validation.error || "Please upload a valid image under 15 MB.");
      return;
    }

    try {
      setAvatarUploading(true);
      setProfileError("");

      const result = await compressImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.82,
        cropToSquare: true,
        maxOutputSizeBytes: 150 * 1024,
      });

      setAvatarPreview(result.dataUrl);

      const { error } = await authClient.updateUser({ image: result.dataUrl });
      if (error) throw new Error(error.message ?? "Failed to update avatar");
      await refetch();
      toast.success(`Avatar updated (${result.formattedCompressedSize})`);
    } catch (err: any) {
      setProfileError(err.message ?? "Failed to upload image");
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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
    } catch (err: any) {
      setProfileError(err.message ?? "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPw) {
      setPwError("Current password is required.");
      return;
    }
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("Passwords do not match.");
      return;
    }

    setPwSaving(true);
    setPwError("");
    try {
      const { error } = await authClient.changePassword({
        currentPassword: currentPw,
        newPassword: newPw,
        revokeOtherSessions: false,
      });
      if (error) throw new Error(error.message ?? "Failed to change password");
      toast.success("Password changed successfully");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setShowPwSection(false);
    } catch (err: any) {
      setPwError(err.message ?? "Failed to change password");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Profile Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Profile Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal account details, avatar, and security credentials.
        </p>
      </div>

      {/* Avatar Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
          <CardDescription>
            Your picture will appear on outgoing messages and within your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative group/avatar">
            <Avatar className="size-20 border-2 border-border shadow-xs">
              {displayImage ? (
                <AvatarImage src={displayImage} alt={displayName} />
              ) : null}
              <AvatarFallback
                className="text-lg font-bold bg-primary text-primary-foreground"
                style={
                  !displayImage && displayName
                    ? { background: avatarColor(displayName), color: "#ffffff" }
                    : undefined
                }
              >
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 transition-opacity"
              aria-label="Upload profile image"
            >
              {avatarUploading ? (
                <Spinner className="size-3.5" />
              ) : (
                <Camera className="size-3.5" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                className="text-xs"
              >
                Upload image
              </Button>
              {displayImage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    setAvatarPreview(null);
                    await authClient.updateUser({ image: null });
                    await refetch();
                    toast.success("Avatar removed");
                  }}
                  className="text-xs text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Square WebP or PNG recommended. Max 15 MB.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Basic Info Card */}
      <form onSubmit={handleProfileSave}>
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your name and contact email address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                {profileError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">First name</label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Last name</label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Email address</label>
              <Input value={user?.email ?? ""} disabled className="bg-muted/50 opacity-80" />
              <p className="text-[11px] text-muted-foreground">
                Email address is managed through your authentication provider.
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t border-border pt-4">
            <Button type="submit" disabled={profileSaving} className="text-xs">
              {profileSaving ? <Spinner className="size-3.5" /> : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Security / Password Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Password & Security</CardTitle>
            <CardDescription>
              Keep your account secure with a strong password.
            </CardDescription>
          </div>
          {!showPwSection && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPwSection(true)}
              className="text-xs"
            >
              Change password
            </Button>
          )}
        </CardHeader>

        {showPwSection && (
          <form onSubmit={handlePasswordSave}>
            <CardContent className="space-y-4 border-t border-border pt-4">
              {pwError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                  {pwError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Current password</label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">New password</label>
                  <div className="relative">
                    <Input
                      type={showNew ? "text" : "password"}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Confirm new password</label>
                  <Input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="justify-between border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowPwSection(false);
                  setPwError("");
                }}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pwSaving} className="text-xs">
                {pwSaving ? <Spinner className="size-3.5" /> : "Update Password"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}

// ── Contacts Panel ───────────────────────────────────────────────────────────

interface Contact {
  id: string;
  name: string;
  email: string;
  notes?: string | null;
  createdAt: string;
}

function ContactsPanel() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // New Contact Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete Target
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  async function loadContacts() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/contacts").then((r) => r.json());
      if (res?.data) setContacts(res.data);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  async function handleCreateContact(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/v1/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), notes: notes.trim() }),
      }).then((r) => r.json());

      if (res?.data) {
        toast.success(`Contact "${name}" added`);
        setDialogOpen(false);
        setName("");
        setEmail("");
        setNotes("");
        loadContacts();
      } else {
        toast.error(res?.error || "Failed to add contact");
      }
    } catch {
      toast.error("Failed to add contact");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteContact() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/v1/contacts/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`Contact "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      loadContacts();
    } catch {
      toast.error("Failed to delete contact");
    }
  }

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Address Book</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage personal and professional contacts to auto-complete recipients in compose.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5 self-start">
          <UserPlus className="size-4" data-icon="inline-start" />
          <span>Add Contact</span>
        </Button>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9 h-9 bg-card"
        />
      </div>

      {/* Contacts List / Table */}
      {loading ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <Spinner className="size-6 text-primary" />
          <p className="text-xs text-muted-foreground">Loading your address book...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Users className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-foreground">
              {search ? "No contacts found" : "No contacts yet"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              {search
                ? `No contact matches your query "${search}"`
                : "Add your frequently emailed contacts for rapid access and auto-complete."}
            </p>
          </div>
          {!search && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="mt-2 text-xs"
            >
              Add first contact
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="p-4 flex items-center justify-between gap-3 hover:border-border/80 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="size-10 border border-border shrink-0">
                  <AvatarFallback
                    style={{ background: avatarColor(c.name), color: "#ffffff" }}
                    className="text-xs font-semibold"
                  >
                    {getInitials(c.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm text-foreground truncate">
                    {c.name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {c.email}
                  </span>
                  {c.notes && (
                    <span className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                      {c.notes}
                    </span>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon-xs"
                className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => setDeleteTarget(c)}
                aria-label={`Delete ${c.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Add Contact Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateContact}>
            <DialogHeader>
              <DialogTitle>Add Contact</DialogTitle>
              <DialogDescription>
                Add a new recipient to your Mailing address book.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Full Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Notes / Tags (Optional)</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Design lead, Acme Corp"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !name.trim() || !email.trim()} className="text-xs">
                {saving ? <Spinner className="size-3.5" /> : "Save Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Contact Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={`Delete contact "${deleteTarget?.name}"?`}
        description={`This will permanently remove ${deleteTarget?.email} from your address book.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteContact}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

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

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const res = await fetch("/api/v1/settings").then((r) => r.json());
        const data = res?.data || res;
        if (data && typeof data === "object") {
          setSettings((prev) => ({
            ...prev,
            senderName: data.senderName || prev.senderName || "",
            senderEmail: data.senderEmail || prev.senderEmail || "",
            replyToEmail: data.replyToEmail || data.senderEmail || prev.replyToEmail || "",
            resendApiKey: data.resendApiKey || prev.resendApiKey || "",
            resendWebhookSecret: data.resendWebhookSecret || prev.resendWebhookSecret || "",
          }));
        }
      } catch {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
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
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyResend() {
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
    } catch {
      toast.error("Failed to verify credentials");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Preferences & Integration</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure default sending profiles, API connections, and inbox preferences.
        </p>
      </div>

      <Tabs defaultValue="sending" className="space-y-6">
        <TabsList className="bg-muted/80 h-9 p-1">
          <TabsTrigger value="sending">
            <SlidersHorizontal className="size-3.5" />
            <span>Sending Defaults</span>
          </TabsTrigger>
          <TabsTrigger value="integration">
            <Zap className="size-3.5" />
            <span>Resend Infrastructure</span>
          </TabsTrigger>
          <TabsTrigger value="danger" className="text-destructive hover:text-destructive data-active:text-destructive">
            <Shield className="size-3.5" />
            <span>Danger Zone</span>
          </TabsTrigger>
        </TabsList>

        {/* Sending Tab */}
        <TabsContent value="sending">
          <form onSubmit={handleSaveSettings}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Default Outbound Identity</CardTitle>
                    <CardDescription>
                      These values pre-populate new compose drafts and automated workflows.
                    </CardDescription>
                  </div>
                  {settings.senderEmail && (
                    <Badge variant="secondary" className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                      Configured in DB
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Default Sender Name</label>
                  <Input
                    value={settings.senderName}
                    onChange={(e) => setSettings({ ...settings, senderName: e.target.value })}
                    placeholder="e.g. Alex at Acme Corp"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Default From Email</label>
                  <Input
                    type="email"
                    value={settings.senderEmail}
                    onChange={(e) => setSettings({ ...settings, senderEmail: e.target.value })}
                    placeholder="alex@verified-domain.com"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Must belong to a domain verified in your Resend account.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Default Reply-To Email</label>
                  <Input
                    type="email"
                    value={settings.replyToEmail}
                    onChange={(e) => setSettings({ ...settings, replyToEmail: e.target.value })}
                    placeholder="replies@verified-domain.com"
                  />
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t border-border pt-4">
                <Button type="submit" disabled={saving} className="text-xs">
                  {saving ? <Spinner className="size-3.5" /> : "Save Sending Defaults"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>

        {/* Integration Tab */}
        <TabsContent value="integration">
          <form onSubmit={handleSaveSettings}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Resend API Connection</CardTitle>
                    <CardDescription>
                      Configure your API key and inbound webhook secret for sending and receiving messages.
                    </CardDescription>
                  </div>
                  {settings.resendApiKey && (
                    <Badge variant="secondary" className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                      Credentials Active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Resend API Key</label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={settings.resendApiKey}
                      onChange={(e) => setSettings({ ...settings, resendApiKey: e.target.value })}
                      placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                      className="pr-10 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground size-7"
                      aria-label={showApiKey ? "Hide API Key" : "Show API Key"}
                    >
                      {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Loaded from encrypted storage in your database.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Resend Webhook Secret</label>
                  <div className="relative">
                    <Input
                      type={showWebhookSecret ? "text" : "password"}
                      value={settings.resendWebhookSecret}
                      onChange={(e) => setSettings({ ...settings, resendWebhookSecret: e.target.value })}
                      placeholder="whsec_xxxxxxxxxxxxxxxx"
                      className="pr-10 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground size-7"
                      aria-label={showWebhookSecret ? "Hide Webhook Secret" : "Show Webhook Secret"}
                    >
                      {showWebhookSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Required to cryptographically verify inbound email webhooks from Resend.
                  </p>
                </div>

                {verification && (
                  <div className={cn(
                    "p-4 rounded-xl border text-xs space-y-2",
                    verification.valid
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  )}>
                    <span className="font-semibold block">
                      {verification.valid ? "Verified & Operational" : "Verification Failed"}
                    </span>
                    <p>{verification.message}</p>
                    {verification.domains && verification.domains.length > 0 && (
                      <div className="pt-2 border-t border-current/20 flex flex-wrap gap-1.5">
                        {verification.domains.map((d) => (
                          <Badge key={d.id} variant="secondary" className="text-[10px]">
                            {d.name} ({d.status})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-between border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyResend}
                  disabled={verifying || !settings.resendApiKey.trim()}
                  className="text-xs gap-1.5"
                >
                  {verifying ? <Spinner className="size-3.5" /> : <Shield className="size-3.5" />}
                  <span>Verify Connection</span>
                </Button>
                <Button type="submit" disabled={saving} className="text-xs">
                  {saving ? <Spinner className="size-3.5" /> : "Save API Credentials"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>

        {/* Danger Zone Tab */}
        <TabsContent value="danger">
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible account operations and workspace resets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground">Reset Local Cache</span>
                  <p className="text-[11px] text-muted-foreground">
                    Clears temporary local browser indexed storage and refreshes all folders.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    localStorage.clear();
                    toast.success("Cache cleared");
                    window.location.reload();
                  }}
                  className="text-xs"
                >
                  Clear Cache
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Help Panel ───────────────────────────────────────────────────────────────

function HelpPanel() {
  const shortcuts = [
    { key: "⌘ K / Ctrl K", action: "Focus Global Search" },
    { key: "⌘ N / Ctrl N", action: "Open Compose Window" },
    { key: "C", action: "Compose (when outside inputs)" },
    { key: "⌘ Enter", action: "Send Email in Compose" },
    { key: "Esc", action: "Close Compose / Clear Email Viewer" },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Help & Resources</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Keyboard shortcuts, setup documentation, and quick reference guides.
        </p>
      </div>

      {/* Keyboard Shortcuts Card */}
      <Card>
        <CardHeader>
          <CardTitle>Keyboard Shortcuts</CardTitle>
          <CardDescription>
            Mailing is designed for speed. Use shortcuts to navigate without lifting your hands from the keyboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/60">
            {shortcuts.map((s) => (
              <div key={s.key} className="py-2.5 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{s.action}</span>
                <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border border-border bg-muted px-2 font-mono text-[11px] font-medium text-muted-foreground">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Setup Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 space-y-2">
          <h4 className="font-semibold text-sm text-foreground">Documentation Portal</h4>
          <p className="text-xs text-muted-foreground">
            Explore step-by-step guides on domain DNS verification, Resend webhooks, and automated workflows.
          </p>
          <Link
            href="/docs"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "text-xs mt-2 self-start",
            })}
          >
            View Documentation
          </Link>
        </Card>

        <Card className="p-4 space-y-2 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-sm text-foreground">Workflow Automations</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Build reactive visual automation flows that filter, label, forward, or reply to incoming emails.
            </p>
          </div>
          <Link
            href="/automations"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "text-xs mt-2 self-start",
            })}
          >
            Open Automations
          </Link>
        </Card>
      </div>
    </div>
  );
}

// ── Master SitePage Wrapper ──────────────────────────────────────────────────

export function SitePage({
  type,
}: {
  type: "profile" | "contacts" | "settings" | "help";
}) {
  const meta = {
    profile: {
      title: "Profile Details",
      description: "Manage your credentials, display name, and avatar.",
    },
    contacts: {
      title: "Contacts",
      description: "Address book, frequent correspondents, and recipient groups.",
    },
    settings: {
      title: "Settings",
      description: "Configure Resend API credentials, webhook endpoints, and app preferences.",
    },
    help: {
      title: "Help & Support",
      description: "Frequently asked questions, troubleshooting, and documentation.",
    },
  }[type];

  return (
    <AuthenticatedPageShell
      title={meta.title}
      description={meta.description}
    >
      {type === "profile" && <ProfilePanel />}
      {type === "contacts" && <ContactsPanel />}
      {type === "settings" && <SettingsPanel />}
      {type === "help" && <HelpPanel />}
    </AuthenticatedPageShell>
  );
}

export function NotFoundPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground text-center space-y-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-foreground border border-border shadow-xs">
        <span className="text-xl font-bold">404</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Page Not Found</h1>
      <p className="text-xs text-muted-foreground max-w-sm">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="pt-2">
        <Link
          href="/inbox"
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          Return to Inbox
        </Link>
      </div>
    </main>
  );
}
