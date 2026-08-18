# AllegraOS F2 Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist AllegraOS data in the configured Supabase project with Auth, Postgres integrity rules, RLS, derived views and transaction-safe workflows, without changing page consumers.

**Architecture:** Versioned SQL migrations establish the entire database contract before the React data layer is swapped. `src/data/supabase/` maps database rows to existing domain types, and existing hooks continue to be the only page-facing API. RLS and RPCs enforce every permission and multi-table invariant independently of the browser.

**Tech Stack:** Supabase CLI and Postgres, Supabase Auth, Edge Functions (Deno), `@supabase/supabase-js`, React 19, TanStack Query v5, Vitest, TypeScript 7.

**Spec:** `docs/superpowers/specs/2026-08-18-allegra-os-f2-supabase-design.md`

## Global Constraints

- Target the configured project ref `xvivhukirpekjdcuxoss`; never expose a service-role key to the Vite client.
- Every schema or Edge Function change is represented by a committed Supabase migration or function source and applied to the remote project.
- Money is integer cents; dates cross the frontend boundary as `YYYY-MM-DD`; no domain-derived amount is stored.
- RLS is the authorization boundary. Commercial may read event items, prices and event discount but cannot read or mutate financial records or views.
- `v_service_sales` filters on the close date (`event_services.created_at`), not event date or payment date.
- No physical deletion of catalog records in use; transaction deletion is an audited annulment.
- Pages/components never import `supabase-js` or a mock store directly.
- Run `npm run typecheck`, `npm test`, and `npm run build` after each application-facing task.

---

## File Structure

| Path | Responsibility |
|---|---|
| `supabase/config.toml` | Local CLI project configuration. |
| `supabase/migrations/*.sql` | Schema, constraints, RLS, views, RPCs and seed data, applied in chronological order. |
| `supabase/functions/invite-user/index.ts` | Authenticated, privileged user invitation endpoint. |
| `supabase/tests/*.sql` | pgTAP integration tests for database rules, views, RPCs and RLS. |
| `src/data/supabase/client.ts` | Validated browser client and environment access. |
| `src/data/supabase/rows.ts` | Explicit snake_case ↔ camelCase row conversion. |
| `src/data/supabase/errors.ts` | Safe Portuguese messages for PostgREST/Auth failures. |
| `src/data/auth.tsx` | Real session/profile provider and permission guards. |
| `src/data/hooks/*.ts` | Existing public hook APIs backed by Supabase queries and RPCs. |
| `src/data/**/*.test.tsx` | Hook/auth unit tests using a typed Supabase test double only at the client boundary. |
| `.env.example` | Public variable names only. |

### Task 1: Initialize Supabase project and browser client contract

**Files:**
- Create: `supabase/config.toml`
- Create: `src/data/supabase/client.ts`
- Create: `src/data/supabase/client.test.ts`
- Create: `.env.example`
- Modify: `package.json`

**Interfaces:**
- Produces `supabase` and `requireSupabaseEnv(): { url: string; publishableKey: string }`. Task 6 adds the generated `Database` generic after the remote schema exists.
- Consumes `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` only.

- [ ] **Step 1: Write the failing environment test.**

```ts
import { expect, test, vi } from "vitest";

test("rejects a missing Supabase URL", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pk_test");
  const { requireSupabaseEnv } = await import("./client");
  expect(() => requireSupabaseEnv()).toThrow("VITE_SUPABASE_URL");
});
```

- [ ] **Step 2: Run the test and verify it fails because the module does not exist.**

Run: `npm test -- src/data/supabase/client.test.ts`
Expected: FAIL with module-not-found for `./client`.

- [ ] **Step 3: Install the runtime and initialise the CLI project.**

Run: `npm install @supabase/supabase-js && npx supabase init`

Set `project_id = "xvivhukirpekjdcuxoss"` in `supabase/config.toml`. Add only these lines to `.env.example`:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

- [ ] **Step 4: Implement the validated client.**

