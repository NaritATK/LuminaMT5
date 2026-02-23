# LuminaMT5

Production-grade multi-account MT5 trading platform with chat control, risk engine, adaptive strategy orchestration, and real-time dashboard.

## Monorepo Layout

- `apps/api` — Fastify backend (API, auth, command bus, risk engine)
- `apps/dashboard` — Next.js dashboard (portfolio, risk, execution telemetry)
- `services/executor-py` — Python MT5 execution workers (1 worker/account)
- `infra` — docker-compose and infrastructure templates
- `docs` — architecture, API contracts, command specs

## Core Objectives

1. Multi-account live trading on MT5
2. Command and control via Telegram/Discord/iMessage
3. Real-time operational and trading dashboard
4. Adaptive strategy layer with strict risk guardrails
5. Production safety: audit trails, kill switch, circuit breaker

## Guardrails (Mandatory)

- Daily loss limit
- Max position per account
- Max total exposure
- Spread/slippage filters
- News blackout windows
- Circuit breaker
- Global panic stop (`/panic`)

## Next Steps

- Fill `.env` from `.env.example`
- Implement API skeleton and executor skeleton
- Connect demo MT5 accounts first (no direct live on day 1)

