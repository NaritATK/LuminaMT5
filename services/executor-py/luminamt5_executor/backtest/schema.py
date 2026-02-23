from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

DEFAULT_SYMBOLS = ["XAUUSD", "BTCUSD"]


class BacktestConfig(BaseModel):
    """Config schema for a single 30-day M5 CSV backtest run."""

    name: str = Field(default="m5-30d-baseline", min_length=3)
    symbol: str = Field(default="XAUUSD", description="Trading symbol")
    timeframe: Literal["M5"] = "M5"
    days: int = Field(default=30, ge=30, le=30)

    initial_balance: float = Field(default=10_000, gt=0)
    risk_per_trade_pct: float = Field(default=0.5, gt=0, le=5)
    spread_points: float = Field(default=10, ge=0)
    slippage_points: float = Field(default=5, ge=0)

    start: datetime | None = None
    end: datetime | None = None

    data_source: Literal["csv"] = "csv"
    csv_path: Path
    output_dir: Path = Field(default=Path("artifacts/backtests"))

    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in DEFAULT_SYMBOLS:
            raise ValueError(f"symbol must be one of {DEFAULT_SYMBOLS}")
        return normalized

    @model_validator(mode="after")
    def derive_window_if_missing(self) -> "BacktestConfig":
        if self.end is None:
            self.end = datetime.now(UTC)
        if self.start is None:
            self.start = self.end - timedelta(days=self.days)

        if self.start >= self.end:
            raise ValueError("start must be earlier than end")

        actual_days = (self.end - self.start).total_seconds() / 86400
        if actual_days < 29.9 or actual_days > 30.1:
            raise ValueError("backtest window must be ~30 days")

        return self
