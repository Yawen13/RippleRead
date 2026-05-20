"""
RippleRead Lexile Engine — Dynamic configuration provider for AI prompts.

Provides a lightweight, cached read of user_preferences from SQLite so that
every AI endpoint (companion chat, chapter insights, simplify, analyze-sentence)
injects the reader's current target_lexile and native_language into system prompts.

Cache TTL is 5 seconds — fresh enough to reflect settings-panel changes
without triggering a DB round-trip on every single AI message.
"""

import time
from typing import Dict, Any, Optional

from db import get_db_connection

_cache: Dict[str, Any] = {}
_cache_ts: float = 0.0
CACHE_TTL = 5.0


def get_user_preferences() -> Dict[str, Any]:
    global _cache, _cache_ts
    now = time.time()
    if _cache and (now - _cache_ts) < CACHE_TTL:
        return _cache

    defaults = {
        "font_size": 18,
        "line_height": 1.6,
        "target_lexile": 800,
        "native_language": "Chinese",
        "user_name": "Explorer",
    }

    try:
        conn = get_db_connection()
        row = conn.execute("SELECT * FROM user_preferences WHERE id = 1").fetchone()
        conn.close()

        if row is None:
            _cache = defaults
        else:
            _cache = {
                "font_size": row["font_size"],
                "line_height": row["line_height"],
                "target_lexile": row["target_lexile"],
                "native_language": row["native_language"],
                "user_name": row["user_name"] if "user_name" in row.keys() else "Explorer",
            }
    except Exception:
        _cache = defaults

    _cache_ts = now
    return _cache


def get_lexile_style_directive(target_lexile: Optional[int] = None) -> str:
    if target_lexile is None:
        target_lexile = get_user_preferences()["target_lexile"]

    if target_lexile <= 500:
        return (
            f"Use very simple English at approximately {target_lexile}L Lexile. "
            "Use short sentences (8-12 words), basic vocabulary, and avoid idioms or complex grammar."
        )
    elif target_lexile <= 800:
        return (
            f"Use moderately simple English at approximately {target_lexile}L Lexile. "
            "Use clear sentence structures and common vocabulary. Avoid jargon and literary devices."
        )
    elif target_lexile <= 1100:
        return (
            f"Use natural, everyday English at approximately {target_lexile}L Lexile. "
            "Standard sentence complexity is fine. You may use moderate vocabulary variety."
        )
    elif target_lexile <= 1300:
        return (
            f"Use advanced English at approximately {target_lexile}L Lexile. "
            "Rich vocabulary, varied sentence structures, and literary expressions are welcome."
        )
    else:
        return (
            f"Use sophisticated, complex English at approximately {target_lexile}L Lexile. "
            "Academic vocabulary, complex sentences, and nuanced expressions are appropriate."
        )


def get_native_language_directive(native_language: Optional[str] = None) -> str:
    if native_language is None:
        native_language = get_user_preferences()["native_language"]

    return (
        f"The reader's native language is {native_language}. "
        f"When explaining difficult words, concepts, or grammar, provide {native_language} translations "
        f"or use comparisons to {native_language} linguistic structures where helpful."
    )


def get_user_name_context_directive(user_name: Optional[str] = None) -> str:
    if user_name is None:
        user_name = get_user_preferences()["user_name"]

    return (
        f"You are an empathetic AI mentor for a user named {user_name}. "
        f"Address them occasionally by their name to build connection and rapport."
    )


def get_ai_context_directive(target_lexile: Optional[int] = None,
                              native_language: Optional[str] = None,
                              user_name: Optional[str] = None) -> str:
    prefs = get_user_preferences()
    lex = target_lexile if target_lexile is not None else prefs["target_lexile"]
    lang = native_language if native_language is not None else prefs["native_language"]
    name = user_name if user_name is not None else prefs["user_name"]

    lexile_dir = get_lexile_style_directive(lex)
    native_dir = get_native_language_directive(lang)
    name_dir = get_user_name_context_directive(name)

    return f"""{lexile_dir}
{native_dir}
{name_dir}"""


def invalidate_cache() -> None:
    global _cache, _cache_ts
    _cache = {}
    _cache_ts = 0.0
