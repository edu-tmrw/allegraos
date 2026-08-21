begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

select has_view('public', 'v_event_financials', 'event financials view exists');
select has_view('public', 'v_cash_position', 'cash position view exists');
select has_view('public', 'v_monthly_flow', 'monthly flow view exists');
select has_view('public', 'v_service_sales', 'service sales view exists');
select has_view('public', 'v_category_expenses', 'category expenses view exists');

select is(
  (
    select count(*)::integer
    from pg_class as view_definition
    join pg_namespace as schema_definition
      on schema_definition.oid = view_definition.relnamespace
    where schema_definition.nspname = 'public'
      and view_definition.relname in (
        'v_event_financials',
        'v_cash_position',
        'v_monthly_flow',
        'v_service_sales',
        'v_category_expenses'
      )
      and coalesce(view_definition.reloptions, array[]::text[]) @> array['security_invoker=true']
  ),
  5,
  'all financial views execute with invoker security'
);

select ok(
  has_table_privilege('authenticated', 'public.v_event_financials', 'select')
    and has_table_privilege('authenticated', 'public.v_cash_position', 'select')
    and has_table_privilege('authenticated', 'public.v_monthly_flow', 'select')
    and has_table_privilege('authenticated', 'public.v_service_sales', 'select')
    and has_table_privilege('authenticated', 'public.v_category_expenses', 'select'),
  'authenticated receives only the SELECT capability needed to query financial views'
);
select ok(
  not has_table_privilege('anon', 'public.v_event_financials', 'select')
    and not has_table_privilege('anon', 'public.v_cash_position', 'select')
    and not has_table_privilege('anon', 'public.v_monthly_flow', 'select')
    and not has_table_privilege('anon', 'public.v_service_sales', 'select')
    and not has_table_privilege('anon', 'public.v_category_expenses', 'select'),
  'anon receives no access to financial views'
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
    '71111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'admin-finance@example.test', '', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '72222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'commercial-finance@example.test', '', now(), now()
  );

insert into public.profiles (user_id, name, role_id, active)
select fixture.user_id, fixture.name, role_definition.id, true
from (
  values
    ('71111111-1111-1111-1111-111111111111'::uuid, 'Admin Finance'::text, 'Admin'::text),
    ('72222222-2222-2222-2222-222222222222'::uuid, 'Commercial Finance'::text, 'Comercial'::text)
) as fixture(user_id, name, role_name)
join public.roles as role_definition on role_definition.name = fixture.role_name;

select set_config('request.jwt.claim.sub', '71111111-1111-1111-1111-111111111111', true);

insert into public.events (
  id, name, event_type_id, event_date, discount_cents, canceled
)
select
  fixture.id,
  fixture.name,
  event_type_definition.id,
  fixture.event_date,
  fixture.discount_cents,
  fixture.canceled
from (
  values
    (
      '73000000-0000-0000-0000-000000000001'::uuid,
      'Discounted event'::text,
      date '2026-09-20',
      10000,
      false
    ),
    (
      '73000000-0000-0000-0000-000000000002'::uuid,
      'Canceled event'::text,
      date '2026-10-20',
      0,
      true
    ),
    (
      '73000000-0000-0000-0000-000000000003'::uuid,
      'Overpaid event'::text,
      date '2026-11-20',
      0,
      false
    ),
    (
      '73000000-0000-0000-0000-000000000004'::uuid,
      'Discount clamp event'::text,
      date '2026-12-20',
      20000,
      false
    )
) as fixture(id, name, event_date, discount_cents, canceled)
cross join lateral (
  select id from public.event_types where name = 'Casamento'
) as event_type_definition;

insert into public.event_services (
  id, event_id, service_id, price_cents, created_at
)
select
  fixture.id,
  fixture.event_id,
  service_definition.id,
  fixture.price_cents,
  fixture.created_at
