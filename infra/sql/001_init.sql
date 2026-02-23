-- LuminaMT5 initial schema (phase 1)

create table if not exists accounts (
  id uuid primary key,
  name text not null,
  broker text not null,
  mt5_login text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists commands (
  id uuid primary key,
  account_id uuid null,
  type text not null,
  payload jsonb not null,
  actor text not null,
  channel text not null,
  decision text not null default 'accepted',
  decision_reason text null,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key,
  account_id uuid not null,
  command_id uuid null,
  symbol text not null,
  side text not null,
  size numeric not null,
  sl numeric null,
  tp numeric null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists fills (
  id uuid primary key,
  order_id uuid not null,
  mt5_deal_id text not null,
  price numeric not null,
  volume numeric not null,
  filled_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists risk_events (
  id uuid primary key,
  account_id uuid null,
  event_type text not null,
  severity text not null,
  message text not null,
  meta jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists command_audit (
  id uuid primary key,
  command_id uuid not null,
  actor text not null,
  channel text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
