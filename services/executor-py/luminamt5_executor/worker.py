import time
from datetime import UTC, datetime

import redis
from pydantic import ValidationError

from .commands import OpenOrderCommand, PanicCommand, StatusCommand, UnknownCommand, parse_command, resolve_idempotency_key
from .config import config
from .idempotency import IdempotencyStore
from .lifecycle_client import LifecycleClient
from .mt5_gateway import DryRunMT5Gateway, LiveMT5Gateway


def build_gateway():
    if config.dry_run:
        return DryRunMT5Gateway()
    return LiveMT5Gateway(
        login=config.mt5_login,
        password=config.mt5_password,
        server=config.mt5_server,
        terminal_path=config.mt5_terminal_path,
    )


def _now_iso() -> str:
    return datetime.now(tz=UTC).isoformat()


def _report_lifecycle_safe(lifecycle: LifecycleClient, payload: dict, idem_key: str, stage: str):
    event_key = f"{idem_key}:{stage}"
    lifecycle.report(payload, idempotency_key=event_key)


def handle_command(raw: str, idempotency: IdempotencyStore, gateway, lifecycle: LifecycleClient):
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
                if command.command_id:
                    _report_lifecycle_safe(
                        lifecycle,
                        {
                            "command": {
                                "id": command.command_id,
                                "decision": "failed",
                                "decisionReason": result.message,
                            }
                        },
                        idem_key,
                        "command_failed",
                    )
                raise RuntimeError(result.message)

            if command.command_id:
                now_ts = _now_iso()
                order_ref = result.order_ref or f"dry-{command.command_id[:8]}"
                mt5_order_id = order_ref
                mt5_deal_id = f"{order_ref}-deal"
                mt5_position_id = f"{order_ref}-pos"
                order_status = "filled"

                _report_lifecycle_safe(
                    lifecycle,
                    {
                        "command": {
                            "id": command.command_id,
                            "decision": "executed",
                        },
                        "order": {
                            "accountId": config.account_id,
                            "commandId": command.command_id,
                            "symbol": command.symbol,
                            "side": command.side,
                            "size": command.volume,
                            "sl": command.sl,
                            "tp": command.tp,
                            "status": order_status,
                            "clientOrderId": order_ref,
                            "mt5OrderId": mt5_order_id,
                            "mt5PositionId": mt5_position_id,
                            "openedAt": now_ts,
                        },
                        "fill": {
                            "mt5DealId": mt5_deal_id,
                            "price": 1.0,
                            "volume": command.volume,
                            "filledAt": now_ts,
                            "side": command.side,
                        },
                        "position": {
                            "accountId": config.account_id,
                            "symbol": command.symbol,
                            "side": command.side,
                            "status": "open",
                            "mt5PositionId": mt5_position_id,
                            "openedAt": now_ts,
                            "avgEntryPrice": 1.0,
                            "sizeOpened": command.volume,
                            "sizeClosed": 0,
                        },
                    },
                    idem_key,
                    "command_order_fill_position",
                )

            idempotency.complete(idem_key, {"type": "open", "order_ref": result.order_ref})
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
    lifecycle = LifecycleClient(
        api_base=config.api_base,
        api_key=config.api_key,
        bearer_token=config.api_bearer_token,
    )

    print(f"[worker] started account={config.account_id} dry_run={config.dry_run}")

    while True:
        _, raw = client.blpop(config.queue_key)
        try:
            handle_command(raw, idempotency, gateway, lifecycle)
        except ValidationError as e:
            print(f"[worker] invalid command payload: {e}")
        except Exception as e:
            print(f"[worker] error: {e}")
            time.sleep(1)


if __name__ == "__main__":
    run()
