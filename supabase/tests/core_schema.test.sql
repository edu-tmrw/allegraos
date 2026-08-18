begin;

set local search_path = public, extensions;

select plan(49);

select has_table('public', 'roles', 'creates roles');
select has_table('public', 'profiles', 'creates profiles');
select has_table('public', 'event_types', 'creates event types');
select has_table('public', 'services', 'creates services');
select has_table('public', 'service_variants', 'creates service variants');
select has_table('public', 'transaction_categories', 'creates transaction categories');
select has_table('public', 'pipeline_stages', 'creates pipeline stages');
select has_table('public', 'team_members', 'creates team members');
select has_table('public', 'contacts', 'creates contacts');
select has_table('public', 'events', 'creates events');
select has_table('public', 'event_services', 'creates event services');
select has_table('public', 'transactions', 'creates transactions');
select has_table('public', 'proposals', 'creates proposals');
select has_table('public', 'proposal_services', 'creates proposal services');
select has_table('public', 'activities', 'creates activities');

select has_enum('public', 'transaction_kind', 'creates the transaction kind enum');
select has_enum('public', 'proposal_status', 'creates the proposal status enum');

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

select fk_ok(
  'public', 'profiles', 'user_id',
  'auth', 'users', 'id',
  'profiles reference auth users'
);
select fk_ok(
  'public', 'profiles', 'role_id',
  'public', 'roles', 'id',
  'profiles reference roles'
);
select fk_ok(
  'public', 'service_variants', 'service_id',
  'public', 'services', 'id',
  'service variants reference services'
);
select fk_ok(
  'public', 'contacts', 'event_type_id',
  'public', 'event_types', 'id',
  'contacts reference event types'
);
select fk_ok(
  'public', 'contacts', 'stage_id',
  'public', 'pipeline_stages', 'id',
  'contacts reference pipeline stages'
);
select fk_ok(
  'public', 'contacts', 'created_by',
  'public', 'profiles', 'user_id',
  'contacts reference their creator profile'
);
select fk_ok(
  'public', 'events', 'event_type_id',
  'public', 'event_types', 'id',
  'events reference event types'
);
select fk_ok(
  'public', 'events', 'contact_id',
  'public', 'contacts', 'id',
  'events reference their source contact'
);
select fk_ok(
  'public', 'event_services', 'event_id',
  'public', 'events', 'id',
  'event services reference events'
);
select fk_ok(
  'public', 'event_services', 'service_id',
  'public', 'services', 'id',
  'event services reference services'
);
select fk_ok(
  'public', 'event_services', array['variant_id', 'service_id'],
  'public', 'service_variants', array['id', 'service_id'],
  'event service variants belong to the selected service'
);
select fk_ok(
  'public', 'transactions', array['category_id', 'kind'],
  'public', 'transaction_categories', array['id', 'kind'],
  'transaction categories match the transaction kind'
);
select fk_ok(
  'public', 'transactions', 'event_id',
  'public', 'events', 'id',
  'transactions reference events'
);
select fk_ok(
  'public', 'transactions', 'created_by',
  'public', 'profiles', 'user_id',
  'transactions reference their creator profile'
);
select fk_ok(
  'public', 'proposals', 'contact_id',
  'public', 'contacts', 'id',
  'proposals reference contacts'
);
select fk_ok(
  'public', 'proposal_services', 'proposal_id',
  'public', 'proposals', 'id',
  'proposal services reference proposals'
);
select fk_ok(
  'public', 'proposal_services', 'service_id',
  'public', 'services', 'id',
  'proposal services reference services'
);
select fk_ok(
  'public', 'proposal_services', array['variant_id', 'service_id'],
  'public', 'service_variants', array['id', 'service_id'],
  'proposal service variants belong to the selected service'
);
select fk_ok(
  'public', 'activities', 'contact_id',
  'public', 'contacts', 'id',
  'activities reference contacts'
);
select fk_ok(
  'public', 'activities', 'created_by',
  'public', 'profiles', 'user_id',
  'activities reference their creator profile'
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
