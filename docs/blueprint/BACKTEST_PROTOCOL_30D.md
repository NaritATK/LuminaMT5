# 30-Day Backtest Protocol (XAUUSD/BTCUSD, M5)

Objective: produce comparable, reproducible pre-rollout evidence for strategy safety and behavior.

## Fixed Parameters
- Window: rolling last 30 calendar days
- Symbols: `XAUUSD`, `BTCUSD`
- Timeframe: `M5`
- Data timezone: UTC
- Costs model: spread + slippage assumptions must be explicit in output

## Inputs (required)
- Strategy version/hash
- Risk policy version/hash
- Data source + extraction timestamp
- Execution assumptions (latency/slippage caps)

## Procedure
1. **Freeze config**
   - Create run name: `<symbol>-m5-30d-<yyyymmdd>`
   - Store resolved config artifact
2. **Data integrity checks**
   - No missing candle gaps > accepted threshold
   - Consistent symbol metadata (digits, contract size where applicable)
3. **Run simulation**
   - Include entry/exit logic + risk gates
   - Apply transaction costs
4. **Generate metrics**
   - Net PnL
   - Max drawdown
   - Profit factor
   - Win rate
   - Avg R multiple (or equivalent)
   - Trade count/day and exposure profile
5. **Stress variants (minimum)**
   - +25% spread
   - +50% slippage
   - Reduced execution frequency window
6. **Gate decision**
   - PASS only if all thresholds met and no catastrophic tail behavior

## Suggested Pass/Fail Gates
- Max drawdown <= policy limit
- Profit factor >= 1.2
- No single-day loss breach vs daily loss policy
- Strategy remains non-negative under at least one stress variant

## Deliverables per run
- `resolved-config.json`
- `metrics-summary.json`
- `trades.csv` (or equivalent fill log)
- `gate-decision.md` (PASS/FAIL + rationale)

## Operational Rules
- Backtest does **not** authorize live deployment by itself.
- Any strategy/risk config change requires a fresh 30-day run.
- Store artifacts immutably for audit comparison across releases.
