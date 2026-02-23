# Dashboard (Next.js)

Minimal operator UI scaffold for LuminaMT5.

## Routes

- `/overview` — overview API summary
- `/risk` — risk API summary
- `/commands-audit` — recent command activity API summary

Each route includes:

- loading UI (`loading.tsx`)
- route-level error UI (`error.tsx`)
- graceful fallback to local stub values if API is unavailable

## API client

`lib/api/client.ts` provides lightweight methods:

- `getOverview()`
- `getRisk()`
- `getCommandsAudit()`

Responses include `{ data, meta }`, where `meta.source` is either:

- `api` (live endpoint succeeded)
- `fallback` (stub used due to config or request failure)

## Environment

- `NEXT_PUBLIC_USE_STUB_DATA` (default `true`; set `false` for live API)
- `NEXT_PUBLIC_DASHBOARD_API_BASE_URL` (preferred API base URL)
- `NEXT_PUBLIC_API_BASE_URL` (fallback base URL)
- `NEXT_PUBLIC_DASHBOARD_API_PREFIX` (default `/v1`)
- `NEXT_PUBLIC_DASHBOARD_API_TIMEOUT_MS` (default `5000`)

## Run

```bash
npm --workspace @luminamt5/dashboard run dev
```
