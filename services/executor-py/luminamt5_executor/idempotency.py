from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass
class IdempotencyStatus:
    status: str
    already_processed: bool = False
    acquired: bool = False


class IdempotencyStore:
    def __init__(self, redis_client, prefix: str, processing_ttl_sec: int, completed_ttl_sec: int):
        self.redis = redis_client
        self.prefix = prefix
        self.processing_ttl_sec = processing_ttl_sec
        self.completed_ttl_sec = completed_ttl_sec

    def _key(self, idempotency_key: str) -> str:
        return f"{self.prefix}:{idempotency_key}"

    def begin(self, idempotency_key: str) -> IdempotencyStatus:
        key = self._key(idempotency_key)
        current = self.redis.get(key)
        if current:
            payload = json.loads(current)
            if payload.get("status") == "completed":
                return IdempotencyStatus(status="completed", already_processed=True, acquired=False)
            return IdempotencyStatus(status="processing", already_processed=False, acquired=False)

        lock_payload = json.dumps({"status": "processing"})
        acquired = self.redis.set(key, lock_payload, nx=True, ex=self.processing_ttl_sec)
        if not acquired:
            return IdempotencyStatus(status="processing", already_processed=False, acquired=False)
        return IdempotencyStatus(status="processing", already_processed=False, acquired=True)

    def complete(self, idempotency_key: str, meta: dict | None = None):
        key = self._key(idempotency_key)
        payload = {"status": "completed", "meta": meta or {}}
        self.redis.set(key, json.dumps(payload), ex=self.completed_ttl_sec)

    def fail(self, idempotency_key: str):
        key = self._key(idempotency_key)
        self.redis.delete(key)
