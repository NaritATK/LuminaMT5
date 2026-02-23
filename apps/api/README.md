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
- `panic` command requires `admin`

Production safety default:

- if `NODE_ENV=production` and no auth credentials are configured, API fails fast at startup.
