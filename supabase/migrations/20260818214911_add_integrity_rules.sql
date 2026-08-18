alter table public.transactions
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(user_id) on delete restrict;

create unique index events_one_contact_idx
  on public.events(contact_id)
  where contact_id is not null;

create index transactions_live_date_idx
  on public.transactions(date desc)
  where deleted_at is null;

create index transactions_deleted_by_idx
  on public.transactions(deleted_by);

create function public.set_created_by()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  authenticated_user_id uuid := auth.uid();
begin
  if authenticated_user_id is null then
    raise exception 'Authentication is required to create this record.'
      using errcode = '42501';
  end if;

  new.created_by := authenticated_user_id;
  return new;
end;
$$;

revoke all on function public.set_created_by() from public, anon, authenticated;

create trigger contacts_set_created_by
before insert on public.contacts
for each row execute function public.set_created_by();

create trigger activities_set_created_by
before insert on public.activities
for each row execute function public.set_created_by();

create trigger transactions_set_created_by
before insert on public.transactions
for each row execute function public.set_created_by();

create function public.void_transaction(p_transaction_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  authenticated_user_id uuid := auth.uid();
  voided_transaction_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication is required to void a transaction.'
      using errcode = '42501';
  end if;

  update public.transactions
  set
    deleted_at = now(),
    deleted_by = authenticated_user_id
  where id = p_transaction_id
    and deleted_at is null
  returning id into voided_transaction_id;

  if voided_transaction_id is null then
    raise exception 'Live transaction % was not found.', p_transaction_id
      using errcode = 'P0002';
  end if;

  return voided_transaction_id;
end;
$$;

revoke all on function public.void_transaction(uuid) from public, anon, authenticated;
revoke delete on public.transactions from anon, authenticated;

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.event_types enable row level security;
alter table public.services enable row level security;
alter table public.service_variants enable row level security;
alter table public.transaction_categories enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.team_members enable row level security;
alter table public.contacts enable row level security;
alter table public.events enable row level security;
alter table public.event_services enable row level security;
alter table public.transactions enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_services enable row level security;
alter table public.activities enable row level security;
