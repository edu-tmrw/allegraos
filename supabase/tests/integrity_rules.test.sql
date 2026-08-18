begin;

set local search_path = public, extensions;

select plan(33);

select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
select throws_ok(
  $$
    insert into public.transactions (kind, amount_cents, date, category_id, created_by)
    values (
      'in',
      0,
      current_date,
      '00000000-0000-0000-0000-000000000000',
      '99999999-9999-9999-9999-999999999999'
    )
  $$,
  '23514',
  null,
  'rejects zero transaction amount'
);

select has_index('public', 'events', 'events_one_contact_idx', 'indexes one event per contact');
select has_column('public', 'transactions', 'deleted_at', 'transactions record when they were voided');
select has_column('public', 'transactions', 'deleted_by', 'transactions record who voided them');
select fk_ok(
  'public', 'transactions', 'deleted_by',
  'public', 'profiles', 'user_id',
  'voided transactions reference the responsible profile'
);
select has_index(
  'public', 'transactions', 'transactions_live_date_idx',
  'indexes live transactions by descending date'
);
select has_index(
  'public', 'transactions', 'transactions_deleted_by_idx',
  'indexes the transaction audit foreign key'
);

select has_function('public', 'set_created_by', array[]::text[], 'creates the audit trigger function');
select has_function(
  'public', 'void_transaction', array['uuid'],
  'creates the audited transaction-voiding RPC'
);

select ok(
  (
    select procedure_definition.prosecdef
      and procedure_definition.proconfig = array['search_path=public, auth']::text[]
    from pg_proc as procedure_definition
    where procedure_definition.oid = to_regprocedure('public.set_created_by()')
  ),
  'set_created_by is security definer with a fixed search path'
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
  not coalesce(
    has_function_privilege('public', to_regprocedure('public.set_created_by()'), 'execute'),
    false
  ),
  'PUBLIC cannot execute set_created_by'
);
select ok(
  not coalesce(
    has_function_privilege('anon', to_regprocedure('public.set_created_by()'), 'execute'),
    false
  ),
  'anon cannot execute set_created_by'
);
select ok(
  not coalesce(
    has_function_privilege('authenticated', to_regprocedure('public.set_created_by()'), 'execute'),
    false
  ),
  'authenticated cannot execute set_created_by directly'
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
    has_function_privilege('anon', to_regprocedure('public.void_transaction(uuid)'), 'execute'),
    false
  ),
  'anon cannot execute void_transaction'
);
select ok(
  not coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.void_transaction(uuid)'),
      'execute'
    ),
    false
  ),
  'void_transaction remains fail-closed until authorization policies land'
);
select ok(
  not has_table_privilege('authenticated', 'public.transactions', 'delete'),
  'authenticated cannot physically delete transactions'
);

select ok(
  (
    select count(*) = 3
      and count(distinct event_object_table) = 3
      and bool_and(event_object_table in ('activities', 'contacts', 'transactions'))
    from information_schema.triggers
    where trigger_schema = 'public'
      and action_statement = 'EXECUTE FUNCTION set_created_by()'
  ),
  'created_by is assigned by triggers on every audited table'
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
  'RLS is enabled on all 15 public tables'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
  ),
  0,
  'no permissive policy opens the fail-closed rollout'
);

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
    'authenticated',
    'authenticated',
    'auditor-one@example.test',
    '',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'auditor-two@example.test',
    '',
    now(),
    now()
  );

insert into public.profiles (user_id, name, role_id)
select
  fixture.user_id,
  fixture.name,
  role_definition.id
from (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'Auditor One'::text),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'Auditor Two'::text)
) as fixture(user_id, name)
cross join lateral (
  select id from public.roles where name = 'Admin'
) as role_definition;

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  format(
    $sql$
      insert into public.contacts (name, stage_id, created_by)
      values ('Unauthenticated', %L, '22222222-2222-2222-2222-222222222222')
    $sql$,
    (select id from public.pipeline_stages where position = 1)
  ),
  '42501',
  null,
  'rejects unauthenticated inserts even when created_by is supplied'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

insert into public.contacts (id, name, stage_id, created_by)
select
  '33333333-3333-3333-3333-333333333333',
  'Authenticated contact',
  stage_definition.id,
  '22222222-2222-2222-2222-222222222222'
from public.pipeline_stages as stage_definition
where stage_definition.position = 1;

