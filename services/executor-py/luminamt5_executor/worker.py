import time

import redis
from pydantic import ValidationError

from .commands import CloseOrderCommand, OpenOrderCommand, PanicCommand, StatusCommand, UnknownCommand, parse_command, resolve_idempotency_key
from .config import config
from .idempotency import IdempotencyStore
from .mt5_gateway import DryRunMT5Gateway, LiveMT5Gateway


def build_gateway():
    if config.dry_run:
        return DryRunMT5Gateway()

    if not config.mt5_enable_live:
        print("[worker] DRY-RUN forced: set MT5_ENABLE_LIVE=true to allow live gateway")
        return DryRunMT5Gateway()

    return LiveMT5Gateway(
        login=config.mt5_login,
        password=config.mt5_password,
        server=config.mt5_server,
        terminal_path=config.mt5_terminal_path,
    )


def handle_command(raw: str, idempotency: IdempotencyStore, gateway):
    command = parse_command(raw)
    idem_key = resolve_idempotency_key(command, raw)

    idem_status = idempotency.begin(idem_key)
    if idem_status.already_processed:
        print(f"[worker] skip duplicate command key={idem_key}")
        return
    if idem_status.status == "processing" and not idem_status.acquired:
        print(f"[worker] command already in-flight key={idem_key}")
        return

    try:
        if isinstance(command, StatusCommand):
            print(f"[worker] status requested by {command.actor}")
            idempotency.complete(idem_key, {"type": "status"})
            return

        if isinstance(command, PanicCommand):
            print("[worker] PANIC received: stop new executions")
            idempotency.complete(idem_key, {"type": "panic"})
            return

        if isinstance(command, OpenOrderCommand):
            result = gateway.open_order(command)
            if not result.ok:
                raise RuntimeError(f"{result.error_code or 'EXECUTION_ERROR'}: {result.message}")
            idempotency.complete(idem_key, {"type": "open", "order_ref": result.order_ref})
            return

        if isinstance(command, CloseOrderCommand):
            result = gateway.close_order(command)
            if not result.ok:
                raise RuntimeError(f"{result.error_code or 'EXECUTION_ERROR'}: {result.message}")
            idempotency.complete(idem_key, {"type": "close", "order_ref": result.order_ref})
            return

        if isinstance(command, UnknownCommand):
            print(f"[worker] unhandled command type: {command.original_type}")
            idempotency.complete(idem_key, {"type": "unknown", "original_type": command.original_type})
            return

    except Exception:
        idempotency.fail(idem_key)
        raise


def run():
    client = redis.from_url(config.redis_url, decode_responses=True)
    idempotency = IdempotencyStore(
        redis_client=client,
        prefix=f"{config.idempotency_key_prefix}:{config.account_id}",
        processing_ttl_sec=config.idempotency_processing_ttl_sec,
        completed_ttl_sec=config.idempotency_completed_ttl_sec,
    )
    gateway = build_gateway()

    print(f"[worker] started account={config.account_id} dry_run={config.dry_run}")

    while True:
        _, raw = client.blpop(config.queue_key)
        try:
            handle_command(raw, idempotency, gateway)
        except ValidationError as e:
            print(f"[worker] invalid command payload: {e}")
        except Exception as e:
            print(f"[worker] error: {e}")
            time.sleep(1)


if __name__ == "__main__":
    run()
