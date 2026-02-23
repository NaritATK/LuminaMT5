import json
import time
import redis
from .config import config


def handle_command(raw: str):
    cmd = json.loads(raw)
    if cmd.get("type") == "status":
        print(f"[worker] status requested by {cmd.get('actor')}")
        return

    if cmd.get("type") == "panic":
        print("[worker] PANIC received: stop new executions")
        return

    if cmd.get("type") == "open":
        if config.dry_run:
            print(f"[worker] DRY-RUN open order: {cmd}")
            return

        # TODO: integrate MetaTrader5 execution with idempotency keys
        print(f"[worker] LIVE open order placeholder: {cmd}")
        return

    print(f"[worker] unhandled command type: {cmd.get('type')}")


def run():
    client = redis.from_url(config.redis_url, decode_responses=True)
    print(f"[worker] started account={config.account_id} dry_run={config.dry_run}")

    while True:
        _, raw = client.blpop(config.queue_key)
        try:
            handle_command(raw)
        except Exception as e:
            print(f"[worker] error: {e}")
            time.sleep(1)


if __name__ == "__main__":
    run()
