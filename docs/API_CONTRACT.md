# API Contract v1

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
