create function public.has_perm(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_permission
      when 'manage_finance' then r.manage_finance
      when 'manage_events' then r.manage_events
      when 'manage_crm' then r.manage_crm
      when 'manage_team' then r.manage_team
      when 'manage_settings' then r.manage_settings
      else false
    end
    from public.profiles as p
    join public.roles as r on r.id = p.role_id
    where p.user_id = (select auth.uid())
      and p.active
  ), false);
$$;

revoke all on function public.has_perm(text) from public, anon, authenticated;
grant execute on function public.has_perm(text) to authenticated;

-- Rebuild Data API privileges explicitly. RLS remains the row boundary while
-- these grants constrain the operations and columns reachable by the client.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;

grant select, delete on public.roles to authenticated;
grant insert (name, manage_finance, manage_events, manage_crm, manage_team, manage_settings)
  on public.roles to authenticated;
grant update (name, manage_finance, manage_events, manage_crm, manage_team, manage_settings)
  on public.roles to authenticated;
grant select, delete on public.profiles to authenticated;
grant insert (user_id, name, role_id, active) on public.profiles to authenticated;
grant update (name, role_id, active) on public.profiles to authenticated;

grant select, delete on public.event_types to authenticated;
grant insert (name, active) on public.event_types to authenticated;
grant update (name, active) on public.event_types to authenticated;
grant select, delete on public.services to authenticated;
grant insert (name, default_price_cents, active) on public.services to authenticated;
grant update (name, default_price_cents, active) on public.services to authenticated;
grant select, delete on public.service_variants to authenticated;
grant insert (service_id, name, default_price_cents, active)
  on public.service_variants to authenticated;
grant update (service_id, name, default_price_cents, active)
  on public.service_variants to authenticated;
grant select, delete on public.transaction_categories to authenticated;
grant insert (name, kind, active) on public.transaction_categories to authenticated;
grant update (name, kind, active) on public.transaction_categories to authenticated;
grant select, delete on public.pipeline_stages to authenticated;
grant insert (name, position, active) on public.pipeline_stages to authenticated;
grant update (name, position, active) on public.pipeline_stages to authenticated;

grant select, delete on public.team_members to authenticated;
grant insert (name, phone, role_label, pay_notes, active) on public.team_members to authenticated;
grant update (name, phone, role_label, pay_notes, active) on public.team_members to authenticated;

grant select, delete on public.contacts to authenticated;
grant insert (name, phone, email, event_type_id, stage_id, archived, notes)
  on public.contacts to authenticated;
grant update (name, phone, email, event_type_id, stage_id, archived, notes)
  on public.contacts to authenticated;
grant select, delete on public.proposals to authenticated;
grant insert (contact_id, sent_date, status, discount_cents, notes)
  on public.proposals to authenticated;
grant update (contact_id, sent_date, status, discount_cents, notes)
  on public.proposals to authenticated;
grant select, delete on public.proposal_services to authenticated;
grant insert (proposal_id, service_id, variant_id, price_cents)
  on public.proposal_services to authenticated;
grant update (proposal_id, service_id, variant_id, price_cents)
  on public.proposal_services to authenticated;
grant select, delete on public.activities to authenticated;
grant insert (contact_id, content, due_date, done) on public.activities to authenticated;
grant update (contact_id, content, due_date, done) on public.activities to authenticated;

grant select, delete on public.events to authenticated;
grant insert (name, event_type_id, event_date, event_time, contact_id, discount_cents, canceled, notes)
  on public.events to authenticated;
grant update (name, event_type_id, event_date, event_time, contact_id, discount_cents, canceled, notes)
  on public.events to authenticated;
grant select, delete on public.event_services to authenticated;
grant insert (event_id, service_id, variant_id, price_cents)
  on public.event_services to authenticated;
grant update (event_id, service_id, variant_id, price_cents)
  on public.event_services to authenticated;

grant select on public.transactions to authenticated;
grant insert (kind, amount_cents, date, category_id, event_id, description)
  on public.transactions to authenticated;
grant update (kind, amount_cents, date, category_id, event_id, description)
  on public.transactions to authenticated;

