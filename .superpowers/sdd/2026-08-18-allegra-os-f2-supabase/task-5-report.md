# Task 5 — Financial views and close-date oracle

## Status

COMPLETE LOCALLY — REMOTE HANDOFF REQUIRED

## Summary

- Added five financial views with `security_invoker = true`: `v_event_financials`, `v_cash_position`, `v_monthly_flow`, `v_service_sales` and `v_category_expenses`.
- Restricted every view with an explicit `has_perm('manage_finance')` guard, in addition to invoker RLS.
- Calculated event contract as item total minus discount, clamped at zero; canceled and overpaid receivables are clamped to zero; profit remains received minus cost.
- Excluded every transaction with non-null `deleted_at` from event financials, cash, monthly flow and category expenses.
- Made `event_services.created_at` the service-sale close timestamp in both SQL (`closed_at`) and the TypeScript oracle (`soldAt`).
- Preserved server-side period-filter columns: `closed_at` for service sales, `date` for category expenses and `month` for monthly flow.
- Added pgTAP parity/security scenarios for discount, cancellation, overpayment, contract/receivable clamps, annulled transactions and an item close date in a different month from its event.

## Files

- `supabase/migrations/20260821120000_add_financial_views.sql`
- `supabase/tests/financial_views.test.sql`
- `src/domain/calc.ts`
- `src/domain/calc.test.ts`

Preserved and excluded from the commit:

- `.claude/`
- `supabase/.gitignore`

The report itself is intentionally force-added because `.superpowers/` is ignored by the repository.

## TDD evidence

### RED — TypeScript oracle

- Command: `npm test -- src/domain/calc.test.ts`
- Result: exit 1; 4 failures and 25 passes.
- The failures were behavioral and expected:
  - rows still returned `eventDate` instead of `soldAt`;
  - the explicit close timestamp assertion failed;
  - canceled-event output still used the old temporal field;
  - period filtering admitted all rows because it still read `eventDate`.

### RED — pgTAP

- The brief's `--file` flag is not supported by the installed Supabase CLI 2.90.0; the current positional equivalent was used.
- Command: `supabase test db supabase/tests/financial_views.test.sql`
- Result: exit 1; the first five existence checks and the invoker-security catalog check failed, then PostgreSQL aborted on `relation "public.v_event_financials" does not exist`.
- This was the expected missing-production-contract failure before the migration existed.

### GREEN

- `npm test -- src/domain/calc.test.ts`: 29/29 passed.
- `supabase db reset`: exit 0; all four migrations, including `20260821120000_add_financial_views.sql`, applied from a clean local database.
- `supabase test db supabase/tests/financial_views.test.sql`: 23/23 passed.

## View schemas and behavior

| View | Columns | Contract |
|---|---|---|
| `v_event_financials` | `event_id`, `contract_cents`, `received_cents`, `cost_cents`, `profit_cents`, `receivable_cents` | One row per event for finance users; money aggregates are `bigint`. |
| `v_cash_position` | `cash_cents` | One aggregate row for finance users, including event and administrative transactions; zero rows without permission. |
| `v_monthly_flow` | `month`, `revenue_cents`, `expenses_cents`, `profit_cents` | One row per transaction month; `month` is a first-of-month `date`. |
| `v_service_sales` | `event_service_id`, `event_id`, `service_id`, `service_name`, `price_cents`, `closed_at` | One row per item from a non-canceled event; `closed_at` is exactly `event_services.created_at`. |
| `v_category_expenses` | `category_id`, `category_name`, `date`, `total_cents` | Live outgoing transactions aggregated per category and date, retaining a server-filterable date. |

## Security

- Every view has `security_invoker=true` in `pg_class.reloptions`.
- Every view includes an explicit stable `has_perm('manage_finance')` predicate.
- `v_cash_position` repeats the permission guard in `HAVING`, preventing PostgreSQL's aggregate-over-empty-input behavior from returning a row of zeroes to a non-finance user.
- `PUBLIC`, `anon` and `authenticated` privileges are explicitly revoked before granting only `SELECT` to `authenticated`.
- `anon` has no view access.
- A real authenticated Comercial fixture can still read contracted service prices through base-table RLS, but receives zero rows from all five views, including contract-derived event values and cash.
- A real authenticated Admin fixture receives the expected financial results.

## Verification

- `supabase db reset`: PASS; migration applied locally.
- Focused pgTAP: PASS, 23/23.
- Full pgTAP: PASS, 4 files and 186/186 assertions.
- Focused Vitest oracle: PASS, 29/29.
- Full Vitest: PASS, 26 files and 195/195 tests.
- `npm run typecheck`: PASS.
- `supabase db lint`: PASS; `No schema errors found` for `extensions` and `public`.
- `git diff --check`: PASS.

The reset prints the pre-existing warning `no files matched pattern: supabase/seed.sql` because `supabase/config.toml` references a seed path that is absent. Migrations and all tests still complete successfully; Task 5 did not alter seed configuration.

## Remote concern / handoff

- The Supabase plugin/MCP is absent in this task context, so no remote schema change was attempted.
- `20260821120000_add_financial_views.sql` is a provisional local timestamp chosen chronologically after Task 4's `20260820120000_add_rls_and_rpcs.sql`.
- When Supabase MCP access is available, apply this migration verbatim to project `xvivhukirpekjdcuxoss`, inspect the recorded remote migration version, align the local filename if MCP assigns a different version, then rerun local reset and remote catalog/security checks.
- Authentication was not attempted, so no reauthentication request is needed; the blocker is tool/plugin availability, not credentials.