```ts
import { createClient } from "@supabase/supabase-js";

export function requireSupabaseEnv() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url) throw new Error("VITE_SUPABASE_URL não foi configurada.");
  if (!publishableKey) throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY não foi configurada.");
  return { url, publishableKey };
}

const env = requireSupabaseEnv();
export const supabase = createClient(env.url, env.publishableKey);
```

- [ ] **Step 5: Re-run the test and typecheck.**

Run: `npm test -- src/data/supabase/client.test.ts && npm run typecheck`
Expected: PASS. Task 6 generates `database.types.ts` from the completed remote schema and then supplies it as the client generic.

- [ ] **Step 6: Commit the setup.**

```bash
git add package.json package-lock.json .env.example supabase/config.toml src/data/supabase/client.ts src/data/supabase/client.test.ts
git commit -m "chore: initialise Supabase client"
```

### Task 2: Create core relational schema and catalog seed

**Files:**
- Create: `supabase/migrations/<timestamp>_create_core_schema.sql`
- Create: `supabase/tests/core_schema.test.sql`

**Interfaces:**
- Produces enum types `transaction_kind`, `proposal_status`; tables listed in the F2 design; all relational foreign keys.
- Produces the Admin and Comercial roles and the initial service, event-type, category and pipeline catalog.

- [ ] **Step 1: Write failing pgTAP assertions for essential columns and seed roles.**

```sql
begin;
select plan(6);
select has_table('public', 'events');
select has_table('public', 'transactions');
select col_is_pk('public', 'profiles', 'user_id');
select col_type_is('public', 'events', 'event_date', 'date');
select results_eq(
  $$select name from public.roles order by name$$,
  $$values ('Admin'::text), ('Comercial'::text)$$,
  'seeds the two application roles'
);
select * from finish();
rollback;
```

- [ ] **Step 2: Run the database test before the migration.**

Run: `supabase test db --file supabase/tests/core_schema.test.sql`
Expected: FAIL because the tables do not exist.

- [ ] **Step 3: Write the schema migration.**

Create types and tables with `uuid primary key default gen_random_uuid()` except `profiles(user_id uuid primary key references auth.users(id))`. Include the exact foreign keys from the design and timestamps. Create `roles`, then `profiles`, catalogs, core tables and CRM tables. Seed deterministic catalog rows using `insert ... on conflict (name) do nothing`.

Use constraints such as:

```sql
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  event_type_id uuid not null references public.event_types(id),
  event_date date not null,
  event_time time,
  contact_id uuid references public.contacts(id),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  canceled boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
```

Add B-tree indexes for every FK used by joins and date/filter indexes for `events(event_date)`, `transactions(date)`, `event_services(event_id, created_at)`, `contacts(stage_id)`, `proposals(contact_id)` and `activities(contact_id, due_date)`.

- [ ] **Step 4: Apply the migration locally and run the pgTAP test.**

Run: `supabase db reset && supabase test db --file supabase/tests/core_schema.test.sql`
Expected: PASS.

- [ ] **Step 5: Commit the schema.**

```bash
git add supabase/migrations/*_create_core_schema.sql supabase/tests/core_schema.test.sql
git commit -m "feat: add Allegra core database schema"
```

### Task 3: Enforce database-only invariants and audit trail

**Files:**
- Create: `supabase/migrations/<timestamp>_add_integrity_rules.sql`
- Create: `supabase/tests/integrity_rules.test.sql`

**Interfaces:**
- Produces trigger functions `set_created_by()`, `assert_transaction_category_kind()`, `assert_service_variant()`, and `soft_delete_transaction()`.
- Produces a partial unique index for one converted event per contact and non-annulled transaction filtering.

- [ ] **Step 1: Write failing integrity tests.**

```sql
begin;
select plan(5);
select throws_ok(
  $$insert into public.transactions(kind, amount_cents, date, category_id) values ('in', 0, current_date, '00000000-0000-0000-0000-000000000000')$$,
  '23514', null, 'rejects zero transaction amount'
);
select has_index('public', 'events', 'events_one_contact_idx');
select has_column('public', 'transactions', 'deleted_at');
select has_column('public', 'transactions', 'deleted_by');
select * from finish();
rollback;
```

