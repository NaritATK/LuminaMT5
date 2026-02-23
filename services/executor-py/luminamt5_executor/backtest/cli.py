from __future__ import annotations

import argparse
import json
from pathlib import Path

from .data import load_ohlcv_csv
from .engine import run_baseline_backtest
from .schema import BacktestConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="luminamt5-backtest",
        description="Runnable minimal 30-day M5 backtests (XAUUSD/BTCUSD) from CSV OHLCV.",
    )
    parser.add_argument("--config", type=Path, help="Path to JSON config file")
    parser.add_argument("--symbol", choices=["XAUUSD", "BTCUSD"], help="Override symbol")
    parser.add_argument("--name", help="Run name")
    parser.add_argument("--csv-path", type=Path, help="Path to CSV OHLCV input")
    parser.add_argument("--output-dir", type=Path, help="Artifacts directory")
    parser.add_argument(
        "--print-schema",
        action="store_true",
        help="Print JSON schema for BacktestConfig and exit",
    )
    return parser.parse_args()


def load_config(args: argparse.Namespace) -> BacktestConfig:
    payload: dict = {}

    if args.config:
        payload = json.loads(args.config.read_text())

    if args.symbol:
        payload["symbol"] = args.symbol
    if args.name:
        payload["name"] = args.name
    if args.csv_path:
        payload["csv_path"] = str(args.csv_path)
    if args.output_dir:
        payload["output_dir"] = str(args.output_dir)

    return BacktestConfig(**payload)


def main() -> int:
    args = parse_args()

    if args.print_schema:
        print(json.dumps(BacktestConfig.model_json_schema(), indent=2, default=str))
        return 0

    cfg = load_config(args)
    run_dir = cfg.output_dir / cfg.symbol / cfg.name
    run_dir.mkdir(parents=True, exist_ok=True)

    resolved = run_dir / "resolved-config.json"
    resolved.write_text(cfg.model_dump_json(indent=2))

    candles = load_ohlcv_csv(cfg.csv_path)
    result = run_baseline_backtest(cfg, candles)

    metrics_path = run_dir / "metrics.json"
    metrics_path.write_text(json.dumps(result.metrics, indent=2))

    trades_path = run_dir / "trades.json"
    trades_payload = [
        {
            "entry_ts": t.entry_ts.isoformat(),
            "exit_ts": t.exit_ts.isoformat(),
            "side": t.side,
            "entry_price": t.entry_price,
            "exit_price": t.exit_price,
            "units": t.units,
            "pnl": t.pnl,
        }
        for t in result.trades
    ]
    trades_path.write_text(json.dumps(trades_payload, indent=2))

    print("[backtest] completed")
    print(f"  symbol: {cfg.symbol}")
    print(f"  timeframe: {cfg.timeframe}")
    print(f"  window: {cfg.start.isoformat()} -> {cfg.end.isoformat()}")
    print(f"  metrics: {metrics_path}")
    print(f"  trades:  {trades_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
