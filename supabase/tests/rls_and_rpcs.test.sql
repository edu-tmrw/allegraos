begin;

set local search_path = public, extensions;

select plan(95);

-- The authorization surface is part of the public database contract.
select has_function(
  'public', 'has_perm', array['text'],
  'creates the permission helper'
);
select has_function(
  'public', 'create_proposal_with_items',
  array['uuid', 'date', 'integer', 'text', 'jsonb'],
  'creates the atomic proposal RPC'
);
select has_function(
  'public', 'convert_lead',
  array['uuid', 'uuid', 'text', 'date', 'time without time zone'],
  'creates the atomic lead conversion RPC'
);
select has_function(
  'public', 'reorder_stages', array['uuid[]'],
  'creates the atomic stage reorder RPC'
);
select has_function(
  'public', 'set_pipeline_stage_active', array['uuid', 'boolean'],
  'creates the atomic stage activation RPC'
);
select has_function(
  'public', 'void_transaction', array['uuid'],
  'keeps the audited transaction void RPC'
);

select ok(
  (
    select procedure_definition.prosecdef
      and procedure_definition.provolatile = 's'
      and procedure_definition.proconfig = array['search_path=public']::text[]
    from pg_proc as procedure_definition
    where procedure_definition.oid = to_regprocedure('public.has_perm(text)')
  ),
  'has_perm is stable security definer with the required fixed search path'
);
select ok(
  (
    select procedure_definition.prosecdef
      and procedure_definition.proconfig = array['search_path=public, auth']::text[]
    from pg_proc as procedure_definition
    where procedure_definition.oid = to_regprocedure(
      'public.create_proposal_with_items(uuid,date,integer,text,jsonb)'
    )
  ),
  'create_proposal_with_items is security definer with a fixed search path'
);
select ok(
  (
    select procedure_definition.prosecdef
      and procedure_definition.proconfig = array['search_path=public, auth']::text[]
    from pg_proc as procedure_definition
    where procedure_definition.oid = to_regprocedure(
      'public.convert_lead(uuid,uuid,text,date,time without time zone)'
    )
  ),
  'convert_lead is security definer with a fixed search path'
);
select ok(
  (
    select procedure_definition.prosecdef
      and procedure_definition.proconfig = array['search_path=public, auth']::text[]
    from pg_proc as procedure_definition
    where procedure_definition.oid = to_regprocedure('public.reorder_stages(uuid[])')
  ),
  'reorder_stages is security definer with a fixed search path'
);
select ok(
  (
    select procedure_definition.prosecdef
      and procedure_definition.proconfig = array['search_path=public, auth']::text[]
    from pg_proc as procedure_definition
    where procedure_definition.oid = to_regprocedure('public.set_pipeline_stage_active(uuid,boolean)')
  ),
  'set_pipeline_stage_active is security definer with a fixed search path'
);
select ok(
  (
    select procedure_definition.prosecdef
      and procedure_definition.proconfig = array['search_path=public, auth']::text[]
    from pg_proc as procedure_definition
    where procedure_definition.oid = to_regprocedure('public.void_transaction(uuid)')
  ),
  'void_transaction is security definer with a fixed search path'
);

select ok(
  has_function_privilege('authenticated', 'public.has_perm(text)', 'execute'),
  'authenticated can evaluate its own permissions'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_proposal_with_items(uuid,date,integer,text,jsonb)',
    'execute'
  ),
  'authenticated can call the guarded proposal RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.convert_lead(uuid,uuid,text,date,time without time zone)',
    'execute'
  ),
  'authenticated can call the guarded conversion RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.reorder_stages(uuid[])', 'execute'),
  'authenticated can call the guarded reorder RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.set_pipeline_stage_active(uuid,boolean)', 'execute'),
  'authenticated can call the guarded stage activation RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.void_transaction(uuid)', 'execute'),
  'authenticated can call the guarded void RPC'
);

