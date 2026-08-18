begin;

set local search_path = public, extensions;

select plan(16);

select has_table('public', 'events', 'creates events');
select has_table('public', 'transactions', 'creates transactions');
select has_table('public', 'activities', 'creates activities');
select col_is_pk('public', 'profiles', 'user_id', 'profiles.user_id is the primary key');
select col_type_is('public', 'events', 'event_date', 'date', 'events.event_date uses date');
select col_type_is('public', 'transactions', 'date', 'date', 'transactions.date uses date');
select col_type_is(
  'public',
  'event_services',
  'price_cents',
  'integer',
  'event service prices use integer cents'
);

select results_eq(
  $$select name from public.roles order by name$$,
  $$values ('Admin'::text), ('Comercial'::text)$$,
  'seeds the two application roles'
);

select results_eq(
  $$select name from public.event_types order by name$$,
  $$values ('15 Anos'::text), ('Casamento'::text), ('Corporativo'::text)$$,
  'seeds the initial event types'
);

select results_eq(
  $$select name from public.services order by name$$,
  $$values
      ('Aluguel de Som'::text),
      ('Assessoria Essencial'::text),
      ('Assessoria Premium'::text),
      ('Carrinho Gourmet de Brigadeiro'::text),
      ('Celebrante e Mestre de Cerimônia'::text),
      ('Foto Polaroid'::text),
      ('Orquestra'::text),
      ('Storymaker'::text)$$,
  'seeds the initial services'
);

select results_eq(
  $$select name, kind::text from public.transaction_categories order by name$$,
  $$values
      ('Gasolina/Deslocamento'::text, 'out'::text),
      ('Investimento em equipamento'::text, 'out'::text),
      ('Marketing/Instagram'::text, 'out'::text),
      ('Pagamento de contrato'::text, 'in'::text),
      ('Pagamento de freelancer'::text, 'out'::text),
      ('Sala/Escritório'::text, 'out'::text),
      ('Salário fixo'::text, 'out'::text)$$,
  'seeds the initial transaction categories'
);

select results_eq(
  $$select name, position from public.pipeline_stages order by position$$,
  $$values
      ('Novo lead'::text, 1),
      ('Em negociação'::text, 2),
      ('Proposta enviada'::text, 3),
      ('Follow-up'::text, 4)$$,
  'seeds the initial pipeline stages'
);

select ok(
  not exists (
    select 1
    from pg_index as index_definition
    where index_definition.indrelid = 'public.events'::regclass
      and index_definition.indisunique
      and index_definition.indnkeyatts = 1
      and (
        select attribute_definition.attnum
        from pg_attribute as attribute_definition
        where attribute_definition.attrelid = 'public.events'::regclass
          and attribute_definition.attname = 'contact_id'
      ) = any(index_definition.indkey)
  ),
  'does not enforce one event per contact before the integrity migration'
);

select is_empty(
  $$
    select
      constraint_definition.conrelid::regclass::text,
      constraint_definition.conname
    from pg_constraint as constraint_definition
    where constraint_definition.contype = 'f'
      and constraint_definition.connamespace = 'public'::regnamespace
      and not exists (
        select 1
        from pg_index as index_definition
        where index_definition.indrelid = constraint_definition.conrelid
          and index_definition.indisvalid
          and index_definition.indpred is null
          and index_definition.indexprs is null
          and (index_definition.indkey::smallint[])[
            0:cardinality(constraint_definition.conkey) - 1
          ] = constraint_definition.conkey
      )
    order by 1, 2
  $$,
  'indexes every public foreign key with the FK columns as the leading index columns'
);

select lives_ok(
  $$
    insert into public.roles (
      name,
      manage_finance,
      manage_events,
      manage_crm,
      manage_team,
      manage_settings
    )
    values
      ('Admin', true, true, true, true, true),
      ('Comercial', false, false, true, false, false)
    on conflict (name) do nothing
  $$,
  'role seed can be replayed safely'
);

select lives_ok(
  $$
    insert into public.transaction_categories (name, kind)
    values ('Pagamento de contrato', 'in')
    on conflict (name) do nothing
  $$,
  'category seed supports safe replay by name'
);

select * from finish();

rollback;