from (
  values
    (
      '74000000-0000-0000-0000-000000000001'::uuid,
      '73000000-0000-0000-0000-000000000001'::uuid,
      100000,
      timestamptz '2026-08-18 10:00:00+00'
    ),
    (
      '74000000-0000-0000-0000-000000000002'::uuid,
      '73000000-0000-0000-0000-000000000001'::uuid,
      50000,
      timestamptz '2026-08-19 11:00:00+00'
    ),
    (
      '74000000-0000-0000-0000-000000000003'::uuid,
      '73000000-0000-0000-0000-000000000002'::uuid,
      200000,
      timestamptz '2026-08-20 12:00:00+00'
    ),
    (
      '74000000-0000-0000-0000-000000000004'::uuid,
      '73000000-0000-0000-0000-000000000003'::uuid,
      30000,
      timestamptz '2026-09-01 09:00:00+00'
    ),
    (
      '74000000-0000-0000-0000-000000000005'::uuid,
      '73000000-0000-0000-0000-000000000004'::uuid,
      10000,
      timestamptz '2026-09-02 09:00:00+00'
    )
) as fixture(id, event_id, price_cents, created_at)
cross join lateral (
  select id from public.services where name = 'Assessoria Premium'
) as service_definition;

insert into public.transactions (
  id, kind, amount_cents, date, category_id, event_id, description, deleted_at, deleted_by
)
select
  fixture.id,
  fixture.kind::public.transaction_kind,
  fixture.amount_cents,
  fixture.date,
  category_definition.id,
  fixture.event_id,
  fixture.description,
  fixture.deleted_at,
  case when fixture.deleted_at is null then null else '71111111-1111-1111-1111-111111111111'::uuid end
from (
  values
    (
      '75000000-0000-0000-0000-000000000001'::uuid,
      'in'::text, 40000, date '2026-08-20',
      '73000000-0000-0000-0000-000000000001'::uuid,
      'live received'::text, null::timestamptz
    ),
    (
      '75000000-0000-0000-0000-000000000002'::uuid,
      'out'::text, 5000, date '2026-08-21',
      '73000000-0000-0000-0000-000000000001'::uuid,
      'live cost'::text, null::timestamptz
    ),
    (
      '75000000-0000-0000-0000-000000000003'::uuid,
      'in'::text, 90000, date '2026-08-22',
      '73000000-0000-0000-0000-000000000001'::uuid,
      'voided received'::text, timestamptz '2026-08-23 10:00:00+00'
    ),
    (
      '75000000-0000-0000-0000-000000000004'::uuid,
      'in'::text, 10000, date '2026-08-24',
      '73000000-0000-0000-0000-000000000002'::uuid,
      'canceled received'::text, null::timestamptz
    ),
    (
      '75000000-0000-0000-0000-000000000005'::uuid,
      'in'::text, 50000, date '2026-09-03',
      '73000000-0000-0000-0000-000000000003'::uuid,
      'overpayment'::text, null::timestamptz
    ),
    (
      '75000000-0000-0000-0000-000000000006'::uuid,
      'out'::text, 2000, date '2026-09-04',
      '73000000-0000-0000-0000-000000000003'::uuid,
      'overpaid event cost'::text, null::timestamptz
    ),
    (
      '75000000-0000-0000-0000-000000000007'::uuid,
      'out'::text, 70000, date '2026-09-05',
      null::uuid,
      'administrative expense'::text, null::timestamptz
    ),
    (
      '75000000-0000-0000-0000-000000000008'::uuid,
      'out'::text, 999000, date '2026-09-06',
      null::uuid,
      'voided expense'::text, timestamptz '2026-09-07 10:00:00+00'
    )
) as fixture(id, kind, amount_cents, date, event_id, description, deleted_at)
join public.transaction_categories as category_definition
  on category_definition.name = case
    when fixture.kind = 'in' then 'Pagamento de contrato'
    when fixture.amount_cents = 70000 then 'Marketing/Instagram'
    else 'Gasolina/Deslocamento'
  end;

set local role authenticated;

