# Executor Worker (Python + MT5)

## Quick start

```bash
cd services/executor-py
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m luminamt5_executor.worker
```

## Environment

- `REDIS_URL`
- `COMMAND_QUEUE_KEY` (default: `luminamt5:commands`)
- `API_BASE`
- `ACCOUNT_ID`
- `DRY_RUN=true|false` (default: `true`)
- `IDEMPOTENCY_PREFIX` (default: `luminamt5:executor:idempotency`)
- `IDEMPOTENCY_PROCESSING_TTL_SEC` (default: `120`)
- `IDEMPOTENCY_COMPLETED_TTL_SEC` (default: `604800`)

### Optional live MT5 wiring (when `DRY_RUN=false`)

- `MT5_LOGIN`
- `MT5_PASSWORD`
- `MT5_SERVER`
- `MT5_TERMINAL_PATH`

## Command contract notes

The worker now parses commands into structured models (`status`, `panic`, `open`) and computes idempotency keys using:

1. `idempotencyKey` (preferred)
2. `commandId`
3. SHA256 hash of raw payload (fallback)

This allows safe requeue/retry behavior while keeping phase-1 dry-run as the default.
