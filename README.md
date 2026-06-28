# MoAcademy

A modern **Learning Management System** built with Next.js, TypeScript, Tailwind
CSS, and Supabase. The interface blends the strongest patterns from
**Canvas** and **D2L Brightspace**:

- **Canvas-style global navigation rail** (Dashboard, Courses, Calendar, Inbox,
  Grades) and colorful **course cards** with quick links.
- **Brightspace-style homepage widgets** — an activity/Pulse feed, an
  "Upcoming" agenda, and announcements — plus a "waffle" **course switcher** in
  the top bar.
- A per-course left navigation (Home · Announcements · Modules · Assignments ·
  Grades · Discussions · People) under a colored course banner.

> The app runs **out-of-the-box on bundled seed data** — no backend or config
> required. Add Supabase credentials to switch to a live database.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000  (redirects to /dashboard)
```

## Tech stack

| Layer      | Choice                                            |
| ---------- | ------------------------------------------------- |
| Framework  | Next.js 15 (App Router, React Server Components)  |
| Language   | TypeScript                                        |
| Styling    | Tailwind CSS + a custom `brand` design token set  |
| Icons      | lucide-react                                      |
| Backend    | Supabase (Postgres + Auth) — optional             |

## Connecting Supabase (optional)

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env.local` and fill in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

3. Apply the schema in `supabase/migrations/0001_init.sql` (via the Supabase
   SQL editor or `supabase db push`).
4. Restart the dev server. The data layer (`src/lib/data/index.ts`)
   automatically prefers Supabase when env vars are present and falls back to
   seed data otherwise, so the UI never breaks.

## Project structure

```
src/
  app/                     App Router pages
    dashboard/             Blended Canvas/Brightspace home
    courses/               Course list
    courses/[courseId]/    Course shell + Home/Modules/Assignments/Grades/…
    calendar/  inbox/  grades/  account/
  components/
    layout/                GlobalNav, TopBar, CourseSwitcher, CourseNav, AppShell
    dashboard/             CourseCard, ActivityFeed, UpcomingList
    ui/                    Avatar, Badge, ProgressBar, Widget, PageHeader
  lib/
    data/                  Data-access layer (Supabase → seed fallback) + seed
    supabase/              Browser/server clients + env detection
    types.ts  nav.ts  utils.ts  itemMeta.tsx
supabase/
  migrations/0001_init.sql Schema mirroring the domain model
```

## Roadmap

This is the **core LMS shell + courses** foundation. Natural next steps:

- Authentication flows (sign-in/up) wired to Supabase Auth.
- Assignment submission + grading workflows and a real gradebook.
- Rich content pages and a module editor for instructors.
- Threaded discussions and real-time inbox messaging.
- Role-aware views (student vs. instructor vs. admin).