select ok(
  not coalesce(
    has_function_privilege(
      'public',
      to_regprocedure('public.create_proposal_with_items(uuid,date,integer,text,jsonb)'),
      'execute'
    ),
    false
  ),
  'PUBLIC cannot execute create_proposal_with_items'
);
select ok(
  not coalesce(
    has_function_privilege(
      'public',
      to_regprocedure('public.convert_lead(uuid,uuid,text,date,time without time zone)'),
      'execute'
    ),
    false
  ),
  'PUBLIC cannot execute convert_lead'
);
select ok(
  not coalesce(
    has_function_privilege('public', to_regprocedure('public.reorder_stages(uuid[])'), 'execute'),
    false
  ),
  'PUBLIC cannot execute reorder_stages'
);
select ok(
  not coalesce(
    has_function_privilege('public', to_regprocedure('public.set_pipeline_stage_active(uuid,boolean)'), 'execute'),
    false
  ),
  'PUBLIC cannot execute set_pipeline_stage_active'
);
select ok(
  not coalesce(
    has_function_privilege('public', to_regprocedure('public.void_transaction(uuid)'), 'execute'),
    false
  ),
  'PUBLIC cannot execute void_transaction'
);
select ok(
  not coalesce(
    has_function_privilege(
      'anon',
      to_regprocedure('public.create_proposal_with_items(uuid,date,integer,text,jsonb)'),
      'execute'
    ),
    false
  ),
  'anon cannot execute create_proposal_with_items'
);
select ok(
  not coalesce(
    has_function_privilege(
      'anon',
      to_regprocedure('public.convert_lead(uuid,uuid,text,date,time without time zone)'),
      'execute'
    ),
    false
  ),
  'anon cannot execute convert_lead'
);
select ok(
  not coalesce(
    has_function_privilege('anon', to_regprocedure('public.reorder_stages(uuid[])'), 'execute'),
    false
  ),
  'anon cannot execute reorder_stages'
);
select ok(
  not coalesce(
    has_function_privilege('anon', to_regprocedure('public.set_pipeline_stage_active(uuid,boolean)'), 'execute'),
    false
  ),
  'anon cannot execute set_pipeline_stage_active'
);
select ok(
  not coalesce(
    has_function_privilege('anon', to_regprocedure('public.void_transaction(uuid)'), 'execute'),
    false
  ),
  'anon cannot execute void_transaction'
);

select is(
  (
    select count(*)::integer
    from pg_class as table_definition
    join pg_namespace as schema_definition
      on schema_definition.oid = table_definition.relnamespace
    where schema_definition.nspname = 'public'
      and table_definition.relkind = 'r'
      and table_definition.relrowsecurity
  ),
  15,
  'RLS remains enabled on all 15 public tables'
);
select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'finance can manage transactions'
  ),
  'transactions have the finance permission policy'
);
select ok(
  not has_table_privilege('authenticated', 'public.transactions', 'delete'),
  'authenticated never receives physical transaction deletion'
);
select ok(
  has_column_privilege('authenticated', 'public.transactions', 'description', 'update')
    and not has_column_privilege('authenticated', 'public.transactions', 'created_by', 'update')
    and not has_column_privilege('authenticated', 'public.transactions', 'deleted_at', 'update')
    and not has_column_privilege('authenticated', 'public.transactions', 'deleted_by', 'update'),
  'transaction updates expose business fields but protect audit fields'
);
select ok(
  has_column_privilege('authenticated', 'public.contacts', 'notes', 'update')
    and not has_column_privilege('authenticated', 'public.contacts', 'created_by', 'update'),
  'contact updates protect created_by'
);
select ok(
  has_column_privilege('authenticated', 'public.activities', 'done', 'update')
    and not has_column_privilege('authenticated', 'public.activities', 'created_by', 'update'),
  'activity updates protect created_by'
);
select ok(
  not has_column_privilege('authenticated', 'public.pipeline_stages', 'active', 'update'),
  'stage activation cannot bypass the serialized RPC through a direct update'
);
select ok(
  not has_column_privilege('authenticated', 'public.event_services', 'created_at', 'insert')
    and not has_column_privilege('authenticated', 'public.event_services', 'created_at', 'update'),
  'the service close timestamp is database-owned and immutable'
);

