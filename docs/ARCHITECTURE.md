# Architecture v1

## Services

- API Core (Fastify)
  - Auth + RBAC
  - Command Bus
  - Risk Engine
  - Order Orchestration
  - Audit Logging

- Execution Workers (Python + MT5)
  - One worker per MT5 account
  - Idempotent order execution
  - Fill/event reporting back to API

- Dashboard (Next.js)
  - Portfolio and account health
  - PnL / drawdown / exposure
  - Incident timeline + command audit

## Data Stores

- PostgreSQL
  - accounts, strategies, risk_policies
  - commands, orders, fills, positions
  - pnl_snapshots, incidents, audit_events

- Redis
  - command queue
  - worker heartbeats
  - distributed locks
  - realtime cache

## Safety Flow

`chat command -> authz -> risk pre-check -> queue -> worker execute -> post-trade risk check -> telemetry`

Any failed risk gate blocks execution.
