create type public.transaction_kind as enum ('in', 'out');
create type public.proposal_status as enum ('sent', 'accepted', 'rejected');

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  manage_finance boolean not null default false,
  manage_events boolean not null default false,
  manage_crm boolean not null default false,
  manage_team boolean not null default false,
  manage_settings boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  role_id uuid not null references public.roles(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index profiles_role_id_idx on public.profiles(role_id);

create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  default_price_cents integer check (default_price_cents is null or default_price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.service_variants (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  default_price_cents integer not null check (default_price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (service_id, name),
  unique (id, service_id)
);

create table public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  kind public.transaction_kind not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, kind)
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  position integer not null check (position > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index pipeline_stages_active_position_key
  on public.pipeline_stages(position) where active;

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  role_label text not null check (length(trim(role_label)) > 0),
  pay_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  email text,
  event_type_id uuid references public.event_types(id) on delete restrict,
  stage_id uuid not null references public.pipeline_stages(id) on delete restrict,
  archived boolean not null default false,
  notes text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);
create index contacts_event_type_id_idx on public.contacts(event_type_id);
create index contacts_stage_id_idx on public.contacts(stage_id);
create index contacts_created_by_idx on public.contacts(created_by);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  event_type_id uuid not null references public.event_types(id) on delete restrict,
  event_date date not null,
  event_time time,
  contact_id uuid references public.contacts(id) on delete restrict,
  discount_cents integer not null default 0 check (discount_cents >= 0),
  canceled boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index events_event_type_id_idx on public.events(event_type_id);
create index events_contact_id_idx on public.events(contact_id);
create index events_event_date_idx on public.events(event_date);

create table public.event_services (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  variant_id uuid,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now(),
  foreign key (variant_id, service_id) references public.service_variants(id, service_id) on delete restrict
);
create index event_services_event_closed_idx on public.event_services(event_id, created_at);
create index event_services_service_id_idx on public.event_services(service_id);
create index event_services_variant_service_idx on public.event_services(variant_id, service_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  kind public.transaction_kind not null,
  amount_cents integer not null check (amount_cents > 0),
  date date not null,
  category_id uuid not null,
  event_id uuid references public.events(id) on delete restrict,
  description text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (category_id, kind) references public.transaction_categories(id, kind) on delete restrict
);
create index transactions_category_kind_idx on public.transactions(category_id, kind);
create index transactions_event_id_idx on public.transactions(event_id);
create index transactions_created_by_idx on public.transactions(created_by);
create index transactions_date_idx on public.transactions(date desc);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  sent_date date not null,
  status public.proposal_status not null default 'sent',
  discount_cents integer not null default 0 check (discount_cents >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create index proposals_contact_id_idx on public.proposals(contact_id);

create table public.proposal_services (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  variant_id uuid,
  price_cents integer not null check (price_cents >= 0),
  foreign key (variant_id, service_id) references public.service_variants(id, service_id) on delete restrict
);
create index proposal_services_proposal_id_idx on public.proposal_services(proposal_id);
create index proposal_services_service_id_idx on public.proposal_services(service_id);
create index proposal_services_variant_service_idx on public.proposal_services(variant_id, service_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  content text not null check (length(trim(content)) > 0),
  due_date date,
  done boolean not null default false,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);
create index activities_contact_due_idx on public.activities(contact_id, due_date);
create index activities_created_by_idx on public.activities(created_by);

insert into public.roles (name, manage_finance, manage_events, manage_crm, manage_team, manage_settings)
values
  ('Admin', true, true, true, true, true),
  ('Comercial', false, false, true, false, false)
on conflict (name) do nothing;

insert into public.event_types (name)
values ('Casamento'), ('15 Anos'), ('Corporativo')
on conflict (name) do nothing;

insert into public.transaction_categories (name, kind) values
  ('Pagamento de contrato', 'in'),
  ('Gasolina/Deslocamento', 'out'),
  ('Pagamento de freelancer', 'out'),
  ('Sala/Escritório', 'out'),
  ('Investimento em equipamento', 'out'),
  ('Salário fixo', 'out'),
  ('Marketing/Instagram', 'out')
on conflict (name) do nothing;

insert into public.pipeline_stages (name, position)
values
  ('Novo lead', 1), ('Em negociação', 2), ('Proposta enviada', 3), ('Follow-up', 4)
on conflict (name) do nothing;

insert into public.services (name, default_price_cents) values
  ('Assessoria Premium', null), ('Assessoria Essencial', null),
  ('Celebrante e Mestre de Cerimônia', null), ('Storymaker', null),
  ('Orquestra', null), ('Foto Polaroid', null),
  ('Carrinho Gourmet de Brigadeiro', null), ('Aluguel de Som', null)
on conflict (name) do nothing;
