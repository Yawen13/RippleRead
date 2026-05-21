import json
import re

from ..db import get_db_connection


def normalize_library_row(row: dict) -> dict:
    tc = row.get("total_chapters", 0) or 0
    cci = row.get("current_chapter_index", 0) or 0
    if row.get("progress") is None:
        row["progress"] = round((cci / tc) * 100, 1) if tc > 0 else 0
    row["total_chapters"] = tc
    row["current_chapter_index"] = cci
    return row


LIBRARY_COLS = "id, title, author, source_type, lexile_level, progress, cover_url, is_saved, last_read_at, created_at, current_chapter_index, total_chapters, category, source_book_id"


def get_library(user_id: int = 1):
    conn = get_db_connection()
    cursor = conn.execute(f'SELECT {LIBRARY_COLS} FROM library WHERE user_id = ? ORDER BY created_at DESC LIMIT 200', (user_id,))
    library_items = [normalize_library_row(dict(row)) for row in cursor.fetchall()]
    conn.close()
    return library_items


def get_library_saved(user_id: int = 1):
    conn = get_db_connection()
    cursor = conn.execute(f'SELECT {LIBRARY_COLS} FROM library WHERE user_id = ? AND is_saved = 1 ORDER BY last_read_at DESC LIMIT 200', (user_id,))
    library_items = [normalize_library_row(dict(row)) for row in cursor.fetchall()]
    conn.close()
    return library_items


