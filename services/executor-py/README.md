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
- `API_KEY` or `API_BEARER_TOKEN` (for lifecycle reporting auth)
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

## Backtest (runnable minimal pipeline)

This service includes a minimal, deterministic backtest runner for **30-day M5** tests on:

- `XAUUSD`
- `BTCUSD`

Input is CSV OHLCV with header:

- `timestamp,open,high,low,close,volume`

`timestamp` must be ISO-8601 (`...Z` or timezone-aware string).

> Note: backtest mode runs from CSV only and does not require live MT5 connectivity.

### Run

```bash
cd services/executor-py
source .venv/bin/activate
python -m luminamt5_executor.backtest.cli --config backtest.example.json
```

Or override from CLI:

```bash
python -m luminamt5_executor.backtest.cli \
  --symbol XAUUSD \
  --name xau-smoke \
  --csv-path ./data/XAUUSD_M5.csv
```

### Output

Artifacts are written to:

```text
artifacts/backtests/<SYMBOL>/<RUN_NAME>/
```

Files:

- `resolved-config.json`
- `metrics.json`
- `trades.json`

### Strategy baseline

Deterministic single-position baseline:

- SMA(10) vs SMA(20) crossover on close
- Long when fast > slow, short when fast < slow
- Flip/close on signal change
- Includes configured spread/slippage points

### Metrics JSON

`metrics.json` includes:

- initial/final balance
- net PnL and total return %
- number of trades and win rate %
- profit factor
- max drawdown %
- sharpe-like score

## Command contract notes

The worker parses commands into structured models (`status`, `panic`, `open`) and computes idempotency keys using:

1. `idempotencyKey` (preferred)
2. `commandId`
3. SHA256 hash of raw payload (fallback)

This allows safe requeue/retry behavior while keeping phase-1 dry-run as the default.
