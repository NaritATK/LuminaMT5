# Executor Worker (Python + MT5)

## Quick start

```bash
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
- `DRY_RUN=true|false`

> Phase 1 runs in dry-run by default.

## Backtest scaffold (30-day M5)

```bash
# print schema
python -m luminamt5_executor.backtest.cli --print-schema

# run scaffold using sample config
python -m luminamt5_executor.backtest.cli --config backtest.example.json

# quick BTCUSD override
python -m luminamt5_executor.backtest.cli --symbol BTCUSD --name btcusd-m5-30d-smoke
```

See `../../docs/backtest-30d-scaffold.md` for details.