-- Real auth users and profiles drive auth.uid(), RLS, and every guarded RPC.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'admin-rls@example.test', '', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'commercial-rls@example.test', '', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'inactive-rls@example.test', '', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-4444-444444444444',
    'authenticated', 'authenticated', 'no-perm-rls@example.test', '', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-5555-5555-555555555555',
    'authenticated', 'authenticated', 'no-profile-rls@example.test', '', now(), now()
  );

insert into public.roles (
  id,
  name,
  manage_finance,
  manage_events,
  manage_crm,
  manage_team,
  manage_settings
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'No permissions',
  false, false, false, false, false
);

insert into public.profiles (user_id, name, role_id, active)
select fixture.user_id, fixture.name, role_definition.id, fixture.active
from (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'Admin RLS'::text, 'Admin'::text, true),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'Commercial RLS'::text, 'Comercial'::text, true),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'Inactive RLS'::text, 'Admin'::text, false),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'No Perm RLS'::text, 'No permissions'::text, true)
) as fixture(user_id, name, role_name, active)
join public.roles as role_definition on role_definition.name = fixture.role_name;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

insert into public.contacts (
  id, name, event_type_id, stage_id, notes, created_by
)
select
  fixture.id,
  fixture.name,
  case when fixture.has_event_type then event_type_definition.id else null end,
  stage_definition.id,
  fixture.notes,
  '11111111-1111-1111-1111-111111111111'
from (
  values
    ('61000000-0000-0000-0000-000000000001'::uuid, 'Primary lead'::text, true, 'primary'::text),
    ('61000000-0000-0000-0000-000000000002'::uuid, 'Other lead'::text, true, 'other'::text),
    ('61000000-0000-0000-0000-000000000003'::uuid, 'Converted lead'::text, true, 'converted'::text),
    ('61000000-0000-0000-0000-000000000004'::uuid, 'Missing event type'::text, false, 'incomplete'::text)
) as fixture(id, name, has_event_type, notes)
cross join lateral (
  select id from public.event_types where name = 'Casamento'
) as event_type_definition
cross join lateral (
  select id from public.pipeline_stages where position = 1
) as stage_definition;

insert into public.events (
  id, name, event_type_id, event_date, contact_id, discount_cents
)
select
  '62000000-0000-0000-0000-000000000001',
  'Visible contracted event',
  event_type_definition.id,
  date '2026-12-20',
  null,
  500
from public.event_types as event_type_definition
where event_type_definition.name = 'Casamento';

insert into public.event_services (
  id, event_id, service_id, price_cents
)
select
  '63000000-0000-0000-0000-000000000001',
  '62000000-0000-0000-0000-000000000001',
  service_definition.id,
  250000
from public.services as service_definition
where service_definition.name = 'Assessoria Premium';

insert into public.events (
  id, name, event_type_id, event_date, contact_id
)
select
  '62000000-0000-0000-0000-000000000002',
  'Previously converted',
  event_type_definition.id,
  date '2026-11-01',
  '61000000-0000-0000-0000-000000000003'
from public.event_types as event_type_definition
where event_type_definition.name = 'Casamento';

insert into public.team_members (id, name, role_label)
values ('64000000-0000-0000-0000-000000000001', 'Restricted teammate', 'Fotografia');

