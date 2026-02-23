# Dashboard (Next.js)

Minimal operator UI scaffold for LuminaMT5.

## Routes

- `/overview` — overview placeholder
- `/risk` — risk placeholder
- `/commands-audit` — command audit placeholder

## API client stubs

`lib/api/client.ts` provides lightweight methods:

- `getOverview()`
- `getRisk()`
- `getCommandsAudit()`

By default, stubs are used. Set env to call backend APIs:

- `NEXT_PUBLIC_USE_STUB_DATA=false`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`

## Run

```bash
npm --workspace @luminamt5/dashboard run dev
```