create policy "authenticated can read event types"
on public.event_types for select to authenticated using (true);
create policy "settings can create event types"
on public.event_types for insert to authenticated
with check ((select public.has_perm('manage_settings')));
create policy "settings can update event types"
on public.event_types for update to authenticated
using ((select public.has_perm('manage_settings')))
with check ((select public.has_perm('manage_settings')));
create policy "settings can delete event types"
on public.event_types for delete to authenticated
using ((select public.has_perm('manage_settings')));

create policy "authenticated can read services"
on public.services for select to authenticated using (true);
create policy "settings can create services"
on public.services for insert to authenticated
with check ((select public.has_perm('manage_settings')));
create policy "settings can update services"
on public.services for update to authenticated
using ((select public.has_perm('manage_settings')))
with check ((select public.has_perm('manage_settings')));
create policy "settings can delete services"
on public.services for delete to authenticated
using ((select public.has_perm('manage_settings')));

create policy "authenticated can read service variants"
on public.service_variants for select to authenticated using (true);
create policy "settings can create service variants"
on public.service_variants for insert to authenticated
with check ((select public.has_perm('manage_settings')));
create policy "settings can update service variants"
on public.service_variants for update to authenticated
using ((select public.has_perm('manage_settings')))
with check ((select public.has_perm('manage_settings')));
create policy "settings can delete service variants"
on public.service_variants for delete to authenticated
using ((select public.has_perm('manage_settings')));

create policy "authenticated can read transaction categories"
on public.transaction_categories for select to authenticated using (true);
create policy "settings can create transaction categories"
on public.transaction_categories for insert to authenticated
with check ((select public.has_perm('manage_settings')));
create policy "settings can update transaction categories"
on public.transaction_categories for update to authenticated
using ((select public.has_perm('manage_settings')))
with check ((select public.has_perm('manage_settings')));
create policy "settings can delete transaction categories"
on public.transaction_categories for delete to authenticated
using ((select public.has_perm('manage_settings')));

create policy "authenticated can read pipeline stages"
on public.pipeline_stages for select to authenticated using (true);
create policy "settings can create pipeline stages"
on public.pipeline_stages for insert to authenticated
with check ((select public.has_perm('manage_settings')));
create policy "settings can update pipeline stages"
on public.pipeline_stages for update to authenticated
using ((select public.has_perm('manage_settings')))
with check ((select public.has_perm('manage_settings')));
create policy "settings can delete pipeline stages"
on public.pipeline_stages for delete to authenticated
using ((select public.has_perm('manage_settings')));

create policy "authenticated can read events"
on public.events for select to authenticated using (true);
create policy "event managers can create events"
on public.events for insert to authenticated
with check ((select public.has_perm('manage_events')));
create policy "event managers can update events"
on public.events for update to authenticated
using ((select public.has_perm('manage_events')))
with check ((select public.has_perm('manage_events')));
create policy "event managers can delete events"
on public.events for delete to authenticated
using ((select public.has_perm('manage_events')));

create policy "authenticated can read event services"
on public.event_services for select to authenticated using (true);
create policy "event managers can create event services"
on public.event_services for insert to authenticated
with check ((select public.has_perm('manage_events')));
create policy "event managers can update event services"
on public.event_services for update to authenticated
using ((select public.has_perm('manage_events')))
with check ((select public.has_perm('manage_events')));
create policy "event managers can delete event services"
on public.event_services for delete to authenticated
using ((select public.has_perm('manage_events')));

create policy "finance can manage transactions"
on public.transactions for all to authenticated
using (
  (select public.has_perm('manage_finance'))
  and deleted_at is null
)
with check (
  (select public.has_perm('manage_finance'))
  and deleted_at is null
);

create policy "crm can manage contacts"
on public.contacts for all to authenticated
using ((select public.has_perm('manage_crm')))
with check ((select public.has_perm('manage_crm')));
create policy "crm can manage proposals"
on public.proposals for all to authenticated
using ((select public.has_perm('manage_crm')))
with check ((select public.has_perm('manage_crm')));
create policy "crm can manage proposal services"
on public.proposal_services for all to authenticated
using ((select public.has_perm('manage_crm')))
with check ((select public.has_perm('manage_crm')));
create policy "crm can manage activities"
on public.activities for all to authenticated
using ((select public.has_perm('manage_crm')))
with check ((select public.has_perm('manage_crm')));