insert into public.activities (id, contact_id, content, created_by)
values (
  '65000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000001',
  'Audited CRM activity',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.transactions (
  id, kind, amount_cents, date, category_id, description, created_by
)
select
  '66000000-0000-0000-0000-000000000001',
  category_definition.kind,
  10000,
  date '2026-08-18',
  category_definition.id,
  'Finance-only fixture',
  '11111111-1111-1111-1111-111111111111'
from public.transaction_categories as category_definition
where category_definition.name = 'Pagamento de contrato';

insert into public.proposals (
  id, contact_id, sent_date, status, discount_cents, notes
)
values
  (
    '67000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    date '2026-08-01', 'accepted', 1000, 'Incomplete accepted proposal'
  ),
  (
    '67000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000002',
    date '2026-08-02', 'accepted', 2000, 'Other contact proposal'
  ),
  (
    '67000000-0000-0000-0000-000000000003',
    '61000000-0000-0000-0000-000000000001',
    date '2026-08-03', 'sent', 3000, 'Not accepted proposal'
  ),
  (
    '67000000-0000-0000-0000-000000000004',
    '61000000-0000-0000-0000-000000000003',
    date '2026-08-04', 'accepted', 4000, 'Already converted proposal'
  ),
  (
    '67000000-0000-0000-0000-000000000005',
    '61000000-0000-0000-0000-000000000001',
    date '2026-08-05', 'accepted', 5000, 'Successful conversion proposal'
  );

insert into public.proposal_services (
  id, proposal_id, service_id, price_cents
)
select
  fixture.id,
  fixture.proposal_id,
  service_definition.id,
  fixture.price_cents
from (
  values
    ('68000000-0000-0000-0000-000000000002'::uuid, '67000000-0000-0000-0000-000000000002'::uuid, 120000),
    ('68000000-0000-0000-0000-000000000003'::uuid, '67000000-0000-0000-0000-000000000003'::uuid, 130000),
    ('68000000-0000-0000-0000-000000000004'::uuid, '67000000-0000-0000-0000-000000000004'::uuid, 140000),
    ('68000000-0000-0000-0000-000000000005'::uuid, '67000000-0000-0000-0000-000000000005'::uuid, 150000)
) as fixture(id, proposal_id, price_cents)
cross join lateral (
  select id from public.services where name = 'Assessoria Premium'
) as service_definition;

-- Permission evaluation is fail-closed for every non-active identity shape.
select ok(
  public.has_perm('manage_finance')
    and public.has_perm('manage_events')
    and public.has_perm('manage_crm')
    and public.has_perm('manage_team')
    and public.has_perm('manage_settings'),
  'Admin has all five permissions'
);
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select ok(
  public.has_perm('manage_crm')
    and not public.has_perm('manage_finance')
    and not public.has_perm('manage_events')
    and not public.has_perm('manage_team')
    and not public.has_perm('manage_settings'),
  'Comercial has CRM and no other permission'
);
select is(public.has_perm('unknown_permission'), false, 'unknown permissions fail closed');
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select is(public.has_perm('manage_settings'), false, 'inactive profiles fail closed');
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
select is(public.has_perm('manage_crm'), false, 'users without a profile fail closed');

set local role anon;
select throws_ok(
  $$select id from public.event_types limit 1$$,
  '42501', null,
  'anon cannot read public tables'
);
reset role;

-- Comercial: catalog/event/CRM reads and CRM writes, but no finance/settings/event/team writes.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select results_eq(
  $$select price_cents from public.event_services where id = '63000000-0000-0000-0000-000000000001'$$,
  $$values (250000)$$,
  'Comercial reads contracted service prices'
);
select results_eq(
  $$select name from public.event_types where name = 'Casamento'$$,
  $$values ('Casamento'::text)$$,
  'Comercial reads catalogs'
);
select results_eq(
  $$select name from public.contacts where id = '61000000-0000-0000-0000-000000000001'$$,
  $$values ('Primary lead'::text)$$,
  'Comercial reads CRM data'
);
select lives_ok(
  $$
    insert into public.activities (contact_id, content)
    values ('61000000-0000-0000-0000-000000000001', 'Created by Comercial')
  $$,
  'Comercial writes CRM data'
);
select results_eq(
  $$select created_by from public.activities where content = 'Created by Comercial'$$,
  $$values ('22222222-2222-2222-2222-222222222222'::uuid)$$,
  'the CRM audit trigger records the Comercial auth.uid'
);
select is_empty(
  $$select id from public.transactions where id = '66000000-0000-0000-0000-000000000001'$$,
  'Comercial cannot read transactions'
);
select throws_ok(
  $$
    insert into public.transactions (kind, amount_cents, date, category_id)
    select kind, 5000, current_date, id
    from public.transaction_categories
    where name = 'Pagamento de contrato'
  $$,
  '42501', null,
  'Comercial cannot create transactions'
);
select is_empty(
  $$
    update public.events
    set notes = 'unauthorized event mutation'
    where id = '62000000-0000-0000-0000-000000000001'
    returning id
  $$,
  'Comercial cannot mutate events'
);
select is_empty(
  $$update public.event_types set active = false where name = 'Casamento' returning id$$,
  'Comercial cannot mutate settings catalogs'
);
select is_empty(
  $$select id from public.team_members$$,
  'Comercial cannot read team data'
);
select results_eq(
  $$select user_id from public.profiles order by user_id$$,
  $$values ('22222222-2222-2222-2222-222222222222'::uuid)$$,
  'Comercial reads only its own profile'
);
select results_eq(
  $$select name from public.roles order by name$$,
  $$values ('Comercial'::text)$$,
  'Comercial reads only its assigned role'
);

reset role;

-- Admin: settings/profile/finance access, with immutable audit columns.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select is(
  (select count(*)::integer from public.profiles),
  4,
  'Admin reads all profiles through manage_settings'
);
select results_eq(
  $$select description from public.transactions where id = '66000000-0000-0000-0000-000000000001'$$,
  $$values ('Finance-only fixture'::text)$$,
  'Admin reads transactions'
);
select lives_ok(
  $$
    update public.transactions
    set description = 'Admin business update'
    where id = '66000000-0000-0000-0000-000000000001'
  $$,
  'Admin updates transaction business columns'
);
select throws_ok(
  $$
    update public.transactions
    set created_by = '22222222-2222-2222-2222-222222222222'
    where id = '66000000-0000-0000-0000-000000000001'
  $$,
  '42501', null,
  'Admin cannot rewrite transaction created_by'
);
select throws_ok(
  $$
    update public.transactions
    set deleted_at = now()
    where id = '66000000-0000-0000-0000-000000000001'
  $$,
  '42501', null,
  'Admin cannot bypass void_transaction with deleted_at'
);
select throws_ok(
  $$delete from public.transactions where id = '66000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'Admin cannot physically delete transactions'
);
select throws_ok(
  $$
    update public.contacts
    set created_by = '22222222-2222-2222-2222-222222222222'
    where id = '61000000-0000-0000-0000-000000000001'
  $$,
  '42501', null,
  'Admin cannot rewrite contact created_by'
);
select throws_ok(
  $$
    update public.activities
    set created_by = '22222222-2222-2222-2222-222222222222'
    where id = '65000000-0000-0000-0000-000000000001'
  $$,
  '42501', null,
  'Admin cannot rewrite activity created_by'
);

reset role;

-- create_proposal_with_items: only CRM, complete validated JSON, one transaction.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select lives_ok(
  $$
    select public.create_proposal_with_items(
      '61000000-0000-0000-0000-000000000002',
      date '2026-08-18',
      2500,
      'Created atomically by Comercial',
      jsonb_build_array(
        jsonb_build_object(
          'service_id', (select id from public.services where name = 'Storymaker'),
          'variant_id', null,
          'price_cents', 175000
        )
      )
    )
  $$,
  'Comercial creates a proposal and its items through the guarded RPC'
);
select results_eq(
  $$
    select p.discount_cents, ps.price_cents
    from public.proposals as p
    join public.proposal_services as ps on ps.proposal_id = p.id
    where p.notes = 'Created atomically by Comercial'
  $$,
  $$values (2500, 175000)$$,
  'the proposal RPC persists the header and items together'
);
select throws_ok(
  $$
    select public.create_proposal_with_items(
      '61000000-0000-0000-0000-000000000002',
      date '2026-08-18',
      0,
      'Must roll back completely',
      '[{"service_id":"ffffffff-ffff-ffff-ffff-ffffffffffff","variant_id":null,"price_cents":100}]'::jsonb
    )
  $$,
  '22023', null,
  'the proposal RPC rejects an unknown service before mutation'
);
select is_empty(
  $$select id from public.proposals where notes = 'Must roll back completely'$$,
  'a rejected proposal RPC leaves no partial header'
);
select throws_ok(
  $$
    select public.create_proposal_with_items(
      '61000000-0000-0000-0000-000000000002',
      date '2026-08-18',
      0,
      'Null items must fail',
      null
    )
  $$,
  '22023', null,
  'the proposal RPC rejects SQL NULL items'
);
select is_empty(
  $$select id from public.proposals where notes = 'Null items must fail'$$,
  'NULL items cannot leave a partial proposal header'
);
reset role;

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select throws_ok(
  $$
    select public.create_proposal_with_items(
      '61000000-0000-0000-0000-000000000002',
      current_date,
      0,
      null,
      '[]'::jsonb
    )
  $$,
  '42501', null,
  'a user without manage_crm is denied before proposal input processing'
);
reset role;

-- convert_lead: every rejected state plus Comercial's controlled event creation.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select throws_ok(
  $$
    select public.convert_lead(
      '61000000-0000-0000-0000-000000000001',
      '67000000-0000-0000-0000-000000000001',
      'Incomplete proposal', date '2026-12-01', time '18:00'
    )
  $$,
  '22023', null,
  'convert_lead rejects an accepted proposal without items'
);
select is_empty(
  $$select id from public.events where name = 'Incomplete proposal'$$,
  'an itemless conversion leaves no partial event'
);
select throws_ok(
  $$
    select public.convert_lead(
      '61000000-0000-0000-0000-000000000001',
      '67000000-0000-0000-0000-000000000002',
      'Wrong owner', date '2026-12-02', null
    )
  $$,
  '22023', null,
  'convert_lead rejects a proposal from another contact'
);
select throws_ok(
  $$
    select public.convert_lead(
      '61000000-0000-0000-0000-000000000001',
      '67000000-0000-0000-0000-000000000003',
      'Not accepted', date '2026-12-03', null
    )
  $$,
  '22023', null,
  'convert_lead rejects a proposal that is not accepted'
);
select throws_ok(
  $$
    select public.convert_lead(
      '61000000-0000-0000-0000-000000000003',
      '67000000-0000-0000-0000-000000000004',
      'Duplicate conversion', date '2026-12-04', null
    )
  $$,
  '23505', null,
  'convert_lead rejects a contact already linked to an event'
);
select lives_ok(
  $$
    select public.convert_lead(
      '61000000-0000-0000-0000-000000000001',
      '67000000-0000-0000-0000-000000000005',
      'Converted by Comercial', date '2026-12-05', time '19:30'
    )
  $$,
  'Comercial converts a lead despite not having manage_events'
);
select results_eq(
  $$
    select
      e.name,
      e.event_date,
      e.event_time,
      e.discount_cents,
      e.contact_id,
      et.name
    from public.events as e
    join public.event_types as et on et.id = e.event_type_id
    where e.contact_id = '61000000-0000-0000-0000-000000000001'
  $$,
  $$values (
    'Converted by Comercial'::text,
    date '2026-12-05',
    time '19:30',
    5000,
    '61000000-0000-0000-0000-000000000001'::uuid,
    'Casamento'::text
  )$$,
  'convert_lead copies the contact type and proposal discount into the event'
);
select results_eq(
  $$
    select es.price_cents
    from public.event_services as es
    join public.events as e on e.id = es.event_id
    where e.contact_id = '61000000-0000-0000-0000-000000000001'
  $$,
  $$values (150000)$$,
  'convert_lead copies every proposal item into the event'
);
reset role;

