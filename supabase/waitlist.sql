-- Waitlist table for the Card Rules Calculator.
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- What it sets up:
--   * one table of sign-ups
--   * the public page may ADD a row and nothing else: it cannot read, change
--     or delete sign-ups (row level security with an insert-only policy)
--   * the same email cannot be added twice
--   * length and format checks, so the public endpoint cannot be used to
--     store arbitrary data

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null
    check (char_length(email) between 5 and 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  would_pay_per_year smallint
    check (would_pay_per_year in (0, 40, 72, 100)),
  source text not null default 'calculator'
    check (char_length(source) <= 40),
  -- The exact wording the person agreed to, kept as proof of opt-in for when
  -- the list is imported into an email provider.
  consent_text text not null
    check (char_length(consent_text) between 10 and 300),
  created_at timestamptz not null default now()
);

create unique index waitlist_email_unique on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- Start from nothing, then allow inserts only.
revoke all on table public.waitlist from anon, authenticated;
grant insert on table public.waitlist to anon;

create policy "Public can join the waitlist"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- There is deliberately no select, update or delete policy. You read and
-- export the list from the dashboard (Table Editor -> waitlist -> Export to
-- CSV), which uses your own login, not the public key.
