This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# PIM Frontend

## Async I18n Import API (JSON/CSV)

Endpoints:

- POST `/api/i18n/import/preflight` — validate payload before import
  - Body: `{ format: 'json'|'csv', payload: string }`
  - 200: `{ ok:true, total, namespaces, keys, placeholder_warnings, warnings, invalid_locales, invalid_locale_samples }`
  - Errors: `bad_request` (400), `payload_too_large` (413), `no_items` (400), `too_many_items` (400)
- POST `/api/i18n/import/jobs` — create async job
  - Body: `{ scope: 'global'|'org', orgId?, format: 'json'|'csv', payload, idempotencyKey? }`
  - 200: `{ id }` or `{ id, existing:true, status }`
  - Errors: `unauthorized` (401), `forbidden` (403), `no_org` (400), `no_org_membership` (403), `too_many_jobs` (429), `rate_limited` (429), `payload_too_large` (413), `bad_request` (400)
- GET `/api/i18n/import/jobs?id=...` — job status
- POST `/api/i18n/import/cancel` — mark job as cancelled (queued/running)
- POST `/api/i18n/import/cancel/force` — immediate fail after grace (60s)
- POST `/api/i18n/import/retry` — platform_admin only
- POST `/api/i18n/import/delete` — delete own job (not queued/running)
- GET `/api/i18n/import/jobs/:id/payload` — download original payload
- GET `/api/i18n/import/jobs/:id/logs?format=json|csv` — download logs

Error codes (common):

- `unauthorized`, `forbidden`, `bad_request`, `payload_too_large`, `too_many_items`, `no_org`, `no_org_membership`, `too_many_jobs`, `rate_limited`, `not_deletable`

Notes:

- Locales must exist and be enabled in `system_locales`.
- ICU placeholders validated against base locale `en`.
- Export has ETag + HEAD support: `/api/i18n/export`.

---

## AI contribution guidelines (critical)

Always follow these rules when modifying or adding code. Changes that break these rules will be rejected.

1) RLS and Permissions
- Global writes (ui_namespaces, ui_keys, ui_messages_global, system_locales) — only `platform_admin` (use RPC `is_platform_admin`).
- Org writes (ui_org_locales, ui_messages_overrides) — only org members; respect org_id from membership.
- Jobs: creator can update/cancel/delete; enforce ownership in APIs. Never disable RLS.

2) I18n data invariants
- Locale must exist and be enabled in `system_locales` for any write (messages, overrides, imports).
- ICU placeholders: validate against base `en`; on mismatch either block or require `allowMismatch` confirmation.
- Fallback chain must honor `parent_code`: e.g., `uk-UA → uk → en`.
- On any write that affects catalogs, bump `i18n_catalog_versions` (scope=global or org).

3) Async Import Jobs contract
- Preflight limits: payload ≤ 2MB, items ≤ 10k; return invalid locales and ICU warnings.
- Job creation limits: payload ≤ 1MB, throttle active jobs per user, rate-limit by window.
- Worker must: validate locales (skip invalid), cap items, log to `i18n_import_job_logs`, handle cancel/force cancel, set `progress/total`, write stats, and bump versions.
- Standardize errors in APIs: `unauthorized`, `forbidden`, `bad_request`, `payload_too_large`, `too_many_items`, `rate_limited`, etc.

4) Caching and fetch
- Exports use `ETag` + `HEAD`; clients should prefer `HEAD` for cache checks.
- After bumps, server responses should carry updated `ETag`.
- SSR: avoid relative `fetch` in RSC; in client, use `location.origin` for absolute paths when needed (e.g., missing logger).

5) Next.js/App Router specifics
- When using route props, if `searchParams` is a Promise — `await` it (avoid sync dynamic APIs warnings).
- Do not read `cookies()` synchronously in RSC; use helpers (auth-helpers `createServerComponentClient`) and respect `cookies` boundary.

6) Testing and E2E
- E2E auth: use `global-setup` with password login or `E2E_BYPASS_AUTH=1` (tests only). Do not hardcode tokens.
- Never commit auth state: ignore `tests/e2e/.auth/`.
- Prefer stable selectors (data-testid) and wait for API responses when asserting preflight.

7) Safety and content
- Treat message values as plain text by default; if `is_html` is ever introduced, sanitize strictly.
- Do not create sparse/empty rows massively; rely on missing reports.

8) Env and functions
- Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; server-side `SUPABASE_SERVICE_ROLE_KEY` for Edge Functions.
- Edge Functions should be invoked with appropriate keys (anon for frontend invoke; service for backend triggers/cron).

9) UI/UX contracts (do not break)
- Keep `data-testid="async-import"` container visible on i18n settings page.
- Keep ImportPreflight showing: totals, ICU warnings, invalid locales samples.
- Keep Job actions (Retry/Cancel/Force/Delete) consistent with API behavior; prevent delete for queued/running.

10) Error handling
- APIs must return JSON `{ error: code }` for non-2xx; UIs must map known codes to user-friendly messages.

By following this checklist, future features (incl. PIM core) should integrate without breaking i18n and job system contracts.