-- Stage activation is serialized with contact assignment. The pre-check in
-- the UI is only advisory; these database rules are the authoritative guard.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
insert into public.pipeline_stages (name, position, active)
values ('Atomic guard', 5, true);
select lives_ok(
  $$select public.set_pipeline_stage_active(
      (select id from public.pipeline_stages where name = 'Atomic guard'), false
    )$$,
  'Admin can inactivate an empty stage atomically'
);
reset role;
select is(
  (select active from public.pipeline_stages where name = 'Atomic guard'),
  false,
  'the guarded activation RPC persists the requested state'
);

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select throws_ok(
  $$select public.set_pipeline_stage_active(
      (select id from public.pipeline_stages where name = 'Atomic guard'), true
    )$$,
  '42501', null,
  'a user without settings permission cannot activate a stage'
);
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select lives_ok(
  $$select public.set_pipeline_stage_active(
      (select id from public.pipeline_stages where name = 'Atomic guard'), true
    )$$,
  'Admin can reactivate a stage through the guarded RPC'
);
insert into public.contacts (name, stage_id)
values (
  'Lead that blocks inactivation',
  (select id from public.pipeline_stages where name = 'Atomic guard')
);
select throws_ok(
  $$select public.set_pipeline_stage_active(
      (select id from public.pipeline_stages where name = 'Atomic guard'), false
    )$$,
  '23514', null,
  'a stage with a live contact cannot be inactivated'
);
select lives_ok(
  $$
    update public.contacts
    set archived = true
    where name = 'Lead that blocks inactivation';
    select public.set_pipeline_stage_active(
      (select id from public.pipeline_stages where name = 'Atomic guard'), false
    )
  $$,
  'archived contacts do not prevent stage inactivation'
);
select throws_ok(
  $$
    insert into public.contacts (name, stage_id)
    values (
      'Cannot enter inactive stage',
      (select id from public.pipeline_stages where name = 'Atomic guard')
    )
  $$,
  '23514', null,
  'a live contact cannot be assigned to an inactive stage'
);
delete from public.contacts where name = 'Lead that blocks inactivation';
delete from public.pipeline_stages where name = 'Atomic guard';
reset role;

