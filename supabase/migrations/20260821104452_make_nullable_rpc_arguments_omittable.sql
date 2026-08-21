create or replace function public.create_proposal_with_items(
  p_contact_id uuid,
  p_sent_date date,
  p_discount_cents integer,
  p_notes text default null,
  p_items jsonb default null
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

create or replace function public.convert_lead(
  p_contact_id uuid,
  p_proposal_id uuid,
  p_event_name text,
  p_event_date date,
  p_event_time time default null
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

  select contact.event_type_id into contact_event_type_id
  from public.contacts as contact where contact.id = p_contact_id for update;
  if not found or contact_event_type_id is null then
    raise exception 'The contact must exist and have an event type.' using errcode = '22023';
  end if;

  select proposal.contact_id, proposal.status, proposal.discount_cents
  into proposal_contact_id, proposal_state, proposal_discount_cents
  from public.proposals as proposal where proposal.id = p_proposal_id for update;
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
  select event_id, proposal_service.service_id, proposal_service.variant_id, proposal_service.price_cents
  from public.proposal_services as proposal_service where proposal_service.proposal_id = p_proposal_id;

  get diagnostics copied_item_count = row_count;
  if copied_item_count = 0 then
    raise exception 'The accepted proposal must contain at least one item.' using errcode = '22023';
  end if;

  return event_id;
end;
$$;
