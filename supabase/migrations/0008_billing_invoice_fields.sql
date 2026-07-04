-- Make registrations self-contained invoices, matching the app's Registration
-- shape: capture the invoice number, payer and payment method on the
-- registration, and snapshot each line's name/code/price on the item (so
-- historic invoices don't depend on the subjects catalog; subject_id becomes
-- optional).

alter table public.registrations
  add column if not exists invoice_no text not null default '',
  add column if not exists payer_name text not null default '',
  add column if not exists payer_email text not null default '',
  add column if not exists method text not null default 'card';

alter table public.registration_items
  alter column subject_id drop not null;

alter table public.registration_items
  add column if not exists name text not null default '',
  add column if not exists code text not null default '';
