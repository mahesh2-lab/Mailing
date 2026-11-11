"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Eye,
  EyeOff,
  Search,
  Edit,
  Trash2,
  UserPlus,
  Users,
} from "@/components/animate-ui/icons";
import { authClient } from "@/src/lib/auth-client";
import ConfirmDialog from "./confirm-dialog";
import { AuthenticatedPageShell } from "./authenticated-page-shell";
import { SettingsView } from "./settings/settings-view";
import { compressImage, validateImageFile } from "@/lib/image-compressor";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { getInitials, avatarColor } from "@/lib/utils";

// ── Profile Panel ────────────────────────────────────────────────────────────

function ProfilePanel() {
  const { data: session, refetch } = authClient.useSession();
  const user = session?.user;

  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [firstNameOverride, setFirstNameOverride] = useState<string | null>(null);
  const [lastNameOverride, setLastNameOverride] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const nameParts = (user?.name ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = firstNameOverride ?? nameParts[0] ?? "";
  const lastName = lastNameOverride ?? nameParts.slice(1).join(" ");

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
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to upload image");
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
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
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
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed to change password");
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
                  onChange={(e) => setFirstNameOverride(e.target.value)}
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Last name</label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastNameOverride(e.target.value)}
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
            <CardContent className="space-y-4 border-t border-border pt-4 pb-4">
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
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // New Contact Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete Target
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  async function loadContacts(): Promise<Contact[]> {
    const res = await fetch("/api/v1/contacts").then((r) => r.json());
    return Array.isArray(res?.data) ? res.data : [];
  }

  async function refreshContacts() {
    setLoading(true);
    try {
      setContacts(await loadContacts());
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    loadContacts()
      .then((data) => {
        if (active) setContacts(data);
      })
      .catch(() => {
        if (active) toast.error("Failed to load contacts");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function openNewContact() {
    setEditingContact(null);
    setName("");
    setEmail("");
    setNotes("");
    setDialogOpen(true);
  }

  function openEditContact(contact: Contact) {
    setEditingContact(contact);
    setName(contact.name);
    setEmail(contact.email);
    setNotes(contact.notes || "");
    setDialogOpen(true);
  }

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(
        editingContact ? `/api/v1/contacts/${editingContact.id}` : "/api/v1/contacts",
        {
          method: editingContact ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), notes: notes.trim() }),
        },
      ).then((response) => response.json());

      if (res?.data) {
        const savedContact = res.data as Contact;
        setContacts((current) =>
          editingContact
            ? current.map((contact) => contact.id === savedContact.id ? savedContact : contact)
            : [savedContact, ...current],
        );
        toast.success(
          editingContact
            ? `Contact "${savedContact.name}" updated`
            : `Contact "${savedContact.name}" added`,
        );
        setDialogOpen(false);
        setEditingContact(null);
        setName("");
        setEmail("");
        setNotes("");
      } else {
        toast.error(res?.error || `Failed to ${editingContact ? "update" : "add"} contact`);
      }
    } catch {
      toast.error(`Failed to ${editingContact ? "update" : "add"} contact`);
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
      refreshContacts();
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
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary sm:flex">
            <Users className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Address Book</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Keep the people you write to close at hand. Contacts appear as recipient suggestions when you compose.
            </p>
          </div>
        </div>
        <Button onClick={openNewContact} className="h-10 gap-2 self-start sm:self-auto">
          <UserPlus className="size-4" data-icon="inline-start" />
          <span>Add contact</span>
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts by name or email"
            className="h-10 border-border/70 bg-card/60 pl-9"
          />
        </div>
        <span className="px-1 text-xs text-muted-foreground" aria-live="polite">
          {loading ? "Loading contacts…" : `${filtered.length} ${filtered.length === 1 ? "contact" : "contacts"}`}
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/30">
        {loading ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-8">
            <Spinner className="size-5 text-primary" />
            <p className="text-sm text-muted-foreground">Loading your address book…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
              <Users className="size-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">
                {search ? "No contacts found" : "Your address book is empty"}
              </h3>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                {search
                  ? `No contact matches “${search}”. Try another name or email.`
                  : "Add the people you email often and they’ll be ready as recipient suggestions."}
              </p>
            </div>
            {!search && (
              <Button variant="outline" size="sm" onClick={openNewContact} className="mt-1">
                <UserPlus className="size-4" data-icon="inline-start" />
                Add your first contact
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((c) => (
              <li key={c.id} className="group flex min-w-0 items-center gap-3 px-4 py-4 transition-colors hover:bg-accent/30 sm:gap-4 sm:px-5">
                <Avatar className="size-11 shrink-0 ring-1 ring-border/70">
                  <AvatarFallback
                    style={{ background: avatarColor(c.name), color: "#ffffff" }}
                    className="text-xs font-semibold"
                  >
                    {getInitials(c.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-6">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground/80 sm:text-sm">
                    {c.notes || <span className="text-muted-foreground/50">No notes</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-9 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
                    onClick={() => openEditContact(c)}
                    aria-label={`Edit ${c.name}`}
                  >
                    <Edit className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-9 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95"
                    onClick={() => setDeleteTarget(c)}
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add Contact Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setEditingContact(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveContact}>
            <DialogHeader>
              <DialogTitle>{editingContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
              <DialogDescription>
                {editingContact ? "Update this contact in your address book." : "Add a new recipient to your Mailing address book."}
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
                {saving ? <Spinner className="size-3.5" /> : editingContact ? "Save changes" : "Save Contact"}
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

// ── Settings Panel (Optimized & Memoized) ────────────────────────────────────

const SettingsPanel = SettingsView;

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
  const titles = {
    profile: "Profile Details",
    contacts: "Contacts",
    settings: "Settings",
    help: "Help & Support",
  };

  return (
    <AuthenticatedPageShell title={titles[type]}>
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
