# 30-Day Backtest Scaffold (M5 XAUUSD/BTCUSD)

This scaffold adds a placeholder backtest module under `services/executor-py` to standardize 30-day runs for:

- `XAUUSD`
- `BTCUSD`

> Status: scaffold only. No strategy simulation or MT5 historical execution is wired yet.

## Location

- Schema: `services/executor-py/luminamt5_executor/backtest/schema.py`
- CLI: `services/executor-py/luminamt5_executor/backtest/cli.py`
- Example config: `services/executor-py/backtest.example.json`

## Usage

```bash
cd services/executor-py
python -m luminamt5_executor.backtest.cli --print-schema
python -m luminamt5_executor.backtest.cli --config backtest.example.json
python -m luminamt5_executor.backtest.cli --symbol BTCUSD --name btcusd-m5-30d-smoke
```

## What the scaffold currently does

- Validates config with `pydantic`
- Enforces `M5` timeframe and `30-day` window
- Restricts symbol to `XAUUSD` or `BTCUSD`
- Writes a resolved config artifact to:

`artifacts/backtests/<SYMBOL>/<RUN_NAME>/resolved-config.json`

## Next implementation steps

1. Add historical candle loader (MT5 + CSV fallback)
2. Add strategy hook interface
3. Add order/position simulator (spread/slippage aware)
4. Add summary metrics (PnL, max drawdown, win-rate)
5. Add API endpoint to trigger and query run status
