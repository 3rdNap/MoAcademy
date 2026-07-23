"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, KeyRound, User as UserIcon } from "lucide-react";
import { Widget } from "@/components/ui/Widget";
import { Button } from "@/components/ui/Button";
import { Label, Field, Input } from "@/components/ui/form";
import { Avatar } from "@/components/ui/Avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const PROFILE_KEY = "moacademy.account.profile";
const NOTIF_KEY = "moacademy.account.notifications";

// No shared avatar palette exists in src/lib or src/components/ui yet, so a
// small preset lives here.
const AVATAR_COLORS = [
  "#0284c7", // sky (default)
  "#7c3aed", // violet
  "#db2777", // pink
  "#dc2626", // red
  "#ea580c", // orange
  "#ca8a04", // amber
  "#16a34a", // green
  "#0d9488", // teal
];

// Mirrors the forced first-login flow in SetPasswordCard.
const MIN_PASSWORD_LENGTH = 8;

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const timezones = [
  "GMT+2 · Johannesburg",
  "GMT+0 · London",
  "GMT+1 · Lagos",
  "GMT-5 · New York",
  "GMT+5:30 · Mumbai",
];

const notifFields = [
  { key: "announcements", label: "Announcements" },
  { key: "grades", label: "Grade postings" },
  { key: "due", label: "Due-date reminders" },
  { key: "discussions", label: "Discussion replies" },
] as const;

type NotifKey = (typeof notifFields)[number]["key"];
type Notifs = Record<NotifKey, boolean>;

const defaultNotifs: Notifs = {
  announcements: true,
  grades: true,
  due: true,
  discussions: false,
};

