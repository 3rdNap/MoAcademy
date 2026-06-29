# Wiring real authentication (Supabase Auth)

MoAcademy runs on seed data with no backend. To turn on real sign-in, connect a
Supabase project. The data layer already prefers Supabase when env vars are set
(`src/lib/data/index.ts`, `getCurrentUser`), and a session-refresh middleware is
already in place (`middleware.ts`) — it's a no-op until you add credentials.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. After it provisions, open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

## 2. Add environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Restart `npm run dev` after changing env files.

## 3. Apply the database schema

In the Supabase dashboard **SQL Editor**, run the migrations in order:

- `supabase/migrations/0001_init.sql` — core tables + `profiles` + RLS
- `supabase/migrations/0002_roadmap.sql`
- `supabase/migrations/0003_billing.sql`
- `supabase/migrations/0004_auth.sql` — auto-creates a `profiles` row on signup

(Or use the Supabase CLI: `supabase link` then `supabase db push`.)

## 4. Enable a sign-in method

In **Authentication → Providers**, enable **Email** (and turn off "Confirm email"
during local testing for speed, or keep it on for production). You can also
enable OAuth providers (Google, GitHub) here later.

## 5. Add the auth UI (sign-in / sign-up / sign-out)

The browser/server Supabase clients already exist
(`src/lib/supabase/client.ts`, `server.ts`). Add these files:

### `src/app/login/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase isn't configured.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setError(error.message);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={signIn} className="mx-auto mt-16 max-w-sm space-y-3">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <input className="w-full rounded border p-2" type="email" placeholder="Email"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="w-full rounded border p-2" type="password" placeholder="Password"
        value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button className="w-full rounded bg-brand-600 p-2 text-white">Sign in</button>
    </form>
  );
}
```

Create `src/app/signup/page.tsx` the same way, calling
`supabase.auth.signUp({ email, password, options: { data: { full_name, role } } })`.

### Sign out (anywhere, e.g. the account page)

```tsx
const supabase = createSupabaseBrowserClient();
await supabase?.auth.signOut();
router.push("/login");
```

## 6. (Optional) Protect routes

To require login when Supabase is configured, extend `updateSession` in
`src/lib/supabase/middleware.ts` to redirect unauthenticated users:

```ts
const { data: { user } } = await supabase.auth.getUser();
const path = request.nextUrl.pathname;
const isAuthRoute = path.startsWith("/login") || path.startsWith("/signup");
if (!user && !isAuthRoute) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}
```

Leave this out to keep the seed-data demo browsable without an account.

## How it ties together

- `getCurrentUser()` already returns the authenticated user's id/email/role
  (from `profiles.role`) when Supabase is configured, falling back to the seed
  student otherwise.
- The role-aware UI (`RoleProvider`, `InstructorOnly`) keys off that role, so
  once `profiles.role` is set per user, the instructor tools follow real roles
  instead of the preview switcher.
- User-owned browser data (roadmap, billing, authoring, gradebook) can later be
  migrated to the Supabase tables already defined in `supabase/migrations/`.
