# API (Fastify)

Planned modules:
- auth
- accounts
- strategies
- commands
- risk
- execution
- telemetry

Status: scaffold

## Auth + RBAC foundation

Protected routes (currently `POST /v1/commands`) require one of:

- `x-api-key: <secret>`
- `Authorization: Bearer <token>`

Credentials are configured by env (comma-separated `secret:role`):

- `AUTH_API_KEYS`
- `AUTH_BEARER_TOKENS`

Roles:

- `viewer`
- `operator`
- `admin`

RBAC defaults:

- `/v1/commands` requires at least `operator`
- `/v1/executor/lifecycle` requires at least `operator`
- `panic` command requires `admin`

Production safety default:

- if `NODE_ENV=production` and no auth credentials are configured, API fails fast at startup.
- if `TELEGRAM_WEBHOOK_REQUIRE_SECRET=true` and `TELEGRAM_WEBHOOK_SECRET` is missing, API fails fast at startup.

## Telegram webhook ingress

Endpoint: `POST /v1/ingress/telegram/webhook`

Hardening behaviors:

- Verifies `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET`
- Uses timing-safe comparison for secret verification
- Rejects malformed webhook payloads and unsupported/invalid commands
- Returns safe, minimal responses (no full audit payload or raw command echo)
- Persists accepted/blocked command decisions to DB and enqueues accepted commands

Supported commands:

- `/status [accountId]`
- `/open <symbol> <buy|sell> <size> [sl] [tp]`
- `/open <symbol> <buy|sell> <size> sl=<value> tp=<value>`
- `/close <symbol> [accountId]`
- `/panic`
