from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()


class Config(BaseModel):
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    queue_key: str = os.getenv("COMMAND_QUEUE_KEY", "luminamt5:commands")
    api_base: str = os.getenv("API_BASE", "http://localhost:3000")
    account_id: str = os.getenv("ACCOUNT_ID", "demo-account")
    dry_run: bool = os.getenv("DRY_RUN", "true").lower() == "true"
    mt5_enable_live: bool = os.getenv("MT5_ENABLE_LIVE", "false").lower() == "true"

    idempotency_key_prefix: str = os.getenv("IDEMPOTENCY_PREFIX", "luminamt5:executor:idempotency")
    idempotency_processing_ttl_sec: int = int(os.getenv("IDEMPOTENCY_PROCESSING_TTL_SEC", "120"))
    idempotency_completed_ttl_sec: int = int(os.getenv("IDEMPOTENCY_COMPLETED_TTL_SEC", "604800"))

    mt5_login: int | None = int(os.getenv("MT5_LOGIN")) if os.getenv("MT5_LOGIN") else None
    mt5_password: str | None = os.getenv("MT5_PASSWORD")
    mt5_server: str | None = os.getenv("MT5_SERVER")
    mt5_terminal_path: str | None = os.getenv("MT5_TERMINAL_PATH")


config = Config()