- [ ] **Step 2: Run the tests and confirm the expected missing-rule failures.**

Run: `supabase test db --file supabase/tests/integrity_rules.test.sql`
Expected: FAIL due to absent audit columns/index/trigger protections.

- [ ] **Step 3: Implement invariants in one migration.**

Add `deleted_at timestamptz`, `deleted_by uuid references public.profiles(user_id)` to `transactions`. Implement each trigger function as `security definer set search_path = public, auth`, with `created_by := auth.uid()` on insert for `contacts`, `activities` and `transactions`. Reject an unauthenticated insert rather than accepting a client-supplied fallback id. Add check constraints for all non-negative monetary fields and indexes:

```sql
create unique index events_one_contact_idx
  on public.events(contact_id) where contact_id is not null;
create index transactions_live_date_idx
  on public.transactions(date desc) where deleted_at is null;
```

For transaction removal, revoke physical `delete` from `authenticated`; expose `void_transaction(p_transaction_id uuid)` RPC which stamps `deleted_at = now(), deleted_by = auth.uid()` and returns the updated id.

- [ ] **Step 4: Reset local database and run all integrity tests.**

Run: `supabase db reset && supabase test db --file supabase/tests/integrity_rules.test.sql`
Expected: PASS.

- [ ] **Step 5: Commit the integrity rules.**

```bash
git add supabase/migrations/*_add_integrity_rules.sql supabase/tests/integrity_rules.test.sql
git commit -m "feat: enforce Allegra data integrity rules"
```

### Task 4: Add RLS policies and privileged database workflows

**Files:**
- Create: `supabase/migrations/<timestamp>_add_rls_and_rpcs.sql`
- Create: `supabase/tests/rls_and_rpcs.test.sql`

**Interfaces:**
- Produces `has_perm(permission text) returns boolean`, `create_proposal_with_items`, `convert_lead`, `reorder_stages`, and `void_transaction` RPCs.
- Consumes authenticated `auth.uid()` and profile/role records.

- [ ] **Step 1: Write failing RLS and RPC tests with Admin and Comercial fixtures.**

```sql
select plan(4);
select ok(public.has_function_privilege('authenticated', 'public.convert_lead(uuid,uuid,text,date,time)', 'execute'));
select throws_ok(
  $$set local role authenticated; select * from public.v_cash_position$$,
  '42501', null, 'Comercial cannot read cash view'
);
select lives_ok(
  $$set local role authenticated; select id, price_cents from public.event_services limit 1$$,
  'Comercial can read contracted service prices'
);
select has_policy('public', 'transactions', 'finance can manage transactions');
```

- [ ] **Step 2: Run tests and verify that policy/function assertions fail.**

Run: `supabase test db --file supabase/tests/rls_and_rpcs.test.sql`
Expected: FAIL because policies and RPCs do not yet exist.

- [ ] **Step 3: Implement authorization and atomic functions.**

Enable RLS on every public table. `has_perm` must be `security definer`, declare `set search_path = public`, and use a single `exists` query from profile through role. Add policies exactly following the design matrix, including authenticated `select` on `events` and `event_services`, but finance-only policies on `transactions` and finance views.

Implement `convert_lead(p_contact_id uuid, p_proposal_id uuid, p_event_name text, p_event_date date, p_event_time time)` in PL/pgSQL with `for update` locks, ownership/accepted/no-existing-event checks, a single event insert, `insert ... select` item copy and `return v_event_id`. Implement `create_proposal_with_items` with a JSONB item array and `reorder_stages(p_ordered_ids uuid[])` using a temporary negative position pass before final positions to avoid unique collisions.

- [ ] **Step 4: Run RLS/RPC tests and inspect migration lint.**

Run: `supabase db reset && supabase test db --file supabase/tests/rls_and_rpcs.test.sql && supabase db lint`
Expected: PASS with no security-definer search-path warnings.

