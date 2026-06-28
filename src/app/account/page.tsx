import { Bell, Globe, Mail, Shield, User as UserIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Widget } from "@/components/ui/Widget";
import { getCurrentUser } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { ActiveRoleCard } from "@/components/role/ActiveRoleCard";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getCurrentUser();

  return (
    <>
      <PageHeader title="Account" subtitle="Manage your profile and preferences." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <Avatar
              initials={user.initials}
              color={user.avatarColor}
              size={80}
            />
            <h2 className="mt-3 text-lg font-semibold text-ink">{user.name}</h2>
            <p className="text-sm text-ink-muted">{user.email}</p>
            <Badge tone="brand" className="mt-2 capitalize">
              {user.role}
            </Badge>
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex items-center gap-2 text-ink-muted">
              <Mail className="h-4 w-4" /> {user.email}
            </div>
            <div className="flex items-center gap-2 text-ink-muted">
              <Globe className="h-4 w-4" /> English (US)
            </div>
            <div className="flex items-center gap-2 text-ink-muted">
              <Shield className="h-4 w-4" />
              Backend:{" "}
              {hasSupabaseEnv() ? "Supabase (live)" : "Seed data (demo)"}
            </div>
          </dl>
          <div className="mt-4">
            <ActiveRoleCard />
          </div>
        </section>

        <div className="space-y-6 lg:col-span-2">
          <Widget
            title="Profile"
            icon={<UserIcon className="h-4 w-4 text-brand-600" />}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" value={user.name} />
              <Field label="Display name" value={user.name.split(" ")[0]} />
              <Field label="Email" value={user.email} />
              <Field label="Time zone" value="GMT+2 · Johannesburg" />
            </div>
          </Widget>

          <Widget
            title="Notifications"
            icon={<Bell className="h-4 w-4 text-brand-600" />}
          >
            <ul className="space-y-3">
              {[
                ["Announcements", true],
                ["Grade postings", true],
                ["Due-date reminders", true],
                ["Discussion replies", false],
              ].map(([label, on]) => (
                <li
                  key={label as string}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-ink">{label}</span>
                  <span
                    className={`relative inline-flex h-5 w-9 items-center rounded-full ${
                      on ? "bg-brand-600" : "bg-surface-sunken"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        on ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </Widget>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="mt-1 rounded-lg border border-black/10 bg-surface-subtle px-3 py-2 text-sm text-ink">
        {value}
      </p>
    </div>
  );
}
