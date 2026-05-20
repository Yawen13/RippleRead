import re


def highlight_match(text, keyword):
    if not text or not keyword:
        return text or ""
    escaped = re.escape(keyword)
    return re.sub(
        r"(" + escaped + r")",
        r"<mark>\1</mark>",
        text,
        flags=re.IGNORECASE,
    )


def search_library(conn, keyword, limit=5):
    rows = conn.execute(
        "SELECT id, title, author, source_type FROM library "
        "WHERE title LIKE ? OR author LIKE ? "
        "ORDER BY created_at DESC LIMIT ?",
        ("%" + keyword + "%", "%" + keyword + "%", limit),
    ).fetchall()
    results = []
    for row in rows:
        d = dict(row)
        matched_field = d.get("title", "") if keyword.lower() in (d.get("title") or "").lower() else (d.get("author") or "")
        results.append({
            "id": d["id"],
            "title": d.get("title", ""),
            "author": d.get("author", ""),
            "type": d.get("source_type", "book"),
            "highlight": highlight_match(matched_field, keyword),
        })
    return results


def search_books(conn, keyword, limit=5):
    rows = conn.execute(
        "SELECT id, title, author, cover_url FROM books "
        "WHERE title LIKE ? OR author LIKE ? "
        "ORDER BY id DESC LIMIT ?",
        ("%" + keyword + "%", "%" + keyword + "%", limit),
    ).fetchall()
    results = []
    for row in rows:
        d = dict(row)
        matched_field = d.get("title", "") if keyword.lower() in (d.get("title") or "").lower() else (d.get("author") or "")
        results.append({
            "id": d["id"],
            "title": d.get("title", ""),
            "author": d.get("author", ""),
            "cover_url": d.get("cover_url", ""),
            "highlight": highlight_match(matched_field, keyword),
        })
    return results


def search_vocabulary(conn, keyword, user_id=1, limit=5):
    rows = conn.execute(
        "SELECT id, text, translation FROM vocabulary "
        "WHERE (user_id = ? OR user_id = 0) AND (text LIKE ? OR translation LIKE ?) "
        "ORDER BY created_at DESC LIMIT ?",
        (user_id, "%" + keyword + "%", "%" + keyword + "%", limit),
    ).fetchall()
    results = []
    for row in rows:
        d = dict(row)
        matched_field = ""
        if keyword.lower() in (d.get("text") or "").lower():
            matched_field = d.get("text", "")
        elif keyword.lower() in (d.get("translation") or "").lower():
            matched_field = d.get("translation", "")
        results.append({
            "id": d["id"],
            "word": d.get("text", ""),
            "translation": d.get("translation", ""),
            "highlight": highlight_match(matched_field, keyword),
        })
    return results