- [ ] **Step 5: Commit the security layer.**

```bash
git add supabase/migrations/*_add_rls_and_rpcs.sql supabase/tests/rls_and_rpcs.test.sql
git commit -m "feat: secure Allegra data with RLS and RPCs"
```

### Task 5: Add financial views and prove them against the TypeScript oracle

**Files:**
- Create: `supabase/migrations/<timestamp>_add_financial_views.sql`
- Create: `supabase/tests/financial_views.test.sql`
- Modify: `src/domain/calc.test.ts`

**Interfaces:**
- Produces `v_event_financials`, `v_cash_position`, `v_monthly_flow`, `v_service_sales`, `v_category_expenses` with `security_invoker = true`.
- `v_service_sales.closed_at` is `event_services.created_at`.

- [ ] **Step 1: Add a failing shared scenario assertion.**

```ts
test("service sales use an item's close timestamp", () => {
  const rows = serviceSalesRows(events, eventServices);
  expect(rows[0]).toMatchObject({ soldAt: "2026-08-18T10:00:00.000Z" });
});
```

Add the matching pgTAP assertion that `v_service_sales.closed_at` equals the item `created_at`, while an event date in another month does not affect the result.

- [ ] **Step 2: Run both tests and confirm failures.**

Run: `npm test -- src/domain/calc.test.ts && supabase test db --file supabase/tests/financial_views.test.sql`
Expected: the new TS test or SQL view test fails because no `closed_at` view contract exists.

- [ ] **Step 3: Implement views over non-annulled transactions.**

Use `create or replace view public.v_event_financials with (security_invoker = true) as ...`. Calculate contract from event services minus discount, received/cost only from `transactions.deleted_at is null`, and receivable with `greatest(contract - received, 0)` except zero for cancelled events. Create monthly flow with `date_trunc('month', date)`, and service rows with `event_services.created_at as closed_at`.

- [ ] **Step 4: Verify oracle scenarios and view access.**

Run: `supabase db reset && supabase test db --file supabase/tests/financial_views.test.sql && npm test -- src/domain/calc.test.ts`
Expected: PASS; a Comercial role remains denied on every finance view.

- [ ] **Step 5: Commit views and tests.**

```bash
git add supabase/migrations/*_add_financial_views.sql supabase/tests/financial_views.test.sql src/domain/calc.test.ts
git commit -m "feat: add audited financial views"
```

### Task 6: Generate types and isolate row/error conversions

**Files:**
- Create: `src/data/supabase/database.types.ts`
- Create: `src/data/supabase/rows.ts`
- Create: `src/data/supabase/rows.test.ts`
- Create: `src/data/supabase/errors.ts`
- Create: `src/data/supabase/errors.test.ts`

**Interfaces:**
- Produces `toEvento`, `toEventService`, `toTransaction`, `toContact`, `toProposal`, `toActivity`, `toProfile`, and reverse insert/update payload builders.
- Produces `toUserMessage(error: { code?: string; message: string }): string`.

- [ ] **Step 1: Write failing mapping and error tests.**

```ts
test("maps a database event into the UI domain", () => {
  expect(toEvento({ event_date: "2026-10-10", event_time: null, discount_cents: 2500 })).toMatchObject({
    eventDate: "2026-10-10", eventTime: null, discountCents: 2500,
  });
});

test("turns RLS denial into a Portuguese message", () => {
  expect(toUserMessage({ code: "42501", message: "permission denied" })).toBe("Você não tem permissão para esta ação.");
});
```

- [ ] **Step 2: Run tests and verify missing-export failures.**

Run: `npm test -- src/data/supabase/rows.test.ts src/data/supabase/errors.test.ts`
Expected: FAIL because converters are absent.

- [ ] **Step 3: Generate types and implement converters.**

Run: `supabase gen types typescript --project-id xvivhukirpekjdcuxoss --schema public > src/data/supabase/database.types.ts`

Map every selected row explicitly; do not cast raw database rows to domain objects. Handle `null` exactly for optional dates, notes, variants and event links. Map `23505`, `23514`, `42501`, and PostgREST relationship errors to stable Portuguese messages while retaining unexpected errors for console diagnostics.