select is(
  (select created_by from public.contacts where id = '33333333-3333-3333-3333-333333333333'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'contact created_by always comes from auth.uid()'
);

insert into public.activities (id, contact_id, content, created_by)
values (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  'Audited activity',
  '22222222-2222-2222-2222-222222222222'
);

select is(
  (select created_by from public.activities where id = '44444444-4444-4444-4444-444444444444'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'activity created_by always comes from auth.uid()'
);

insert into public.transactions (id, kind, amount_cents, date, category_id, created_by)
select
  '55555555-5555-5555-5555-555555555555',
  category_definition.kind,
  1000,
  current_date,
  category_definition.id,
  '22222222-2222-2222-2222-222222222222'
from public.transaction_categories as category_definition
where category_definition.name = 'Pagamento de contrato';

select is(
  (select created_by from public.transactions where id = '55555555-5555-5555-5555-555555555555'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'transaction created_by always comes from auth.uid()'
);

select lives_ok(
  $test$
    do $block$
    declare
      returned_id uuid;
    begin
      execute 'select public.void_transaction($1)'
        into returned_id
        using '55555555-5555-5555-5555-555555555555'::uuid;

      if returned_id is distinct from '55555555-5555-5555-5555-555555555555'::uuid then
        raise exception 'void_transaction returned %', returned_id;
      end if;
    end
    $block$
  $test$,
  'void_transaction returns the preserved transaction id'
);
select lives_ok(
  $test$
    do $block$
    declare
      audit_is_complete boolean;
    begin
      execute $query$
        select deleted_at is not null
          and deleted_by = '11111111-1111-1111-1111-111111111111'::uuid
        from public.transactions
        where id = '55555555-5555-5555-5555-555555555555'
      $query$
      into audit_is_complete;

      if audit_is_complete is distinct from true then
        raise exception 'transaction audit stamp is incomplete';
      end if;
    end
    $block$
  $test$,
  'void_transaction stamps the authenticated actor without deleting the row'
);

insert into public.events (name, event_type_id, event_date, contact_id)
select
  'Converted lead',
  event_type_definition.id,
  current_date,
  '33333333-3333-3333-3333-333333333333'
from public.event_types as event_type_definition
where event_type_definition.name = 'Casamento';

select throws_ok(
  format(
    $sql$
      insert into public.events (name, event_type_id, event_date, contact_id)
      values ('Duplicate conversion', %L, current_date, '33333333-3333-3333-3333-333333333333')
    $sql$,
    (select id from public.event_types where name = 'Casamento')
  ),
  '23505',
  null,
  'rejects a second event for the same converted contact'
);

select throws_ok(
  format(
    $sql$
      insert into public.transactions (kind, amount_cents, date, category_id, created_by)
      values ('in', 100, current_date, %L, '22222222-2222-2222-2222-222222222222')
    $sql$,
    (
      select id
      from public.transaction_categories
      where name = 'Gasolina/Deslocamento'
    )
  ),
  '23503',
  null,
  'the declarative foreign key rejects a category with the wrong transaction kind'
);

insert into public.service_variants (id, service_id, name, default_price_cents)
select
  '66666666-6666-6666-6666-666666666666',
  service_definition.id,
  'Variant for invariant test',
  100
from public.services as service_definition
where service_definition.name = 'Assessoria Premium';

select throws_ok(
  format(
    $sql$
      insert into public.event_services (event_id, service_id, variant_id, price_cents)
      values (
        (select id from public.events where name = 'Converted lead'),
        %L,
        '66666666-6666-6666-6666-666666666666',
        100
      )
    $sql$,
    (select id from public.services where name = 'Storymaker')
  ),
  '23503',
  null,
  'the declarative foreign key rejects an event variant from another service'
);

insert into public.proposals (id, contact_id, sent_date)
values (
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333333',
  current_date
);

select throws_ok(
  format(
    $sql$
      insert into public.proposal_services (proposal_id, service_id, variant_id, price_cents)
      values (
        '77777777-7777-7777-7777-777777777777',
        %L,
        '66666666-6666-6666-6666-666666666666',
        100
      )
    $sql$,
    (select id from public.services where name = 'Storymaker')
  ),
  '23503',
  null,
  'the declarative foreign key rejects a proposal variant from another service'
);

select ok(
  to_regprocedure('public.assert_transaction_category_kind()') is null
    and to_regprocedure('public.assert_service_variant()') is null,
  'does not duplicate declarative invariants with trigger functions'
);
select is(
  (
    select count(*)::integer
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'transactions'
      and event_manipulation = 'DELETE'
  ),
  0,
  'does not implement physical deletion through a trigger'
);

select * from finish();

rollback;
