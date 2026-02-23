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


config = Config()