- [ ] **Step 4: Re-run mapping/error tests and typecheck.**

Run: `npm test -- src/data/supabase/rows.test.ts src/data/supabase/errors.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit the client boundary.**

```bash
git add src/data/supabase
git commit -m "feat: add typed Supabase data mappers"
```

### Task 7: Replace authentication and profile access

**Files:**
- Modify: `src/data/auth.tsx`
- Modify: `src/pages/login.tsx`
- Modify: `src/data/hooks/use-access.ts`
- Create: `src/data/auth.supabase.test.tsx`

**Interfaces:**
- Preserves `useAuth`, `usePerms`, `defaultRouteFor`, `RequirePerm`.
- Changes `loginAs(profileId)` to `signInWithPassword({ email, password })` and adds `requestPasswordReset(email)`.

- [ ] **Step 1: Write failing AuthProvider tests.**

```tsx
test("loads the signed-in profile role before opening protected routes", async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  expect(await screen.findByText("Admin")).toBeVisible();
});

test("sends password-reset email through Supabase Auth", async () => {
  await requestPasswordReset("ana@allegra.com.br");
  expect(authResetPasswordForEmail).toHaveBeenCalledWith("ana@allegra.com.br", expect.any(Object));
});
```

- [ ] **Step 2: Run the Auth test and verify it fails against fake local storage behavior.**

Run: `npm test -- src/data/auth.supabase.test.tsx`
Expected: FAIL because the provider does not subscribe to Supabase session/auth APIs.

- [ ] **Step 3: Implement real session flow.**

Subscribe once with `supabase.auth.onAuthStateChange`; on session presence query `profiles` joined to `roles` for `session.user.id`, rejecting inactive/missing profiles. `logout` calls `supabase.auth.signOut()`. Replace mock login buttons and demo reset with email/password fields and a reset-password action. `useCreateProfile` invokes `invite-user` rather than minting a local UUID.

- [ ] **Step 4: Run Auth tests, relevant UI tests and typecheck.**

Run: `npm test -- src/data/auth.supabase.test.tsx src/data/auth.test.tsx src/pages/login.tsx && npm run typecheck`
Expected: PASS with no reads from `allegra-session`.

- [ ] **Step 5: Commit the auth swap.**

```bash
git add src/data/auth.tsx src/data/hooks/use-access.ts src/pages/login.tsx src/data/auth.supabase.test.tsx
git commit -m "feat: use Supabase Auth and profiles"
```

### Task 8: Swap settings, team, events and transactions hooks

**Files:**
- Modify: `src/data/hooks/use-settings.ts`
- Modify: `src/data/hooks/use-team.ts`
- Modify: `src/data/hooks/use-events.ts`
- Modify: `src/data/hooks/use-transactions.ts`
- Create: `src/data/hooks/supabase-resources.test.tsx`

**Interfaces:**
- Preserves every exported hook name and existing mutation input/output shapes.
- `useRemoveTransaction` calls `rpc("void_transaction", { p_transaction_id: id })`; no client-side delete exists.

- [ ] **Step 1: Write failing hook behavior tests.**

```ts
test("removes a transaction by invoking its audited RPC", async () => {
  const { result } = renderHook(() => useRemoveTransaction(), { wrapper });
  await result.current.mutateAsync("tx-1");
  expect(rpc).toHaveBeenCalledWith("void_transaction", { p_transaction_id: "tx-1" });
});

