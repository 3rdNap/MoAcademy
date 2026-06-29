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

3. Apply the schema in `supabase/migrations/` (via the Supabase SQL editor or
   `supabase db push`) — `0001_init.sql` for courses, `0002_roadmap.sql` for
   the University Roadmap.
4. Restart the dev server. The data layer (`src/lib/data/index.ts`)
   automatically prefers Supabase when env vars are present and falls back to
   seed data otherwise, so the UI never breaks.

## University Roadmap

A student-owned planning space (global nav → **Roadmap**) for life beyond the
current courses. All content is **added and edited by the student** in-app —
because requirements, dates and offers change over time — and persists in the
browser (`localStorage`) with **no backend required**. Three tabs:

- **My Goals** — target institutions/programmes with the requirements to get in.
  Captures not just the published minimums but the **competitive marks that make
  admission safe** (min vs. "safe" APS and per-subject bars), with a tick-off
  checklist and gap tracking.
- **Applications** — each institution's opening/closing dates, a link to the
  online application portal, the prospectus (link **or uploaded file**), and an
  application status, with deadline countdowns.
- **Scholarships & Bursaries** — opportunities with what they cover, their
  requirements, closing dates and apply links.

The same shapes map to `supabase/migrations/0002_roadmap.sql` for when you want
roadmap data stored server-side per student.

## Roles & access (student vs. instructor)

A **"Viewing as"** switcher in the top bar previews the app as a **Student**,
**Instructor**, or **Admin** (Canvas-style Student View). The active role is held
in a client `RoleProvider` (persisted in the browser) and gates teaching UI:

- **Course pages** show an **Instructor tools** bar (add content, gradebook,
  people, student view, publish) for teaching roles.
- **Modules** and **Assignments** show **+ Add** actions for instructors.
- The **dashboard** shows a teaching-preview banner; the **account** page shows
  the role currently being previewed.

This is the UI foundation for role-aware access; it maps directly onto the
`role` on the authenticated user once Supabase Auth is connected (`profiles.role`
already exists in `0001_init.sql`). Gates live in
`src/components/role/` (`RoleProvider`, `RoleSwitcher`, `InstructorOnly`, …).

### Instructor authoring

While previewing a teaching role, instructors can **author course content**:

- **Assignments** — create / edit / delete assignments (title, type, due date,
  points, description).
- **Modules** — create modules (publish/unpublish) and add or remove items
  within them.
- **Announcements** — instructors can post / edit / delete course announcements,
  merged with the existing ones and tagged "Posted by you".
- **Gradebook** — the course **Grades** page is role-aware: students see their
  own grade table, while instructors get an editable class gradebook (students ×
  assignments) with auto-saving score cells, per-student totals, and per-
  assignment class averages.

Authored content is layered on top of the seed data and persists per course in
the browser (`moacademy.authoring.*`, `moacademy.gradebook.*`); students see it
read-only alongside the existing content. The boards live in
`src/components/courses/`. Wiring this to the Supabase tables in `0001_init.sql`
is the path to shared, server-side authoring.

## Billing & Registration

A paid registration dashboard (global nav → **Billing**). **There is no free
plan** — registration is priced **per subject**, and a **volume discount** means
the total is always less than the subjects added up individually, so the
effective price per subject falls as you register more.

- A subject catalog (grouped by category) where each subject shows its own
  per-term price; pick the subjects you want to register.
- A live summary: subtotal, the bulk-discount tier reached, the amount saved,
  the total due, and the **effective price per subject** (highlighted).
- A "How bulk pricing works" tier table that highlights your current tier and
  nudges you toward the next discount.

Pricing logic is in `src/lib/billing/pricing.ts` (discount tiers
0/5/10/15/20/25/30%, capped at 7+ subjects). The discount guarantees the
per-subject rate strictly decreases and the total is less than the sum for two
or more subjects. The schema is in `supabase/migrations/0003_billing.sql`
(subjects, registrations, registration_items) with per-student RLS.

The **Register** tab leads to a **checkout** (payer details + payment method →
confirmation with an invoice number), and paid registrations are kept under the
**My Registrations** tab as printable invoices — each capturing the subjects,
the bulk discount applied, and the total at the time of payment. All of this
persists in the browser; the same shapes map to the billing migration.

## Discussions

