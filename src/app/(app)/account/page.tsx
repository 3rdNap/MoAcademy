import { Globe, Mail, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { getCurrentUser } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ActiveRoleCard } from "@/components/role/ActiveRoleCard";
import { AccountSettings } from "@/components/account/AccountSettings";
import { SignOutButton } from "@/components/auth/SignOutButton";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getCurrentUser();

  // Determine real auth state when Supabase is configured.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  return (
    <>
      <PageHeader title="Account" subtitle="Manage your profile and preferences." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <Avatar initials={user.initials} color={user.avatarColor} size={80} />
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

          {hasSupabaseEnv() && (
            <div className="mt-4">
              {authUser ? (
                <SignOutButton />
              ) : (
                <Link
                  href="/login"
                  className="focus-ring flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Sign in
                </Link>
              )}
            </div>
          )}
        </section>

        <div className="lg:col-span-2">
          <AccountSettings
            fullName={user.name}
            email={user.email}
            avatarColor={user.avatarColor}
          />
        </div>
      </div>
    </>
  );
}