test("filters transactions server-side by event id", async () => {
  renderHook(() => useEventTransactions("event-1"), { wrapper });
  expect(from).toHaveBeenCalledWith("transactions");
});
```

- [ ] **Step 2: Run tests and confirm they fail because hooks still call `crud`.**

Run: `npm test -- src/data/hooks/supabase-resources.test.tsx`
Expected: FAIL showing mock-store calls.

- [ ] **Step 3: Implement direct typed queries/mutations.**

Use `supabase.from(table).select(...)` with relationship selects and map results through Task 6 converters. Preserve query keys and invalidate the same resource families after every mutation. Pass query filters into PostgREST (`eq`, `is`, `gte`, `lt`, `order`) rather than fetching all records then filtering in JavaScript. For event financials, query `v_event_financials` by event id; for transactions, select only `deleted_at is null` rows.

- [ ] **Step 4: Run hook, page, type and build tests.**

Run: `npm test -- src/data/hooks/supabase-resources.test.tsx src/pages/eventos src/pages/financeiro src/pages/configuracoes src/pages/equipe.test.tsx && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit resource hooks.**

```bash
git add src/data/hooks/use-settings.ts src/data/hooks/use-team.ts src/data/hooks/use-events.ts src/data/hooks/use-transactions.ts src/data/hooks/supabase-resources.test.tsx
git commit -m "feat: persist core resources in Supabase"
```

### Task 9: Swap CRM and dashboard to RPCs/views

**Files:**
- Modify: `src/data/hooks/use-crm.ts`
- Modify: `src/data/hooks/use-dashboard.ts`
- Create: `src/data/hooks/supabase-crm-dashboard.test.tsx`

**Interfaces:**
- Preserves `useConvertLead`, `useReorderStages`, proposal/contact/activity hooks and `useDashboard` result shape.
- `useConvertLead` calls `convert_lead`; proposal creation calls `create_proposal_with_items`; stage reorder calls `reorder_stages`.

- [ ] **Step 1: Write failing RPC/view hook tests.**

```ts
test("converts a lead through the atomic database RPC", async () => {
  const { result } = renderHook(() => useConvertLead(), { wrapper });
  await result.current.mutateAsync({ contactId: "c1", proposalId: "p1", eventName: "Evento", eventDate: "2026-10-10", eventTime: null });
  expect(rpc).toHaveBeenCalledWith("convert_lead", expect.objectContaining({ p_contact_id: "c1", p_proposal_id: "p1" }));
});

test("loads service sales from the close-date view", async () => {
  renderHook(() => useDashboard("thisYear"), { wrapper });
  expect(from).toHaveBeenCalledWith("v_service_sales");
});
```

- [ ] **Step 2: Run tests and verify old store/calculation paths fail assertions.**

Run: `npm test -- src/data/hooks/supabase-crm-dashboard.test.tsx`
Expected: FAIL because neither hook calls Supabase RPC/view sources.

- [ ] **Step 3: Implement CRM and dashboard adapters.**

Map CRM reads to constrained queries. Route multi-row proposal creation, lead conversion and reorder exclusively through their named RPCs. For dashboard, query views with the current period range; group `v_service_sales` by service in the client only after filtering `closed_at` server-side. Retain `src/domain/calc.ts` for its unit-test oracle, not production dashboard aggregation.

- [ ] **Step 4: Run tests and the full application quality gate.**

