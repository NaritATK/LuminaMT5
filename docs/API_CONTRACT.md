# API Contract v1

## GET /v1/status

Response:
- `200` with API service status, Redis queue depth, and placeholder worker/account state

Example response:

```json
{
  "status": "ok",
  "ts": "2026-02-23T09:30:00.000Z",
  "service": {
    "name": "api",
    "uptimeSec": 123
  },
  "redis": {
    "status": "up",
    "queue": {
      "key": "luminamt5:commands",
      "depth": 2
    },
    "error": null
  },
  "worker": {
    "status": "unknown",
    "lastHeartbeatTs": null
  },
  "accounts": {
    "total": 0,
    "active": 0,
    "states": []
  }
}
```

Notes:
- `status` is `ok` when Redis queue depth can be read; otherwise `degraded`.
- `redis.queue.depth` is `null` when Redis is unavailable.
- `worker` and `accounts` are placeholders for upcoming executor/account telemetry integration.

## POST /v1/commands

Request body:

```json
{
  "type": "open",
  "accountId": "acc-1",
  "symbol": "XAUUSD",
  "side": "buy",
  "size": 0.1,
  "sl": 2010,
  "tp": 2050,
  "actor": "user:telegram:7874483415",
  "channel": "telegram"
}
```

Response:
- `202 accepted` with command envelope
- `403 blocked` when risk gate rejects
- `400` on payload validation errors

## POST /v1/ingress/telegram/webhook

Telegram webhook ingress for slash commands.

Security:
- Verifies `X-Telegram-Bot-Api-Secret-Token` using `TELEGRAM_WEBHOOK_SECRET`
- Timing-safe secret comparison
- Startup fail-fast when `TELEGRAM_WEBHOOK_REQUIRE_SECRET=true` and secret is unset

Behavior:
- `202 ignored` for non-command messages
- `400 invalid_webhook` for malformed Telegram payloads
- `400 invalid_command` for unsupported/invalid slash commands
- `403 blocked` when risk gate rejects
- `202 accepted` when command is accepted and queued

## Lifecycle enums (DB-backed)

To keep order/fill/position processing consistent across API + worker, the persistence layer now enforces these values:

- `commands.type`: `status | open | close | set-risk | pause | resume | panic`
- `commands.decision`: `accepted | blocked | rejected | executed | failed`
- `orders.side`: `buy | sell`
- `orders.status`: `pending | submitted | partially_filled | filled | cancelled | rejected | expired | closed`
- `fills.side` (optional): `buy | sell`
- `positions.side`: `buy | sell`
- `positions.status`: `open | partially_closed | closed`

Numeric lifecycle invariants are also enforced in SQL (positive sizes/prices, close timestamps after open timestamps, and dedupe by `fills.mt5_deal_id`).
