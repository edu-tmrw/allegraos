-- The authenticated client must not send created_by (column grants deny it),
-- while the generated Insert types only mark NOT NULL columns as optional
-- when PostgreSQL exposes a default. The existing BEFORE INSERT triggers stay
-- authoritative and overwrite this value with auth.uid(), preventing spoofing.
alter table public.contacts
  alter column created_by set default auth.uid();

alter table public.activities
  alter column created_by set default auth.uid();

alter table public.transactions
  alter column created_by set default auth.uid();