select results_eq(
  $$
    select contract_cents, received_cents, cost_cents, profit_cents, receivable_cents
    from public.v_event_financials
    where event_id = '73000000-0000-0000-0000-000000000001'
  $$,
  $$values (140000::bigint, 40000::bigint, 5000::bigint, 35000::bigint, 100000::bigint)$$,
  'event financials match the oracle for discount, live receipts, costs, profit and receivable'
);
select results_eq(
  $$
    select received_cents, receivable_cents
    from public.v_event_financials
    where event_id = '73000000-0000-0000-0000-000000000001'
  $$,
  $$values (40000::bigint, 100000::bigint)$$,
  'annulled receipts do not enter event financials'
);
select results_eq(
  $$
    select contract_cents, received_cents, receivable_cents
    from public.v_event_financials
    where event_id = '73000000-0000-0000-0000-000000000002'
  $$,
  $$values (200000::bigint, 10000::bigint, 0::bigint)$$,
  'a canceled event keeps its contract and receipts but has zero receivable'
);
select results_eq(
  $$
    select received_cents, cost_cents, profit_cents, receivable_cents
    from public.v_event_financials
    where event_id = '73000000-0000-0000-0000-000000000003'
  $$,
  $$values (50000::bigint, 2000::bigint, 48000::bigint, 0::bigint)$$,
  'overpayment clamps receivable to zero while profit remains received minus cost'
);
select results_eq(
  $$
    select contract_cents, receivable_cents
    from public.v_event_financials
    where event_id = '73000000-0000-0000-0000-000000000004'
  $$,
  $$values (0::bigint, 0::bigint)$$,
  'discount greater than item value clamps contract and receivable to zero'
);
select results_eq(
  $$select cash_cents from public.v_cash_position$$,
  $$values (23000::bigint)$$,
  'cash position includes every live receipt and expense and ignores annulled transactions'
);
select results_eq(
  $$
    select month, revenue_cents, expenses_cents, profit_cents
    from public.v_monthly_flow
    order by month
  $$,
  $$
    values
      (date '2026-08-01', 50000::bigint, 5000::bigint, 45000::bigint),
      (date '2026-09-01', 50000::bigint, 72000::bigint, -22000::bigint)
  $$,
  'monthly flow groups live transactions by calendar month'
);
select results_eq(
  $$
    select closed_at
    from public.v_service_sales
    where event_service_id = '74000000-0000-0000-0000-000000000001'
  $$,
  $$values (timestamptz '2026-08-18 10:00:00+00')$$,
  'service sales use the item close timestamp even when the event date is in another month'
);
select is_empty(
  $$
    select event_service_id
    from public.v_service_sales
    where event_service_id = '74000000-0000-0000-0000-000000000003'
  $$,
  'service sales exclude items from canceled events like the TypeScript oracle'
);
select results_eq(
  $$
    select date, category_name, total_cents
    from public.v_category_expenses
    order by date, category_name
  $$,
  $$
    values
      (date '2026-08-21', 'Gasolina/Deslocamento'::text, 5000::bigint),
      (date '2026-09-04', 'Gasolina/Deslocamento'::text, 2000::bigint),
      (date '2026-09-05', 'Marketing/Instagram'::text, 70000::bigint)
  $$,
  'category expenses retain transaction dates and ignore receipts and annulled expenses'
);

reset role;
select set_config('request.jwt.claim.sub', '72222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is_empty(
  $$select * from public.v_event_financials$$,
  'Comercial obtains no event financial rows or contract-derived values'
);
select is_empty(
  $$select * from public.v_cash_position$$,
  'Comercial obtains zero rows, not a zero aggregate, from cash position'
);
select is_empty(
  $$select * from public.v_monthly_flow$$,
  'Comercial obtains no monthly flow rows'
);
select is_empty(
  $$select * from public.v_service_sales$$,
  'Comercial obtains no service sales rows despite readable event items'
);
select is_empty(
  $$select * from public.v_category_expenses$$,
  'Comercial obtains no category expense rows'
);

reset role;

select * from finish();

rollback;
