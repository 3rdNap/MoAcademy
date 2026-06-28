-- MoAcademy billing / subject registration schema
-- Backs the dashboard in src/app/billing. Pricing logic (per-subject list price
-- + volume discount) lives in src/lib/billing/pricing.ts; these tables record
-- the catalog and what each student has registered + paid.

-- Registrable subjects with their individual per-term list price (in cents to
-- avoid floating-point money). There is no free option — every subject is paid.
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  category text not null default 'General',
  price_cents int not null check (price_cents > 0)
);

-- A student's registration for a term, with the computed totals captured at
-- checkout so historic invoices stay accurate even if prices change later.
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  term text not null,
  subject_count int not null default 0,
  subtotal_cents int not null default 0,
  discount_pct int not null default 0 check (discount_pct between 0 and 100),
  total_cents int not null default 0,
  status text not null default 'pending'
    check (status in ('pending','paid','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.registration_items (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  subject_id uuid not null references public.subjects (id),
  price_cents int not null
);

create index if not exists idx_registrations_user on public.registrations (user_id);
create index if not exists idx_registration_items_reg on public.registration_items (registration_id);

-- Row Level Security.
alter table public.subjects enable row level security;
alter table public.registrations enable row level security;
alter table public.registration_items enable row level security;

-- Catalog is readable by everyone; only a student sees/owns their registrations.
create policy "read subjects" on public.subjects for select using (true);

create policy "own registrations" on public.registrations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own registration items" on public.registration_items
  for all using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id and r.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id and r.user_id = auth.uid()
    )
  );
