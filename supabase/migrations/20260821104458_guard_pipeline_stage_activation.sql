-- Serialize pipeline-stage activation with live contact assignment. This
-- closes the check-then-update race that cannot be solved in the browser.

create function public.enforce_contact_active_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  stage_active boolean;
begin
  if new.archived then
    return new;
  end if;

  select stage.active
  into stage_active
  from public.pipeline_stages as stage
  where stage.id = new.stage_id
  for key share;

  if not found then
    raise exception 'Pipeline stage does not exist.' using errcode = '23503';
  end if;
  if not stage_active then
    raise exception 'A live contact cannot be assigned to an inactive stage.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger contacts_require_active_stage
before insert or update of stage_id, archived on public.contacts
for each row execute function public.enforce_contact_active_stage();

create function public.set_pipeline_stage_active(
  p_stage_id uuid,
  p_active boolean
)
returns public.pipeline_stages
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  stage_row public.pipeline_stages;
begin
  if not public.has_perm('manage_settings') then
    raise exception 'Settings permission is required to change stage activation.'
      using errcode = '42501';
  end if;
  if p_stage_id is null or p_active is null then
    raise exception 'Stage id and active state are required.' using errcode = '22023';
  end if;

  select stage.*
  into stage_row
  from public.pipeline_stages as stage
  where stage.id = p_stage_id
  for update;

  if not found then
    raise exception 'Pipeline stage was not found.' using errcode = '22023';
  end if;

  if not p_active and exists (
    select 1
    from public.contacts as contact
    where contact.stage_id = p_stage_id
      and not contact.archived
  ) then
    raise exception 'Move live contacts before inactivating this stage.'
      using errcode = '23514';
  end if;

  update public.pipeline_stages
  set active = p_active
  where id = p_stage_id
  returning * into stage_row;

  return stage_row;
end;
$$;

-- Activation is reachable only through the serialized RPC. Names and
-- positions retain their existing column-scoped update grants.
revoke update (active) on public.pipeline_stages from authenticated;

revoke all on function public.enforce_contact_active_stage()
  from public, anon, authenticated;
revoke all on function public.set_pipeline_stage_active(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_pipeline_stage_active(uuid, boolean)
  to authenticated;