export function AccountSettings({
  fullName,
  email,
  avatarColor,
}: {
  fullName: string;
  email: string;
  avatarColor: string;
}) {
  const [displayName, setDisplayName] = useState(fullName.split(" ")[0]);
  const [timezone, setTimezone] = useState(timezones[0]);
  const [notifs, setNotifs] = useState<Notifs>(defaultNotifs);
  const [hydrated, setHydrated] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const skipFirstSave = useRef(true);

  // When signed in, the full name is editable and saved to the profiles row
  // (the name the whole app — and instructors' gradebooks — will show).
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(fullName);
  const [profileState, setProfileState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    let alive = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (alive && user) setUserId(user.id);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function saveProfile() {
    const supabase = createSupabaseBrowserClient();
    const name = profileName.trim();
    if (!supabase || !userId || !name) return;
    setProfileState("saving");
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name })
      .eq("id", userId);
    if (error) {
      setProfileState("error");
      return;
    }
    setProfileState("saved");
    router.refresh(); // top bar + pages pick up the new name
    setTimeout(() => setProfileState("idle"), 1800);
  }

  const [selectedColor, setSelectedColor] = useState(avatarColor);
  const [colorState, setColorState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function saveAvatarColor() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || !userId) return;
    setColorState("saving");
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_color: selectedColor })
      .eq("id", userId);
    if (error) {
      setColorState("error");
      return;
    }
    setColorState("saved");
    router.refresh(); // top-bar avatar picks up the new color
    setTimeout(() => setColorState("idle"), 1800);
  }

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const passwordTouched = newPassword.length > 0 || confirmPassword.length > 0;
  const passwordValid =
    newPassword.length >= MIN_PASSWORD_LENGTH && newPassword === confirmPassword;

  async function savePassword() {
    setPasswordError(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The passwords don't match.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setPasswordError("Sign-in isn't available on this deployment.");
      return;
    }
    setPasswordState("saving");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordError(error.message);
      setPasswordState("error");
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPasswordState("saved");
    setTimeout(() => setPasswordState("idle"), 1800);
  }

  useEffect(() => {
    try {
      const p = localStorage.getItem(PROFILE_KEY);
      if (p) {
        const parsed = JSON.parse(p) as { displayName?: string; timezone?: string };
        if (parsed.displayName) setDisplayName(parsed.displayName);
        if (parsed.timezone) setTimezone(parsed.timezone);
      }
      const n = localStorage.getItem(NOTIF_KEY);
      if (n) setNotifs({ ...defaultNotifs, ...(JSON.parse(n) as Notifs) });
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Persist on change after hydration, with a brief "Saved" flash.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ displayName, timezone }),
      );
      localStorage.setItem(NOTIF_KEY, JSON.stringify(notifs));
    } catch {
      /* ignore */
    }
    // Don't flash "Saved" for the initial load-from-storage pass.
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), 1800);
    return () => clearTimeout(t);
  }, [displayName, timezone, notifs, hydrated]);

  return (
    <div className="space-y-6">
      <Widget
        title="Profile"
        icon={<UserIcon className="h-4 w-4 text-brand-600" />}
        action={<SavedTag show={showSaved} />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {userId ? (
            <div>
              <Label htmlFor="profileName">Full name</Label>
              <div className="flex gap-2">
                <input
                  id="profileName"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="focus-ring w-full rounded-lg border border-black/10 bg-surface px-3 py-2 text-sm text-ink"
                />
                <Button
                  size="sm"
                  className="h-auto shrink-0"
                  onClick={saveProfile}
                  disabled={
                    profileState === "saving" ||
                    !profileName.trim() ||
                    profileName.trim() === fullName
                  }
                >
                  {profileState === "saving" ? "Saving…" : "Save"}
                </Button>
              </div>
              {profileState === "saved" && (
                <p className="mt-1 text-xs font-medium text-emerald-600">
                  Saved to your profile.
                </p>
              )}
              {profileState === "error" && (
                <p className="mt-1 text-xs text-rose-600">
                  Couldn&apos;t save — please try again.
                </p>
              )}
            </div>
          ) : (
            <ReadOnlyField label="Full name" value={fullName} />
          )}
          <div>
            <Label htmlFor="displayName">Display name</Label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="focus-ring w-full rounded-lg border border-black/10 bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <ReadOnlyField label="Email" value={email} />
          <div>
            <Label htmlFor="timezone">Time zone</Label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="focus-ring w-full rounded-lg border border-black/10 bg-surface px-3 py-2 text-sm text-ink"
            >
              {timezones.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {userId && (
          <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
            <Label>Avatar colour</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar
                initials={initialsFor(profileName || fullName)}
                color={selectedColor}
                size={40}
              />
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Use colour ${c}`}
                    aria-pressed={selectedColor === c}
                    onClick={() => setSelectedColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-full ring-offset-2 ring-offset-surface transition",
                      selectedColor === c ? "ring-2 ring-brand-600" : "hover:opacity-80",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button
                size="sm"
                className="h-auto shrink-0"
                onClick={saveAvatarColor}
                disabled={colorState === "saving" || selectedColor === avatarColor}
              >
                {colorState === "saving" ? "Saving…" : "Save"}
              </Button>
            </div>
            {colorState === "saved" && (
              <p className="mt-1 text-xs font-medium text-emerald-600">
                Saved to your profile.
              </p>
            )}
            {colorState === "error" && (
              <p className="mt-1 text-xs text-rose-600">
                Couldn&apos;t save — please try again.
              </p>
            )}
          </div>
        )}
      </Widget>

      <Widget
        title="Notifications"
        icon={<Bell className="h-4 w-4 text-brand-600" />}
        action={<SavedTag show={showSaved} />}
      >
        <ul className="space-y-3">
          {notifFields.map(({ key, label }) => {
            const on = notifs[key];
            return (
              <li key={key} className="flex items-center justify-between">
                <span className="text-sm text-ink">{label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={label}
                  onClick={() => setNotifs((p) => ({ ...p, [key]: !p[key] }))}
                  className={cn(
                    "focus-ring relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                    on ? "bg-brand-600" : "bg-surface-sunken",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white shadow transition",
                      on ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </Widget>

      <Widget title="Security" icon={<KeyRound className="h-4 w-4 text-brand-600" />}>
        {userId ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="New password">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
              />
            </Field>
            <Field label="Confirm password">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
              />
            </Field>
            <div className="sm:col-span-2">
              {passwordTouched && !passwordValid && (
                <p className="mb-2 text-xs text-rose-600">
                  {newPassword.length < MIN_PASSWORD_LENGTH
                    ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
                    : "The passwords don't match."}
                </p>
              )}
              {passwordError && (
                <p className="mb-2 text-xs text-rose-600">{passwordError}</p>
              )}
              {passwordState === "saved" && (
                <p className="mb-2 text-xs font-medium text-emerald-600">
                  Password updated.
                </p>
              )}
              <Button
                size="sm"
                className="h-auto"
                onClick={savePassword}
                disabled={passwordState === "saving" || !passwordValid}
              >
                {passwordState === "saving" ? "Saving…" : "Update password"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Sign in to manage your password.</p>
        )}
      </Widget>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="rounded-lg border border-black/10 bg-surface-subtle px-3 py-2 text-sm text-ink-muted">
        {value}
      </p>
    </div>
  );
}

function SavedTag({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
      <Check className="h-3.5 w-3.5" /> Saved
    </span>
  );
}
