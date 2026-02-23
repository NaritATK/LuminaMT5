-- LuminaMT5 schema hardening (phase 1.1)
-- Adds lifecycle constraints/indexes and a positions table without rewriting existing tables.

begin;

-- ------------------------------
-- 1) Commands hardening
-- ------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'commands_type_chk' and conrelid = 'commands'::regclass
  ) then
    alter table commands add constraint commands_type_chk
      check (type in ('status', 'open', 'close', 'set-risk', 'pause', 'resume', 'panic'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'commands_decision_chk' and conrelid = 'commands'::regclass
  ) then
    alter table commands add constraint commands_decision_chk
      check (decision in ('accepted', 'blocked', 'rejected', 'executed', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'commands_actor_nonempty_chk' and conrelid = 'commands'::regclass
  ) then
    alter table commands add constraint commands_actor_nonempty_chk
      check (length(trim(actor)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'commands_channel_nonempty_chk' and conrelid = 'commands'::regclass
  ) then
    alter table commands add constraint commands_channel_nonempty_chk
      check (length(trim(channel)) > 0);
  end if;
end $$;

-- ------------------------------
-- 2) Orders lifecycle hardening
-- ------------------------------
alter table orders
  add column if not exists client_order_id text null,
  add column if not exists mt5_order_id text null,
  add column if not exists mt5_position_id text null,
  add column if not exists opened_at timestamptz null,
  add column if not exists closed_at timestamptz null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists close_reason text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_side_chk' and conrelid = 'orders'::regclass
  ) then
    alter table orders add constraint orders_side_chk
      check (side in ('buy', 'sell'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_status_chk' and conrelid = 'orders'::regclass
  ) then
    alter table orders add constraint orders_status_chk
      check (status in ('pending', 'submitted', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired', 'closed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_size_positive_chk' and conrelid = 'orders'::regclass
  ) then
    alter table orders add constraint orders_size_positive_chk check (size > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_sl_positive_chk' and conrelid = 'orders'::regclass
  ) then
    alter table orders add constraint orders_sl_positive_chk check (sl is null or sl > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_tp_positive_chk' and conrelid = 'orders'::regclass
  ) then
    alter table orders add constraint orders_tp_positive_chk check (tp is null or tp > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_closed_after_open_chk' and conrelid = 'orders'::regclass
  ) then
    alter table orders add constraint orders_closed_after_open_chk
      check (closed_at is null or opened_at is null or closed_at >= opened_at);
  end if;
end $$;

-- ------------------------------
-- 3) Fills hardening
-- ------------------------------
alter table fills
  add column if not exists side text null,
  add column if not exists fee numeric null,
  add column if not exists commission numeric null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fills_price_positive_chk' and conrelid = 'fills'::regclass
  ) then
    alter table fills add constraint fills_price_positive_chk check (price > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fills_volume_positive_chk' and conrelid = 'fills'::regclass
  ) then
    alter table fills add constraint fills_volume_positive_chk check (volume > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fills_side_chk' and conrelid = 'fills'::regclass
  ) then
    alter table fills add constraint fills_side_chk check (side is null or side in ('buy', 'sell'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fills_fee_abs_chk' and conrelid = 'fills'::regclass
  ) then
    alter table fills add constraint fills_fee_abs_chk check (fee is null or fee > -1000000000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fills_commission_abs_chk' and conrelid = 'fills'::regclass
  ) then
    alter table fills add constraint fills_commission_abs_chk check (commission is null or commission > -1000000000);
  end if;
end $$;

-- robust idempotency for broker deal ingestion
create unique index if not exists fills_mt5_deal_id_uniq_idx on fills (mt5_deal_id);

-- ------------------------------
-- 4) Positions table
-- ------------------------------
create table if not exists positions (
  id uuid primary key,
  account_id uuid not null,
  order_id uuid null,
  symbol text not null,
  side text not null,
  status text not null default 'open',
  mt5_position_id text null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz null,
  avg_entry_price numeric not null,
  avg_exit_price numeric null,
  size_opened numeric not null,
  size_closed numeric not null default 0,
  realized_pnl numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint positions_side_chk check (side in ('buy', 'sell')),
  constraint positions_status_chk check (status in ('open', 'partially_closed', 'closed')),
  constraint positions_size_opened_positive_chk check (size_opened > 0),
  constraint positions_size_closed_nonnegative_chk check (size_closed >= 0),
  constraint positions_size_closed_lte_opened_chk check (size_closed <= size_opened),
  constraint positions_avg_entry_price_positive_chk check (avg_entry_price > 0),
  constraint positions_avg_exit_price_positive_chk check (avg_exit_price is null or avg_exit_price > 0),
  constraint positions_close_time_chk check (closed_at is null or closed_at >= opened_at)
);

-- ------------------------------
-- 5) Foreign keys (added defensively)
-- ------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'commands_account_id_fkey' and conrelid = 'commands'::regclass
  ) then
    alter table commands
      add constraint commands_account_id_fkey
      foreign key (account_id) references accounts(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_account_id_fkey' and conrelid = 'orders'::regclass
  ) then
    alter table orders
      add constraint orders_account_id_fkey
      foreign key (account_id) references accounts(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_command_id_fkey' and conrelid = 'orders'::regclass
  ) then
    alter table orders
      add constraint orders_command_id_fkey
      foreign key (command_id) references commands(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fills_order_id_fkey' and conrelid = 'fills'::regclass
  ) then
    alter table fills
      add constraint fills_order_id_fkey
      foreign key (order_id) references orders(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'risk_events_account_id_fkey' and conrelid = 'risk_events'::regclass
  ) then
    alter table risk_events
      add constraint risk_events_account_id_fkey
      foreign key (account_id) references accounts(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'command_audit_command_id_fkey' and conrelid = 'command_audit'::regclass
  ) then
    alter table command_audit
      add constraint command_audit_command_id_fkey
      foreign key (command_id) references commands(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'positions_account_id_fkey' and conrelid = 'positions'::regclass
  ) then
    alter table positions
      add constraint positions_account_id_fkey
      foreign key (account_id) references accounts(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'positions_order_id_fkey' and conrelid = 'positions'::regclass
  ) then
    alter table positions
      add constraint positions_order_id_fkey
      foreign key (order_id) references orders(id) on delete set null;
  end if;
end $$;

-- ------------------------------
-- 6) Indexes for lifecycle queries
-- ------------------------------
create index if not exists commands_account_created_idx on commands (account_id, created_at desc);
create index if not exists commands_type_created_idx on commands (type, created_at desc);

create index if not exists orders_account_status_created_idx on orders (account_id, status, created_at desc);
create index if not exists orders_command_idx on orders (command_id);
create index if not exists orders_mt5_order_id_idx on orders (mt5_order_id) where mt5_order_id is not null;
create index if not exists orders_mt5_position_id_idx on orders (mt5_position_id) where mt5_position_id is not null;

create index if not exists fills_order_filled_at_idx on fills (order_id, filled_at asc);
create index if not exists fills_filled_at_idx on fills (filled_at desc);

create index if not exists risk_events_account_severity_created_idx on risk_events (account_id, severity, created_at desc);
create index if not exists command_audit_command_created_idx on command_audit (command_id, created_at asc);

create index if not exists positions_account_status_opened_idx on positions (account_id, status, opened_at desc);
create index if not exists positions_symbol_status_idx on positions (symbol, status);
create unique index if not exists positions_mt5_position_id_uniq_idx
  on positions (mt5_position_id)
  where mt5_position_id is not null;

commit;