def get_library_recent(user_id: int = 1):
    conn = get_db_connection()
    cursor = conn.execute(f'SELECT {LIBRARY_COLS} FROM library WHERE user_id = ? AND last_read_at IS NOT NULL ORDER BY last_read_at DESC LIMIT 1', (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return normalize_library_row(dict(row))
    return None


def delete_library_item(item_id: int, user_id: int = 1):
    conn = get_db_connection()
    cursor = conn.execute('SELECT id FROM library WHERE id = ? AND user_id = ?', (item_id, user_id))
    if not cursor.fetchone():
        conn.close()
        return False
    conn.execute('DELETE FROM library WHERE id = ? AND user_id = ?', (item_id, user_id))
    conn.commit()
    conn.close()
    return True


def update_progress(item_id: int, body, user_id: int = 1):
    conn = get_db_connection()
    row = conn.execute('SELECT id, total_chapters, title, progress FROM library WHERE id = ? AND user_id = ?', (item_id, user_id)).fetchone()
    if not row:
        conn.close()
        return None, "Item not found"

    tc = row["total_chapters"] or 0
    old_progress = row["progress"] or 0
    book_title = row["title"] or "Untitled"

    if body.total_chapters > 0 and tc == 0:
        tc = body.total_chapters
        conn.execute('UPDATE library SET total_chapters = ? WHERE id = ? AND user_id = ?', (tc, item_id, user_id))
        conn.commit()

    new_progress = old_progress

    if body.progress >= 0:
        new_progress = min(max(body.progress, 0), 100)
        conn.execute('UPDATE library SET progress = ?, last_read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                     (new_progress, item_id, user_id))
        if tc > 0 and body.current_chapter_index is not None:
            cci = body.current_chapter_index
            if cci < 0:
                cci = 0
            if cci >= tc:
                cci = tc - 1
            conn.execute('UPDATE library SET current_chapter_index = ? WHERE id = ? AND user_id = ?', (cci, item_id, user_id))
        conn.commit()
        conn.close()

        if new_progress >= 100 and old_progress < 100:
            from .notification_service import check_and_notify_book_finished
            check_and_notify_book_finished(user_id, item_id, book_title)

        from .notification_service import check_and_notify_daily_goal, check_and_notify_streak_milestone
        check_and_notify_daily_goal(user_id)
        check_and_notify_streak_milestone(user_id)

        return {"progress": new_progress, "message": "Progress saved"}, None

    cci = body.current_chapter_index
    if cci is None:
        cci = 0
    if cci < 0:
        cci = 0
    if tc > 0 and cci >= tc:
        cci = tc - 1
    existing_progress = row["progress"] or 0
    conn.execute('UPDATE library SET current_chapter_index = ?, last_read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', (cci, item_id, user_id))
    conn.commit()
    conn.close()
    return {"progress": existing_progress, "current_chapter_index": cci, "total_chapters": tc, "message": "Chapter progress saved"}, None


def toggle_favorite(item_id: int, user_id: int = 1) -> dict:
    conn = get_db_connection()
    row = conn.execute('SELECT id, is_saved, title FROM library WHERE id = ? AND user_id = ?', (item_id, user_id)).fetchone()
    if not row:
        conn.close()
        return None
    new_val = 0 if row["is_saved"] else 1
    conn.execute('UPDATE library SET is_saved = ?, last_read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', (new_val, item_id, user_id))
    conn.commit()
    conn.close()
    return {"id": item_id, "is_saved": bool(new_val), "title": row["title"]}


def get_book_content(book_id: int, user_id: int = 1):
    conn = get_db_connection()
    cursor = conn.execute(f'SELECT {LIBRARY_COLS}, content FROM library WHERE id = ? AND user_id = ?', (book_id, user_id))
    row = cursor.fetchone()
    conn.close()
    if row:
        book = normalize_library_row(dict(row))
        content = book.get("content", "")
        if isinstance(content, str):
            try:
                book["content"] = json.loads(content)
            except json.JSONDecodeError:
                book["content"] = [{"chapter_title": "Full Text", "content": content}]
        return book
    return None


def split_into_chapters(text: str) -> list:
    pattern = r'(?=^(?:CHAPTER|Chapter|CHAP|Chap)\s+(?:[IVXLCDM]+|\d{1,3})\b)'
    parts = re.split(pattern, text, flags=re.MULTILINE)

    if len(parts) <= 1:
        pattern2 = r'(?=^(?:[IVXLCDM]{1,7}\.\s+\S|\d{1,3}\.\s+\S))'
        parts = re.split(pattern2, text, flags=re.MULTILINE)

    if len(parts) <= 1:
        pattern3 = r'(?=^(?:CHAPTER|Chapter)\s+(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|TWENTY[- ]ONE|TWENTY[- ]TWO|TWENTY[- ]THREE|TWENTY[- ]FOUR|TWENTY[- ]FIVE|TWENTY[- ]SIX|TWENTY[- ]SEVEN|TWENTY[- ]EIGHT|TWENTY[- ]NINE|THIRTY)\b)'
        parts = re.split(pattern3, text, flags=re.MULTILINE | re.IGNORECASE)

    if len(parts) <= 1:
        pattern4 = r'(?=^(?:PART|Part|SECTION|Section|BOOK|Book)\s+(?:[IVXLCDM]+|\d{1,3}|[A-Z]+)\b)'
        parts = re.split(pattern4, text, flags=re.MULTILINE)

    if len(parts) <= 1:
        pattern5 = r'(?=^(?:[IVXLCDM]{1,7})\s*$|[IVXLCDM]{1,7}\.\s*$)'
        parts = re.split(pattern5, text, flags=re.MULTILINE)

    chapters = []
    for i, part in enumerate(parts):
        content = part.strip()
        if not content or len(content) < 80:
            continue
        first_line = content.split("\n")[0].strip()
        title = first_line if len(first_line) < 120 else f"Chapter {i + 1}"
        chapters.append({"chapter_title": title, "content": content})

    if not chapters:
        chapters = [{"chapter_title": "Full Text", "content": text}]

    return chapters


def rechunk_book(item_id: int, user_id: int = 1) -> dict:
    conn = get_db_connection()
    row = conn.execute('SELECT id, title, content, source_type FROM library WHERE id = ? AND user_id = ?', (item_id, user_id)).fetchone()
    if not row:
        conn.close()
        return None

    raw_content = row["content"] or ""
    source_type = row["source_type"] or "book"

    try:
        existing = json.loads(raw_content)
        if isinstance(existing, list) and len(existing) > 0:
            full_text = "\n\n".join(ch.get("content", "") for ch in existing)
        else:
            full_text = raw_content
    except (json.JSONDecodeError, TypeError):
        full_text = raw_content

    if not full_text or len(full_text) < 80:
        conn.close()
        return {"id": item_id, "total_chapters": 0, "message": "Content too short to split"}

    chapters = split_into_chapters(full_text)
    content_json = json.dumps(chapters, ensure_ascii=False)
    total_chapters = len(chapters)

    conn.execute(
        'UPDATE library SET content = ?, total_chapters = ?, current_chapter_index = 0 WHERE id = ? AND user_id = ?',
        (content_json, total_chapters, item_id, user_id)
    )
    conn.commit()
    conn.close()

    return {
        "id": item_id,
        "total_chapters": total_chapters,
        "chapter_titles": [ch["chapter_title"] for ch in chapters],
        "message": f"Re-split into {total_chapters} chapters"
    }
