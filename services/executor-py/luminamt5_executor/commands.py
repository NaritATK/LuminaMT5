from __future__ import annotations

import hashlib
import json
from typing import Literal, Union

from pydantic import BaseModel, Field


class CommandBase(BaseModel):
    type: str
    actor: str | None = None
    command_id: str | None = Field(default=None, alias="commandId")
    idempotency_key: str | None = Field(default=None, alias="idempotencyKey")


class StatusCommand(CommandBase):
    type: Literal["status"]


class PanicCommand(CommandBase):
    type: Literal["panic"]


class OpenOrderCommand(CommandBase):
    type: Literal["open"]
    symbol: str
    side: Literal["buy", "sell"]
    volume: float
    sl: float | None = None
    tp: float | None = None
    comment: str | None = None


class UnknownCommand(CommandBase):
    type: Literal["unknown"] = "unknown"
    original_type: str | None = None


Command = Union[StatusCommand, PanicCommand, OpenOrderCommand, UnknownCommand]


def parse_command(raw: str) -> Command:
    payload = json.loads(raw)
    command_type = payload.get("type")

    if command_type == "status":
        return StatusCommand.model_validate(payload)
    if command_type == "panic":
        return PanicCommand.model_validate(payload)
    if command_type == "open":
        return OpenOrderCommand.model_validate(payload)

    return UnknownCommand.model_validate({
        "type": "unknown",
        "actor": payload.get("actor"),
        "commandId": payload.get("commandId"),
        "idempotencyKey": payload.get("idempotencyKey"),
        "original_type": command_type,
    })


def resolve_idempotency_key(command: CommandBase, raw: str) -> str:
    if command.idempotency_key:
        return command.idempotency_key
    if command.command_id:
        return command.command_id
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"raw:{digest}"