-- reorder_stages validates the complete set and survives unique-position swaps.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select throws_ok(
  $$
    select public.reorder_stages(
      array(select id from public.pipeline_stages order by position limit 3)
    )
  $$,
  '22023', null,
  'reorder_stages rejects an incomplete id list'
);
select results_eq(
  $$select name, position from public.pipeline_stages order by position$$,
  $$values
      ('Novo lead'::text, 1),
      ('Em negociação'::text, 2),
      ('Proposta enviada'::text, 3),
      ('Follow-up'::text, 4)$$,
  'a rejected reorder leaves every position unchanged'
);
select lives_ok(
  $$
    select public.reorder_stages(
      array(select id from public.pipeline_stages order by position desc)
    )
  $$,
  'reorder_stages can reverse colliding unique positions atomically'
);
select results_eq(
  $$select name, position from public.pipeline_stages order by position$$,
  $$values
      ('Follow-up'::text, 1),
      ('Proposta enviada'::text, 2),
      ('Em negociação'::text, 3),
      ('Novo lead'::text, 4)$$,
  'reorder_stages assigns final positions from the requested order'
);
reset role;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select throws_ok(
  $$
    select public.reorder_stages(
      array(select id from public.pipeline_stages order by position desc)
    )
  $$,
  '42501', null,
  'Comercial cannot reorder settings stages'
);
reset role;

