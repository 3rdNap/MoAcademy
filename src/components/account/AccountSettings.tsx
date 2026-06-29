"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, User as UserIcon } from "lucide-react";
import { Widget } from "@/components/ui/Widget";
import { Label } from "@/components/ui/form";
import { cn } from "@/lib/utils";

const PROFILE_KEY = "moacademy.account.profile";
const NOTIF_KEY = "moacademy.account.notifications";

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
}: {
  fullName: string;
  email: string;
}) {
  const [displayName, setDisplayName] = useState(fullName.split(" ")[0]);
  const [timezone, setTimezone] = useState(timezones[0]);
  const [notifs, setNotifs] = useState<Notifs>(defaultNotifs);
  const [hydrated, setHydrated] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const skipFirstSave = useRef(true);

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
          <ReadOnlyField label="Full name" value={fullName} />
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
