from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .commands import CloseOrderCommand, OpenOrderCommand


@dataclass
class ExecutionResult:
    ok: bool
    message: str
    order_ref: str | None = None
    error_code: str | None = None


class MT5Gateway:
    def open_order(self, command: OpenOrderCommand) -> ExecutionResult:
        raise NotImplementedError

    def close_order(self, command: CloseOrderCommand) -> ExecutionResult:
        raise NotImplementedError


class DryRunMT5Gateway(MT5Gateway):
    def open_order(self, command: OpenOrderCommand) -> ExecutionResult:
        print(f"[worker] DRY-RUN open order: {command.model_dump(by_alias=True)}")
        return ExecutionResult(ok=True, message="dry_run_open", order_ref="dry-run-open")

    def close_order(self, command: CloseOrderCommand) -> ExecutionResult:
        print(f"[worker] DRY-RUN close order: {command.model_dump(by_alias=True)}")
        return ExecutionResult(ok=True, message="dry_run_close", order_ref="dry-run-close")


class LiveMT5Gateway(MT5Gateway):
    """Live MT5 gateway with safe boot checks and execution placeholders.

    Intentionally does *not* submit live orders yet. It validates connectivity,
    login/account identity, and symbol readiness so the runtime path can be
    verified safely before enabling final order_send mappings.
    """

    def __init__(self, *, login: int | None, password: str | None, server: str | None, terminal_path: str | None):
        self.login = login
        self.password = password
        self.server = server
        self.terminal_path = terminal_path
        self._connected = False

    def _map_mt5_error(self, context: str, error_tuple: Any) -> ExecutionResult:
        code = None
        message = str(error_tuple)
        if isinstance(error_tuple, tuple) and len(error_tuple) >= 2:
            code = error_tuple[0]
            message = error_tuple[1]

        return ExecutionResult(
            ok=False,
            message=f"{context}: {message}",
            error_code=f"MT5_{context.upper()}_{code if code is not None else 'UNKNOWN'}",
        )

    def _safe_boot(self) -> ExecutionResult:
        if self._connected:
            return ExecutionResult(ok=True, message="connected")

        try:
            import MetaTrader5 as mt5  # noqa: PLC0415
        except Exception as exc:  # pragma: no cover - env specific
            return ExecutionResult(ok=False, message=f"mt5_import_failed: {exc}", error_code="MT5_IMPORT_FAILED")

        init_ok = mt5.initialize(path=self.terminal_path) if self.terminal_path else mt5.initialize()
        if not init_ok:
            return self._map_mt5_error("initialize_failed", mt5.last_error())

        if self.login is None or not self.password or not self.server:
            mt5.shutdown()
            return ExecutionResult(
                ok=False,
                message="missing live credentials: MT5_LOGIN, MT5_PASSWORD, MT5_SERVER are required",
                error_code="MT5_LOGIN_CONFIG_MISSING",
            )

        login_ok = mt5.login(self.login, password=self.password, server=self.server)
        if not login_ok:
            err = self._map_mt5_error("login_failed", mt5.last_error())
            mt5.shutdown()
            return err

        account = mt5.account_info()
        if account is None:
            err = self._map_mt5_error("account_info_failed", mt5.last_error())
            mt5.shutdown()
            return err

        if int(account.login) != int(self.login):
            mt5.shutdown()
            return ExecutionResult(
                ok=False,
                message=f"account mismatch: expected login={self.login}, got login={account.login}",
                error_code="MT5_ACCOUNT_MISMATCH",
            )

        self._connected = True
        return ExecutionResult(ok=True, message="connected")

    def _ensure_symbol_ready(self, symbol: str) -> ExecutionResult:
        import MetaTrader5 as mt5  # noqa: PLC0415

        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            return ExecutionResult(
                ok=False,
                message=f"symbol unavailable: {symbol}",
                error_code="MT5_SYMBOL_UNAVAILABLE",
            )

        if not getattr(symbol_info, "visible", False):
            selected = mt5.symbol_select(symbol, True)
            if not selected:
                return self._map_mt5_error("symbol_select_failed", mt5.last_error())

        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return ExecutionResult(
                ok=False,
                message=f"symbol has no tick data: {symbol}",
                error_code="MT5_SYMBOL_NO_TICK",
            )

        return ExecutionResult(ok=True, message="symbol_ready")

    def open_order(self, command: OpenOrderCommand) -> ExecutionResult:
        boot = self._safe_boot()
        if not boot.ok:
            return boot

        symbol = self._ensure_symbol_ready(command.symbol)
        if not symbol.ok:
            return symbol

        # Placeholder only: request mapping + order_send is intentionally deferred.
        print(f"[worker] LIVE open order stub validated: {command.model_dump(by_alias=True)}")
        return ExecutionResult(ok=True, message="live_open_stub_validated", order_ref="live-open-stub")

    def close_order(self, command: CloseOrderCommand) -> ExecutionResult:
        boot = self._safe_boot()
        if not boot.ok:
            return boot

        symbol = self._ensure_symbol_ready(command.symbol)
        if not symbol.ok:
            return symbol

        # Placeholder only: exact position lookup/close mapping deferred.
        print(f"[worker] LIVE close order stub validated: {command.model_dump(by_alias=True)}")
        return ExecutionResult(ok=True, message="live_close_stub_validated", order_ref="live-close-stub")
