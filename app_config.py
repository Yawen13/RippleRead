"""Application configuration helpers for RippleRead.

Runtime secrets should come from environment variables first, then an optional
local config.json file that is ignored by git.
"""

import json
import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"

DEEPSEEK_CHAT_COMPLETIONS_URL = "https://api.deepseek.com/v1/chat/completions"


def _read_local_config() -> dict:
    if not CONFIG_PATH.exists():
        return {}

    try:
        with CONFIG_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


_LOCAL_CONFIG = _read_local_config()

DEEPSEEK_API_KEY = (
    os.getenv("DEEPSEEK_API_KEY")
    or _LOCAL_CONFIG.get("deepseek_api_key")
    or ""
)

JWT_SECRET = (
    os.getenv("JWT_SECRET")
    or _LOCAL_CONFIG.get("jwt_secret")
    or "rippleread-secret-change-in-production"
)

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7
