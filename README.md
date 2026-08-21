# AllegraOS

Sistema de gestão da Allegra para eventos, financeiro, CRM, equipe e configurações. A aplicação usa Supabase Auth, PostgreSQL com RLS, views financeiras e RPCs transacionais; o frontend nunca recebe a `service_role`.

## Stack

- React 19, Vite e TypeScript
- React Router, TanStack Query, Tailwind CSS e shadcn/ui
- Supabase Auth, Postgres, Row Level Security e Edge Functions
- Vitest, Testing Library e pgTAP

## Ambiente local

Pré-requisitos: Node.js, Docker, Supabase CLI e Deno.

```bash
npm install
supabase start
supabase db reset --local
cp .env.example .env.local
npm run dev
```

Preencha somente as credenciais públicas do projeto em `.env.local`:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Nenhuma chave `service_role` deve ser armazenada no frontend, em arquivos `.env` do Vite ou no repositório.

## Verificação local

```bash
npm run typecheck
npm test -- --run
npm run build
supabase test db
deno test --allow-env supabase/functions/invite-user/index.test.ts
deno fmt --check supabase/functions/invite-user
deno lint supabase/functions/invite-user
deno check --config supabase/functions/invite-user/deno.json supabase/functions/invite-user/index.ts
```

O banco deve ser reconstruído a partir das migrations; não edite o schema remoto manualmente. Os tipos em `src/data/supabase/database.types.ts` são gerados do schema:

```bash
supabase gen types typescript --local > src/data/supabase/database.types.ts
```

## Segurança e dados

- RLS é a fronteira de autorização de todas as tabelas públicas.
- `has_perm` resolve permissões a partir do perfil ativo e do papel do usuário autenticado.
- Propostas, conversão de leads, reordenação/inativação de etapas e anulação de lançamentos usam RPCs transacionais.
- Lançamentos anulados mantêm `deleted_at` e `deleted_by`; não há exclusão física pelo cliente.
- Views financeiras usam `security_invoker` e respeitam RLS.
- A função `invite-user` valida JWT e `manage_settings` antes de criar um cliente administrativo.

## Publicação no Supabase

Projeto de produção: `xvivhukirpekjdcuxoss`.

1. Confirme que a história remota não tem drift e aplique todas as migrations locais na ordem registrada.
2. Regenere os tipos a partir do remoto e compare com o arquivo versionado.
3. Configure os secrets da Edge Function apenas no Supabase.
4. Publique `invite-user` mantendo a verificação JWT habilitada. O modo esperado está declarado em `supabase/config.toml` como `verify_jwt = true`; não use `--no-verify-jwt`.
5. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` na Vercel e publique o frontend.

Fluxo equivalente pela CLI, quando autorizado:

```bash
supabase link --project-ref xvivhukirpekjdcuxoss
supabase migration list
supabase db push
supabase gen types typescript --linked > src/data/supabase/database.types.ts
supabase functions deploy invite-user
supabase functions list
```

## Bootstrap da primeira administradora

Este procedimento é usado uma única vez, antes de existir uma administradora capaz de enviar convites:

1. No Supabase Auth, crie a usuária e copie o UUID gerado.
2. No SQL Editor, como proprietária do banco, associe esse UUID ao papel `Admin`:

```sql
insert into public.profiles (user_id, name, role_id, active)
select '<auth-user-uuid>'::uuid, '<nome>', role.id, true
from public.roles as role
where role.name = 'Admin';
```

3. Faça login, confirme o acesso a Configurações e passe a usar o fluxo normal de convite.

Não registre email, senha, token, UUID real ou chave administrativa no repositório. O roteiro de produção e o registro de evidências ficam em `docs/superpowers/validation/f2-production-checklist.md`.

## Estrutura

```text
src/domain/                 tipos e cálculos puros
src/data/supabase/          cliente, tipos gerados e mapeadores
src/data/hooks/             consultas e mutações TanStack Query
src/pages/                  telas por área
supabase/migrations/        história imutável do schema
supabase/functions/         Edge Functions
supabase/tests/             testes pgTAP
docs/superpowers/           specs, planos e validações
```

## Deploy do frontend

A Vercel serve a SPA com o rewrite de `vercel.json`. O deploy só deve ser promovido depois que o checklist de produção estiver verde.
