from __future__ import annotations

from dataclasses import dataclass

from .commands import OpenOrderCommand


@dataclass
class ExecutionResult:
    ok: bool
    message: str
    order_ref: str | None = None


class MT5Gateway:
    def open_order(self, command: OpenOrderCommand) -> ExecutionResult:
        raise NotImplementedError


class DryRunMT5Gateway(MT5Gateway):
    def open_order(self, command: OpenOrderCommand) -> ExecutionResult:
        print(f"[worker] DRY-RUN open order: {command.model_dump(by_alias=True)}")
        return ExecutionResult(ok=True, message="dry_run", order_ref="dry-run")


class LiveMT5Gateway(MT5Gateway):
    def __init__(self, *, login: int | None, password: str | None, server: str | None, terminal_path: str | None):
        self.login = login
        self.password = password
        self.server = server
        self.terminal_path = terminal_path
        self._connected = False

    def connect(self):
        if self._connected:
            return

        import MetaTrader5 as mt5  # noqa: PLC0415

        init_ok = mt5.initialize(path=self.terminal_path) if self.terminal_path else mt5.initialize()
        if not init_ok:
            raise RuntimeError(f"mt5.initialize failed: {mt5.last_error()}")

        if self.login and self.password and self.server:
            login_ok = mt5.login(self.login, password=self.password, server=self.server)
            if not login_ok:
                raise RuntimeError(f"mt5.login failed: {mt5.last_error()}")

        self._connected = True

    def open_order(self, command: OpenOrderCommand) -> ExecutionResult:
        self.connect()

        # Intentionally minimal skeleton for phase-1: validates live path wiring.
        # Build full request mapping (symbol selection, price, deviation, filling mode)
        # when risk controls and contract specs are finalized.
        print(f"[worker] LIVE open order placeholder: {command.model_dump(by_alias=True)}")
        return ExecutionResult(ok=True, message="live_placeholder")