Run: `npm test -- src/data/hooks/supabase-crm-dashboard.test.tsx src/pages/crm src/pages/dashboard && npm run typecheck && npm test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit CRM/dashboard migration.**

```bash
git add src/data/hooks/use-crm.ts src/data/hooks/use-dashboard.ts src/data/hooks/supabase-crm-dashboard.test.tsx
git commit -m "feat: use Supabase RPCs and dashboard views"
```

### Task 10: Implement and test the invitation Edge Function

**Files:**
- Create: `supabase/functions/invite-user/index.ts`
- Create: `supabase/functions/invite-user/index.test.ts`
- Create: `supabase/migrations/<timestamp>_grant_invite_function_access.sql`

**Interfaces:**
- `POST /functions/v1/invite-user` accepts `{ email: string, name: string, roleId: string }` and returns `{ userId: string }`.
- Requires the caller to have `manage_settings`; service-role access remains server-only.

- [ ] **Step 1: Read the Edge Function preflight instructions before any function code.**

Run: `sed -n '1,260p' /Users/edumatheus/.agents/skills/supabase-edge-preflight/SKILL.md`

- [ ] **Step 2: Write a failing authorization test.**

```ts
Deno.test("rejects a caller without manage_settings", async () => {
  const response = await handler(requestForCommercialUser);
  assertEquals(response.status, 403);
  assertEquals(await response.json(), { error: "Você não tem permissão para convidar usuárias." });
});
```

- [ ] **Step 3: Run the test and verify it fails because the handler is absent.**

Run: `deno test --allow-env --allow-net supabase/functions/invite-user/index.test.ts`
Expected: FAIL with missing handler/module.

- [ ] **Step 4: Implement the function.**

Create request-scoped clients: one from the caller Authorization header for identity and permission check, one service-role Admin client only inside the function. Validate email/name/role id, verify the role exists, call `auth.admin.inviteUserByEmail`, then insert the corresponding profile. If invitation has already created a user, return a conflict message; never report whether arbitrary emails exist to unauthorized callers. Configure `SUPABASE_SERVICE_ROLE_KEY` only as an Edge Function secret.

- [ ] **Step 5: Run tests, serve locally and deploy.**

Run: `deno test --allow-env --allow-net supabase/functions/invite-user/index.test.ts && supabase functions serve invite-user --no-verify-jwt`

Expected: test PASS; manual authenticated Admin request returns a user id and a Commercial request returns 403. Deploy using `supabase functions deploy invite-user` after local validation.

- [ ] **Step 6: Commit function source and migration.**

```bash
git add supabase/functions/invite-user supabase/migrations/*_grant_invite_function_access.sql
git commit -m "feat: add secure user invitation function"
```

### Task 11: Apply remote migrations, provision first admin, and verify production access

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/validation/f2-production-checklist.md`

**Interfaces:**
- Documents deployment order and a repeatable administrator bootstrap procedure without storing credentials.

- [ ] **Step 1: Write the failing checklist acceptance criteria.**

```markdown
- [ ] Remote migration history equals local migration history.
- [ ] An Admin can sign in and create an event, an event item, and a transaction.
- [ ] A Comercial can sign in, create a lead/proposal, and read event item prices.
- [ ] A Comercial receives permission denial for Financeiro and direct financial-view reads.
```

- [ ] **Step 2: Add precise deployment instructions.**

Document `supabase link --project-ref xvivhukirpekjdcuxoss`, `supabase db push`, `supabase gen types`, Edge Function secret configuration, `supabase functions deploy invite-user`, Vercel variables, and a one-time first-admin bootstrap performed through Supabase Auth plus a single profile insert by an authorized database owner. State that secrets are entered in the Supabase/Vercel dashboards, never committed.

- [ ] **Step 3: Apply the migrations to the configured remote project.**

Run: `supabase link --project-ref xvivhukirpekjdcuxoss && supabase db push`

Expected: remote migration history includes every local F2 migration without drift.

- [ ] **Step 4: Execute production smoke verification.**

Run the checklist as Admin and Commercial via the deployed app and direct authenticated SQL/PostgREST requests. Record pass/fail and the project migration version in `f2-production-checklist.md`.

- [ ] **Step 5: Run final local quality gates and commit operational docs.**

Run: `npm run typecheck && npm test && npm run build && supabase test db`
Expected: all commands PASS.

```bash
git add README.md docs/superpowers/validation/f2-production-checklist.md src/data/supabase/database.types.ts
git commit -m "docs: document Supabase production rollout"
```

## Plan Self-Review

- **Spec coverage:** Tasks 2–5 cover schema, integrity, RLS, financial views, RPCs, seed and the close-date decision. Tasks 6–9 cover the typed client, hooks, auth and UI-preserving data swap. Task 10 covers invitations. Task 11 covers deployment, bootstrap and production verification.
- **Placeholder scan:** the plan contains no deferred requirements; migration timestamps are intentionally generated by `supabase migration new` at execution time and every migration purpose/name is fixed.
- **Type consistency:** database inputs use `p_` RPC parameters; frontend types remain the existing camelCase domain shapes; conversion functions are the only snake_case boundary.
