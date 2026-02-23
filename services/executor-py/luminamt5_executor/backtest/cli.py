from __future__ import annotations

import argparse
import json
from pathlib import Path

from .schema import BacktestConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="luminamt5-backtest",
        description="Scaffold CLI for 30-day M5 backtests (XAUUSD/BTCUSD).",
    )
    parser.add_argument("--config", type=Path, help="Path to JSON config file")
    parser.add_argument("--symbol", choices=["XAUUSD", "BTCUSD"], help="Override symbol")
    parser.add_argument("--name", help="Run name")
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

    print("[backtest] scaffold ready")
    print(f"  symbol: {cfg.symbol}")
    print(f"  timeframe: {cfg.timeframe}")
    print(f"  window: {cfg.start.isoformat()} -> {cfg.end.isoformat()}")
    print(f"  output: {run_dir}")
    print("  note: execution engine is placeholder only")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