The course **Discussions** tab is interactive: open any thread to read and
**post replies**, delete your own, and **start new topics**. Seed discussion
items from the modules appear as starter threads; topics and replies persist per
course in the browser (`moacademy.discussions.*`). Lives in
`src/components/courses/DiscussionsBoard.tsx`.

## Assignment submissions

On the **Assignments** tab, students can **submit work** (a text response and/or
an attached file) for any not-yet-graded assignment, and resubmit until it's
graded. The status flips to **Submitted** with a timestamp. Submissions persist
per course in the browser (`moacademy.submissions.*`).

## Inbox

The **Inbox** is interactive: open a conversation to read the thread and **reply**
(chat-style bubbles), and **compose** a new message with recipient suggestions
(course instructors + classmates). Opening a conversation clears its unread dot;
sent conversations and replies persist in the browser (`moacademy.inbox.*`).
Lives in `src/components/inbox/InboxBoard.tsx`.

## Account settings

The **Account** page persists your preferences: an editable **display name** and
**time zone**, plus **notification toggles** (announcements, grades, due-date
reminders, discussion replies). Changes save to the browser as you make them
(`moacademy.account.*`) with a brief "Saved" confirmation. Lives in
`src/components/account/AccountSettings.tsx`.

## Calendar

The **Calendar** agenda merges course deadlines (seed) with your own **personal
events** — add, edit, and delete events (title, date/time, type) that appear
inline alongside coursework. Personal events persist in the browser
(`moacademy.calendar.events`). Lives in
`src/components/calendar/CalendarBoard.tsx`.

## Light / dark theme

A **light/dark theme toggle** (sun/moon in the top bar) switches the whole app.
Semantic color tokens (`ink`, `surface`) are CSS variables with a `.dark`
override (`globals.css`), so components adapt automatically. The choice persists
in the browser (`moacademy.theme`) and an inline script in the root layout
applies it before first paint to avoid a flash; unset follows the OS preference.
Toggle in `src/components/layout/ThemeToggle.tsx`.

## Pinned courses

Star any course (top-left of its card) to **pin** it; pinned courses appear in a
quick-access **Pinned** strip at the top of the dashboard. Pins persist in the
browser (`moacademy.pinnedCourses`). See `src/components/dashboard/CourseStar.tsx`
and `PinnedCourses.tsx`.

## Global search

The top-bar search box is a live, keyboard-driven search across **courses,
assignments, content items, and pages**. Results appear as you type (matching
title or code/subtitle), **Enter** opens the top hit, and **Esc** closes. Lives
in `src/components/layout/GlobalSearch.tsx`.

## Notifications

The top-bar **bell** opens a notifications panel that aggregates what needs
attention: unread inbox messages, roadmap application/scholarship deadlines
closing within 14 days, assignments due within 7 days, and recently posted
grades — each linking to the right page. The badge count is computed from the
same browser data the rest of the app uses. Lives in
`src/components/notifications/NotificationBell.tsx`.

## Project structure

```
src/
  app/                     App Router pages
    dashboard/             Blended Canvas/Brightspace home
    courses/               Course list
    courses/[courseId]/    Course shell + Home/Modules/Assignments/Grades/…
    roadmap/               University Roadmap: Goals/Applications/Scholarships
    calendar/  inbox/  grades/  account/
  components/
    layout/                GlobalNav, TopBar, CourseSwitcher, CourseNav, AppShell
    dashboard/             CourseCard, ActivityFeed, UpcomingList
    roadmap/               GoalsBoard, ApplicationsBoard, ScholarshipsBoard, tabs
    ui/                    Avatar, Badge, Button, Modal, form, ProgressBar, Widget
  lib/
    data/                  Data-access layer (Supabase → seed fallback) + seed
    roadmap/               Roadmap types, seed, localStorage store, deadlines
    supabase/              Browser/server clients + env detection
    types.ts  nav.ts  utils.ts  itemMeta.tsx
supabase/
  migrations/0001_init.sql     Course/LMS schema
  migrations/0002_roadmap.sql  University Roadmap schema
```

## Roadmap

This is the **core LMS shell + courses** foundation. Natural next steps:

- Authentication flows (sign-in/up) wired to Supabase Auth.
- Assignment submission + grading workflows and a real gradebook.
- Rich content pages and a module editor for instructors.
- Threaded discussions and real-time inbox messaging.
- Role-aware views (student vs. instructor vs. admin).
