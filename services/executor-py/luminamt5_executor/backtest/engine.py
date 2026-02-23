from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime

from .data import Candle
from .schema import BacktestConfig

SYMBOL_POINT_SIZE = {
    "XAUUSD": 0.01,
    "BTCUSD": 0.1,
}


@dataclass(frozen=True)
class Trade:
    entry_ts: datetime
    exit_ts: datetime
    side: str
    entry_price: float
    exit_price: float
    units: float
    pnl: float


@dataclass(frozen=True)
class BacktestResult:
    metrics: dict
    trades: list[Trade]


def _sma(values: list[float], n: int) -> float:
    return sum(values[-n:]) / n


def run_baseline_backtest(cfg: BacktestConfig, candles: list[Candle]) -> BacktestResult:
    # Keep only configured window.
    window = [c for c in candles if cfg.start <= c.ts <= cfg.end]
    if len(window) < 50:
        raise ValueError("not enough M5 candles in requested 30-day window (need >= 50)")

    point = SYMBOL_POINT_SIZE[cfg.symbol]
    cost_per_fill = (cfg.spread_points + cfg.slippage_points) * point

    equity = cfg.initial_balance
    peak = equity
    max_drawdown = 0.0
    equity_curve: list[float] = [equity]
    returns: list[float] = []

    close_hist: list[float] = []
    position = 0  # -1 short, 0 flat, +1 long
    entry_price = 0.0
    entry_ts = window[0].ts
    units = 0.0

    trades: list[Trade] = []

    for c in window:
        close_hist.append(c.close)
        if len(close_hist) < 20:
            continue

        fast = _sma(close_hist, 10)
        slow = _sma(close_hist, 20)

        signal = 0
        if fast > slow:
            signal = 1
        elif fast < slow:
            signal = -1

        # Flip/exit on signal change; single-position system.
        if signal != position:
            if position != 0:
                gross = (c.close - entry_price) * units * position
                # exit fill cost + already paid entry fill cost
                pnl = gross - cost_per_fill * units
                equity += pnl
                trades.append(
                    Trade(
                        entry_ts=entry_ts,
                        exit_ts=c.ts,
                        side="buy" if position == 1 else "sell",
                        entry_price=entry_price,
                        exit_price=c.close,
                        units=units,
                        pnl=pnl,
                    )
                )
                ret = pnl / max(equity - pnl, 1e-9)
                returns.append(ret)
                equity_curve.append(equity)
                peak = max(peak, equity)
                dd = (peak - equity) / peak if peak > 0 else 0.0
                max_drawdown = max(max_drawdown, dd)

            if signal != 0:
                risk_cash = equity * (cfg.risk_per_trade_pct / 100.0)
                # fixed risk distance for deterministic sizing
                stop_distance = c.close * 0.002  # 0.2%
                units = max(risk_cash / max(stop_distance, 1e-9), 0.0)
                entry_price = c.close + (cost_per_fill if signal == 1 else -cost_per_fill)
                entry_ts = c.ts
                position = signal
            else:
                position = 0
                units = 0.0

    # Force close at final candle.
    last = window[-1]
    if position != 0:
        gross = (last.close - entry_price) * units * position
        pnl = gross - cost_per_fill * units
        equity += pnl
        trades.append(
            Trade(
                entry_ts=entry_ts,
                exit_ts=last.ts,
                side="buy" if position == 1 else "sell",
                entry_price=entry_price,
                exit_price=last.close,
                units=units,
                pnl=pnl,
            )
        )
        ret = pnl / max(equity - pnl, 1e-9)
        returns.append(ret)
        equity_curve.append(equity)
        peak = max(peak, equity)
        dd = (peak - equity) / peak if peak > 0 else 0.0
        max_drawdown = max(max_drawdown, dd)

    wins = [t for t in trades if t.pnl > 0]
    losses = [t for t in trades if t.pnl <= 0]
    gross_profit = sum(t.pnl for t in wins)
    gross_loss = abs(sum(t.pnl for t in losses))
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else None

    avg_ret = sum(returns) / len(returns) if returns else 0.0
    std_ret = (
        math.sqrt(sum((r - avg_ret) ** 2 for r in returns) / len(returns)) if returns else 0.0
    )
    sharpe_like = (avg_ret / std_ret) * math.sqrt(len(returns)) if std_ret > 0 else 0.0

    metrics = {
        "run": cfg.name,
        "symbol": cfg.symbol,
        "timeframe": cfg.timeframe,
        "window_start": cfg.start.isoformat(),
        "window_end": cfg.end.isoformat(),
        "initial_balance": cfg.initial_balance,
        "final_balance": equity,
        "net_pnl": equity - cfg.initial_balance,
        "total_return_pct": ((equity / cfg.initial_balance) - 1.0) * 100.0,
        "trades": len(trades),
        "win_rate_pct": (len(wins) / len(trades) * 100.0) if trades else 0.0,
        "profit_factor": profit_factor,
        "max_drawdown_pct": max_drawdown * 100.0,
        "sharpe_like": sharpe_like,
    }

    return BacktestResult(metrics=metrics, trades=trades)
