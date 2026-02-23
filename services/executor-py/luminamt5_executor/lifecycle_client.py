from __future__ import annotations

import time
from typing import Any

import requests


class LifecycleClient:
    def __init__(
        self,
        *,
        api_base: str,
        api_key: str | None = None,
        bearer_token: str | None = None,
        max_attempts: int = 3,
        initial_backoff_sec: float = 0.5,
        timeout_sec: float = 5.0,
    ):
        self.api_base = api_base.rstrip("/")
        self.api_key = api_key
        self.bearer_token = bearer_token
        self.max_attempts = max_attempts
        self.initial_backoff_sec = initial_backoff_sec
        self.timeout_sec = timeout_sec
        self._session = requests.Session()

    def report(self, payload: dict[str, Any], idempotency_key: str) -> None:
        url = f"{self.api_base}/v1/executor/lifecycle"
        headers = {
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotency_key,
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        if self.bearer_token:
            headers["Authorization"] = f"Bearer {self.bearer_token}"

        delay = self.initial_backoff_sec
        last_error: Exception | None = None

        for attempt in range(1, self.max_attempts + 1):
            try:
                response = self._session.post(url, json=payload, headers=headers, timeout=self.timeout_sec)
                if response.status_code < 500:
                    response.raise_for_status()
                    return
                raise RuntimeError(f"lifecycle endpoint 5xx: {response.status_code} {response.text}")
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt >= self.max_attempts:
                    break
                time.sleep(delay)
                delay *= 2

        raise RuntimeError(f"failed to report lifecycle after retries: {last_error}")