-- void_transaction is the only anulation path and checks finance before mutation.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select throws_ok(
  $$select public.void_transaction('66000000-0000-0000-0000-000000000001')$$,
  '42501', null,
  'Comercial cannot void a transaction'
);
reset role;
select is(
  (select deleted_at is null from public.transactions where id = '66000000-0000-0000-0000-000000000001'),
  true,
  'a denied void leaves the transaction live'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select results_eq(
  $$select public.void_transaction('66000000-0000-0000-0000-000000000001')$$,
  $$values ('66000000-0000-0000-0000-000000000001'::uuid)$$,
  'Admin voids a transaction through the guarded RPC'
);
reset role;
select ok(
  (
    select deleted_at is not null
      and deleted_by = '11111111-1111-1111-1111-111111111111'::uuid
    from public.transactions
    where id = '66000000-0000-0000-0000-000000000001'
  ),
  'void_transaction records when and who performed the anulation'
);
set local role authenticated;
select is_empty(
  $$
    update public.transactions
    set amount_cents = 999999
    where id = '66000000-0000-0000-0000-000000000001'
    returning id
  $$,
  'a voided transaction cannot be rewritten'
);
reset role;

select throws_ok(
  $$
    update public.pipeline_stages set position = -1 where position = 1;
    set constraints pipeline_stages_position_positive immediate
  $$,
  '23514', null,
  'the deferred integrity trigger prevents negative positions from persisting'
);

select * from finish();

rollback;
