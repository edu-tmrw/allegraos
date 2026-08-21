# Task 6 report — typed Supabase data boundary

## Status

Completed locally from base `ff8ce860d39969a434013c3fecc89e74934cd30f`.

## Delivered

- Generated `src/data/supabase/database.types.ts` from the fully migrated local `public` schema with `supabase gen types typescript --local --schema public`.
- Typed the lazy shared browser client as `SupabaseClient<Database>` while preserving both public APIs: `supabase` and `getSupabase`.
- Added explicit database-row → domain converters for roles, profiles, event types, services, service variants, transaction categories, pipeline stages, events, event services, transactions, team members, contacts, proposals, proposal services and activities.
- Added explicit insert/update builders for the same resources. Builders omit generated/audit columns and preserve `null`, integer cents, date/time strings and timestamps without destructive conversion.
- Added stable Portuguese mappings for `23505`, `23514`, `42501`, `PGRST116`, `PGRST200` and `PGRST201`. Unexpected errors return a safe generic user message and retain the original error in console diagnostics.
- Extended the lazy-client tests to cover a missing publishable key and deferred configuration validation.

## Schema compatibility migration

Added and applied `20260821150000_make_created_by_client_omittable.sql` locally. The authenticated client is not granted permission to send `created_by`, and the existing triggers authoritatively replace it with `auth.uid()`. PostgreSQL type generation nevertheless considered the column required because it had no declared default. The migration adds `default auth.uid()` to `contacts.created_by`, `activities.created_by` and `transactions.created_by`, while retaining the anti-spoofing triggers. This makes the generated insert contracts match the actual permitted client payload without casts or privilege relaxation.

## TDD evidence

The initial focused run failed because `rows.ts` and `errors.ts` did not exist. After implementation:

- `npm test -- src/data/supabase/rows.test.ts src/data/supabase/errors.test.ts src/data/supabase/client.test.ts`: 3 files, 27 tests passed.
- Mapping tests cover every exported converter and insert/update builder, including nullable dates, notes, variants and event links.
- Error tests cover every required known branch plus safe fallback diagnostics.

## Verification

- `supabase db reset`: all five local migrations applied successfully.
- `supabase test db`: 4 files, 186 tests passed.
- `supabase db lint`: no schema errors.
- Fresh local type generation compared with the checked-in file: exact match, 843/843 lines.
- `npm run typecheck`: passed.
- `npm test`: 28 files, 220 tests passed.
- `npm run build`: passed (Vite production build).
- `git diff --check`: passed.

## Final remote gate

The Supabase MCP plugin was not callable in this task, so local schema generation was used as explicitly ruled. Before production rollout, generate types from project `xvivhukirpekjdcuxoss` through the Supabase MCP/remote schema, compare them with `src/data/supabase/database.types.ts`, replace the file if any drift exists, and rerun typecheck, tests and build. This is the remaining deployment gate; no local schema/type drift was found.

## Preserved workspace files

The pre-existing untracked `.claude/` directory and `supabase/.gitignore` were not modified or staged.
