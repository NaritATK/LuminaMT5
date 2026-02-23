from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path


@dataclass(frozen=True)
class Candle:
    ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


def _parse_ts(raw: str) -> datetime:
    value = raw.strip()
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def load_ohlcv_csv(path: Path) -> list[Candle]:
    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {path}")

    with path.open("r", newline="") as fh:
        reader = csv.DictReader(fh)
        required = {"timestamp", "open", "high", "low", "close", "volume"}
        if reader.fieldnames is None:
            raise ValueError("CSV must include a header row")

        got = {name.strip().lower() for name in reader.fieldnames}
        missing = required - got
        if missing:
            raise ValueError(f"CSV missing required columns: {sorted(missing)}")

        rows: list[Candle] = []
        for row in reader:
            rows.append(
                Candle(
                    ts=_parse_ts(row["timestamp"]),
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=float(row["volume"]),
                )
            )

    rows.sort(key=lambda r: r.ts)
    return rows
