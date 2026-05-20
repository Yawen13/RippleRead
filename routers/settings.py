from fastapi import APIRouter, HTTPException, Request

from core.lexile_engine import invalidate_cache
from db import get_db_connection
from schemas import SettingsUpdate


router = APIRouter(prefix="/api/settings", tags=["settings"])


def _ensure_settings_row(conn, user_id):
    row = conn.execute("SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)).fetchone()
    if row is None:
        conn.execute(
            """INSERT INTO user_preferences (user_id, font_size, line_height, target_lexile, native_language, user_name, theme)
               VALUES (?, 18, 1.6, 800, 'Chinese', 'Explorer', 'light')""",
            (user_id,)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)).fetchone()
    return row


@router.get("")
async def get_settings(request: Request):
    try:
        conn = get_db_connection()
        row = _ensure_settings_row(conn, request.state.user_id)
        conn.close()
        return dict(row)
    except Exception as e:
        print(f"Error fetching settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch settings")


@router.put("")
async def update_settings(settings: SettingsUpdate, request: Request):
    try:
        conn = get_db_connection()
        user_id = request.state.user_id
        row = _ensure_settings_row(conn, user_id)

        new_font_size = settings.font_size if settings.font_size is not None else row["font_size"]
        new_line_height = settings.line_height if settings.line_height is not None else row["line_height"]
        new_target_lexile = settings.target_lexile if settings.target_lexile is not None else row["target_lexile"]
        new_native_language = settings.native_language if settings.native_language is not None else row["native_language"]
        new_user_name = settings.user_name if settings.user_name is not None else row["user_name"]
        new_theme = settings.theme if settings.theme is not None else (row["theme"] if "theme" in row.keys() else "light")

        conn.execute(
            """UPDATE user_preferences
               SET font_size = ?, line_height = ?, target_lexile = ?, native_language = ?, user_name = ?, theme = ?
               WHERE user_id = ?""",
            (new_font_size, new_line_height, new_target_lexile, new_native_language, new_user_name, new_theme, user_id),
        )

        conn.execute("INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)", (user_id, new_user_name,))
        conn.execute("UPDATE users SET name = ? WHERE id = ?", (new_user_name, user_id,))
        conn.commit()

        updated = conn.execute("SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)).fetchone()
        conn.close()
        invalidate_cache()
        return dict(updated)
    except Exception as e:
        print(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to update settings")