create policy "team managers can manage team"
on public.team_members for all to authenticated
using ((select public.has_perm('manage_team')))
with check ((select public.has_perm('manage_team')));

create policy "users can read their profile"
on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.has_perm('manage_settings'))
);
create policy "settings can create profiles"
on public.profiles for insert to authenticated
with check ((select public.has_perm('manage_settings')));
create policy "settings can update profiles"
on public.profiles for update to authenticated
using ((select public.has_perm('manage_settings')))
with check ((select public.has_perm('manage_settings')));
create policy "settings can delete profiles"
on public.profiles for delete to authenticated
using ((select public.has_perm('manage_settings')));

create policy "users can read their role"
on public.roles for select to authenticated
using (
  id = (
    select p.role_id
    from public.profiles as p
    where p.user_id = (select auth.uid())
  )
  or (select public.has_perm('manage_settings'))
);
create policy "settings can create roles"
on public.roles for insert to authenticated
with check ((select public.has_perm('manage_settings')));
create policy "settings can update roles"
on public.roles for update to authenticated
using ((select public.has_perm('manage_settings')))
with check ((select public.has_perm('manage_settings')));
create policy "settings can delete roles"
on public.roles for delete to authenticated
using ((select public.has_perm('manage_settings')));

create or replace function public.void_transaction(p_transaction_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  authenticated_user_id uuid := auth.uid();
  voided_transaction_id uuid;
begin
  if not public.has_perm('manage_finance') then
    raise exception 'Finance permission is required to void a transaction.'
      using errcode = '42501';
  end if;

  update public.transactions
  set deleted_at = now(), deleted_by = authenticated_user_id
  where id = p_transaction_id and deleted_at is null
  returning id into voided_transaction_id;

  if voided_transaction_id is null then
    raise exception 'Live transaction % was not found.', p_transaction_id
      using errcode = 'P0002';
  end if;

  return voided_transaction_id;
end;
$$;

revoke all on function public.void_transaction(uuid) from public, anon, authenticated;
grant execute on function public.void_transaction(uuid) to authenticated;

create function public.create_proposal_with_items(
  p_contact_id uuid,
  p_sent_date date,
  p_discount_cents integer,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  proposal_id uuid;
begin
  if not public.has_perm('manage_crm') then
    raise exception 'CRM permission is required to create a proposal.'
      using errcode = '42501';
  end if;
  if p_sent_date is null or p_discount_cents is null or p_discount_cents < 0
     or p_items is null
     or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Proposal data and at least one item are required.'
      using errcode = '22023';
  end if;
  if not exists (select 1 from public.contacts where id = p_contact_id) then
    raise exception 'Contact % was not found.', p_contact_id using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(service_id uuid, variant_id uuid, price_cents integer)
    left join public.services as service on service.id = item.service_id
    left join public.service_variants as variant
      on variant.id = item.variant_id and variant.service_id = item.service_id
    where service.id is null
      or item.price_cents is null
      or item.price_cents < 0
      or (item.variant_id is not null and variant.id is null)
  ) then
    raise exception 'Every proposal item must reference a valid service and variant.'
      using errcode = '22023';
  end if;

  insert into public.proposals (contact_id, sent_date, discount_cents, notes)
  values (p_contact_id, p_sent_date, p_discount_cents, p_notes)
  returning id into proposal_id;

  insert into public.proposal_services (proposal_id, service_id, variant_id, price_cents)
  select proposal_id, item.service_id, item.variant_id, item.price_cents
  from jsonb_to_recordset(p_items) as item(service_id uuid, variant_id uuid, price_cents integer);

  return proposal_id;
end;
$$;

create function public.convert_lead(
  p_contact_id uuid,
  p_proposal_id uuid,
  p_event_name text,
  p_event_date date,
  p_event_time time
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  contact_event_type_id uuid;
  proposal_contact_id uuid;
  proposal_state public.proposal_status;
  proposal_discount_cents integer;
  event_id uuid;
  copied_item_count integer;
begin
  if not public.has_perm('manage_crm') then
    raise exception 'CRM permission is required to convert a lead.'
      using errcode = '42501';
  end if;
  if p_event_date is null or length(trim(coalesce(p_event_name, ''))) = 0 then
    raise exception 'Event name and date are required.' using errcode = '22023';
  end if;

  select c.event_type_id into contact_event_type_id
  from public.contacts as c where c.id = p_contact_id for update;
  if not found or contact_event_type_id is null then
    raise exception 'The contact must exist and have an event type.' using errcode = '22023';
  end if;

  select p.contact_id, p.status, p.discount_cents
  into proposal_contact_id, proposal_state, proposal_discount_cents
  from public.proposals as p where p.id = p_proposal_id for update;
  if not found or proposal_contact_id <> p_contact_id then
    raise exception 'The proposal must belong to the contact.' using errcode = '22023';
  end if;
  if proposal_state <> 'accepted' then
    raise exception 'The proposal must be accepted.' using errcode = '22023';
  end if;
  if exists (select 1 from public.events where contact_id = p_contact_id) then
    raise exception 'The contact is already linked to an event.' using errcode = '23505';
  end if;

  insert into public.events (
    name, event_type_id, event_date, event_time, contact_id, discount_cents
  ) values (
    trim(p_event_name), contact_event_type_id, p_event_date, p_event_time,
    p_contact_id, proposal_discount_cents
  ) returning id into event_id;

  insert into public.event_services (event_id, service_id, variant_id, price_cents)
  select event_id, ps.service_id, ps.variant_id, ps.price_cents
  from public.proposal_services as ps where ps.proposal_id = p_proposal_id;

  get diagnostics copied_item_count = row_count;
  if copied_item_count = 0 then
    raise exception 'The accepted proposal must contain at least one item.' using errcode = '22023';
  end if;

  return event_id;
end;
$$;

create function public.assert_pipeline_stage_position()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_position integer;
begin
  select position into current_position from public.pipeline_stages where id = new.id;
  if current_position is not null and current_position <= 0 then
    raise exception 'Pipeline stage positions must be positive.' using errcode = '23514';
  end if;
  return null;
end;
$$;

alter table public.pipeline_stages drop constraint pipeline_stages_position_check;
create constraint trigger pipeline_stages_position_positive
after insert or update of position on public.pipeline_stages
deferrable initially deferred
for each row execute function public.assert_pipeline_stage_position();

create function public.reorder_stages(p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  active_count integer;
begin
  if not public.has_perm('manage_settings') then
    raise exception 'Settings permission is required to reorder stages.'
      using errcode = '42501';
  end if;
  if p_ordered_ids is null or array_position(p_ordered_ids, null) is not null then
    raise exception 'A complete ordered stage list is required.' using errcode = '22023';
  end if;

  perform 1 from public.pipeline_stages where active order by position for update;
  select count(*) into active_count from public.pipeline_stages where active;
  if cardinality(p_ordered_ids) <> active_count
     or (select count(distinct id) from unnest(p_ordered_ids) as ids(id)) <> active_count
     or exists (
       select id from unnest(p_ordered_ids) as ids(id)
       except select id from public.pipeline_stages where active
     )
     or exists (
       select id from public.pipeline_stages where active
       except select id from unnest(p_ordered_ids) as ids(id)
     ) then
    raise exception 'The ordered list must contain every active stage exactly once.'
      using errcode = '22023';
  end if;

  update public.pipeline_stages as stage
  set position = -ordered.ordinality::integer
  from unnest(p_ordered_ids) with ordinality as ordered(id, ordinality)
  where stage.id = ordered.id;

  update public.pipeline_stages as stage
  set position = ordered.ordinality::integer
  from unnest(p_ordered_ids) with ordinality as ordered(id, ordinality)
  where stage.id = ordered.id;
end;
$$;

revoke all on function public.create_proposal_with_items(uuid,date,integer,text,jsonb)
  from public, anon, authenticated;
revoke all on function public.convert_lead(uuid,uuid,text,date,time)
  from public, anon, authenticated;
revoke all on function public.reorder_stages(uuid[])
  from public, anon, authenticated;
revoke all on function public.assert_pipeline_stage_position()
  from public, anon, authenticated;

grant execute on function public.create_proposal_with_items(uuid,date,integer,text,jsonb)
  to authenticated;
grant execute on function public.convert_lead(uuid,uuid,text,date,time)
  to authenticated;
grant execute on function public.reorder_stages(uuid[])
  to authenticated;
