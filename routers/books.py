import json
import random
import re
import sqlite3
import time
from datetime import date, timedelta
from urllib.parse import quote

import requests
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from core.text_utils import calculate_lexile
from db import get_db_connection
from services.library_service import normalize_library_row, split_into_chapters
from services.notification_service import (
    check_and_notify_daily_goal,
    check_and_notify_streak_milestone,
    check_and_notify_vocab_review,
)

router = APIRouter(prefix="/api", tags=["books"])

class GoalUpdateRequest(BaseModel):
    goal_minutes: int

GUTENDEX_BASE = "https://gutendex.com/books"
REQUEST_TIMEOUT = 20


@router.get("/books")
async def get_books(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("id_desc", description="id_desc, id_asc, random"),
):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row

        count_row = conn.execute("SELECT COUNT(*) as total FROM books").fetchone()
        total = count_row["total"] if count_row else 0

        if sort == "random":
            order_clause = "ORDER BY RANDOM()"
        elif sort == "id_asc":
            order_clause = "ORDER BY id ASC"
        else:
            order_clause = "ORDER BY id DESC"

        rows = conn.execute(
            f"SELECT id, title, author, cover_url, description, lexile_level, source_id FROM books {order_clause} LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        conn.close()

        books = [dict(row) for row in rows]

        return {
            "code": 0,
            "message": "ok",
            "data": books,
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        print(f"[GetBooks] Error: {e}")
        return {"code": -1, "message": str(e), "data": [], "total": 0, "limit": limit, "offset": offset}


def _download_gutenberg_text(source_id: int) -> str:
    resp = requests.get(f"{GUTENDEX_BASE}/{source_id}", timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    formats = data.get("formats", {})

    text_url = None
    for key in ["text/plain; charset=utf-8", "text/plain", "text/plain; charset=us-ascii", "text/plain; charset=iso-8859-1"]:
        url = formats.get(key, "")
        if url and url.startswith("http"):
            text_url = url
            break

    if not text_url:
        candidate_urls = [
            f"https://www.gutenberg.org/ebooks/{source_id}.txt.utf-8",
            f"https://www.gutenberg.org/files/{source_id}/{source_id}-0.txt",
            f"https://www.gutenberg.org/files/{source_id}/{source_id}.txt",
            f"https://www.gutenberg.org/cache/epub/{source_id}/pg{source_id}.txt",
        ]
        for url in candidate_urls:
            try:
                print(f"[ImportBook] Trying fallback URL: {url}")
                text_resp = requests.get(url, timeout=60)
                if text_resp.status_code == 200 and len(text_resp.text) > 200:
                    text_url = url
                    break
            except Exception:
                continue

    if not text_url:
        raise ValueError(f"No readable text URL found for source_id {source_id}")

    print(f"[ImportBook] Downloading text from: {text_url}")
    text_resp = requests.get(text_url, timeout=60)
    text_resp.raise_for_status()

    raw = text_resp.text
    if not raw or len(raw) < 200:
        raise ValueError("Downloaded text is too short")

    return _clean_gutenberg_text(raw)


def _clean_gutenberg_text(raw: str) -> str:
    lines = raw.splitlines()
    start_idx = 0

    for i, line in enumerate(lines):
        s = line.strip()
        if not s:
            continue
        if re.match(r'^(CHAPTER|Chapter)\s+([IVXLCDM]+|\d{1,3})\b', s, re.IGNORECASE):
            start_idx = i
            break
        if i > 30 and len(s) > 80:
            start_idx = i
            break

    end_idx = len(lines)
    footer_tags = [
        "*** END OF THE PROJECT GUTENBERG",
        "***END OF THE PROJECT GUTENBERG",
        "End of the Project Gutenberg",
        "End of Project Gutenberg",
    ]
    for i in range(len(lines) - 1, max(start_idx, len(lines) - 300), -1):
        for tag in footer_tags:
            if tag.lower() in lines[i].lower():
                end_idx = i
                break
        if end_idx < len(lines):
            break

    body = "\n".join(lines[start_idx:end_idx])
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()




@router.post("/books/{book_id}/import")
async def import_book(book_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row

        book_row = conn.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
        if not book_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Book not found")

        book = dict(book_row)

        existing = conn.execute(
            "SELECT id FROM library WHERE source_book_id = ?", (book_id,)
        ).fetchone()
        if existing:
            conn.close()
            return {
                "code": 0,
                "message": "Already in library",
                "library_id": existing["id"],
                "title": book["title"],
            }

        existing_title = conn.execute(
            "SELECT id FROM library WHERE title = ? AND source_book_id IS NULL",
            (book["title"],),
        ).fetchone()
        if existing_title:
            conn.execute(
                "UPDATE library SET source_book_id = ? WHERE id = ?",
                (book_id, existing_title["id"]),
            )
            conn.commit()
            conn.close()
            return {
                "code": 0,
                "message": "Already in library (matched by title)",
                "library_id": existing_title["id"],
                "title": book["title"],
            }

        conn.close()

        source_id = book.get("source_id")
        if not source_id:
            raise HTTPException(status_code=400, detail="No Gutenberg source ID for this book")

        text = _download_gutenberg_text(source_id)
        if not text or len(text) < 100:
            raise HTTPException(status_code=502, detail="Downloaded text too short")

        chapters = split_into_chapters(text)
        content_to_store = json.dumps(chapters, ensure_ascii=False)
        total_chapters = len(chapters)
        lexile_level = calculate_lexile(text)

        conn = get_db_connection()
        conn.execute(
            """INSERT INTO library (title, author, content, source_type, lexile_level, progress,
               cover_url, is_saved, created_at, last_read_at, current_chapter_index,
               total_chapters, source_book_id)
                VALUES (?, ?, ?, 'book', ?, 0, ?, 0, CURRENT_TIMESTAMP, NULL, 0, ?, ?)""",
            (
                book["title"], book["author"], content_to_store,
                lexile_level, book.get("cover_url", ""),
                total_chapters, book_id,
            ),
        )
        conn.commit()
        library_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()

        print(f"[ImportBook] Imported '{book['title']}' -> library_id={library_id}, chapters={total_chapters}")

        return {
            "code": 0,
            "message": "Book imported successfully",
            "library_id": library_id,
            "title": book["title"],
            "lexile_level": lexile_level,
            "total_chapters": total_chapters,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ImportBook] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _clean_title(raw_title: str) -> str:
    if not raw_title:
        return "Untitled"
    return re.sub(r"\s+", " ", raw_title).strip()


def _format_author(raw_authors: list) -> str:
    if not raw_authors:
        return "Unknown Author"
    name = raw_authors[0].get("name", "").strip()
    if not name:
        return "Unknown Author"
    if "," in name:
        parts = [p.strip() for p in name.split(",") if p.strip()]
        if len(parts) >= 2:
            name = " ".join(reversed(parts))
    return name or "Unknown Author"


@router.get("/search/online")
async def search_online(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, le=5),
):
    try:
        url = f"{GUTENDEX_BASE}?search={quote(q)}&languages=en&page={page}"
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        conn = get_db_connection()
        imported_source_ids = set()
        imported_library = {}
        try:
            rows = conn.execute(
                "SELECT l.id as library_id, b.source_id FROM library l JOIN books b ON l.source_book_id = b.id WHERE b.source_id IS NOT NULL"
            ).fetchall()
            for r in rows:
                imported_source_ids.add(r["source_id"])
                imported_library[r["source_id"]] = r["library_id"]
        except Exception:
            pass
        conn.close()

        results = []
        for item in data.get("results", []):
            s_id = item.get("id")
            formats = item.get("formats", {})
            cover_url = formats.get("image/jpeg", "")
            if not cover_url.startswith("http"):
                cover_url = ""

            results.append({
                "source_id": s_id,
                "title": _clean_title(item.get("title", "")),
                "author": _format_author(item.get("authors", [])),
                "cover_url": cover_url,
                "description": ", ".join(item.get("subjects", [])[:3]),
                "download_count": item.get("download_count", 0),
                "already_imported": s_id in imported_source_ids,
                "library_id": imported_library.get(s_id),
            })

        return {
            "code": 0,
            "message": "ok",
            "data": {
                "results": results,
                "count": data.get("count", 0),
                "next": data.get("next") is not None,
                "page": page,
            },
        }
    except Exception as e:
        print(f"[SearchOnline] Error: {e}")
        return {"code": -1, "message": str(e), "data": {"results": [], "count": 0, "next": False, "page": page}}


@router.post("/books/import-by-source/{source_id}")
async def import_by_source(source_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row

        book_row = conn.execute("SELECT id FROM books WHERE source_id = ?", (source_id,)).fetchone()
        if book_row:
            existing = conn.execute(
                "SELECT id FROM library WHERE source_book_id = ?", (book_row["id"],)
            ).fetchone()
            if existing:
                conn.close()
                return {
                    "code": 0,
                    "message": "Already in library",
                    "library_id": existing["id"],
                }

        conn.close()

        resp = requests.get(f"{GUTENDEX_BASE}/{source_id}", timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        title = _clean_title(data.get("title", "Untitled"))
        author = _format_author(data.get("authors", []))
        formats = data.get("formats", {})
        cover_url = formats.get("image/jpeg", "")
        description = ", ".join(data.get("subjects", [])[:3])
        mock_lexile = random.randint(700, 1200)

        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        conn.execute(
            "INSERT OR IGNORE INTO books (title, author, cover_url, description, lexile_level, source_id) VALUES (?, ?, ?, ?, ?, ?)",
            (title, author, cover_url, description, mock_lexile, source_id),
        )
        conn.commit()

        book_row = conn.execute("SELECT id FROM books WHERE source_id = ?", (source_id,)).fetchone()
        books_id = book_row["id"] if book_row else None
        conn.close()

        text = _download_gutenberg_text(source_id)
        if not text or len(text) < 100:
            raise HTTPException(status_code=502, detail="Downloaded text too short")

        chapters = split_into_chapters(text)
        content_to_store = json.dumps(chapters, ensure_ascii=False)
        total_chapters = len(chapters)
        lexile_level = calculate_lexile(text)

        conn = get_db_connection()
        conn.execute(
            """INSERT INTO library (title, author, content, source_type, lexile_level, progress,
               cover_url, is_saved, created_at, last_read_at, current_chapter_index,
               total_chapters, source_book_id)
                VALUES (?, ?, ?, 'book', ?, 0, ?, 0, CURRENT_TIMESTAMP, NULL, 0, ?, ?)""",
            (title, author, content_to_store, lexile_level, cover_url, total_chapters, books_id or 0),
        )
        conn.commit()
        library_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()

        print(f"[ImportBySource] Imported '{title}' -> library_id={library_id}")

        return {
            "code": 0,
            "message": "Book imported successfully",
            "library_id": library_id,
            "title": title,
            "lexile_level": lexile_level,
            "total_chapters": total_chapters,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ImportBySource] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/home/dashboard/goal")
async def update_goal_minutes(body: GoalUpdateRequest, request: Request):
    try:
        conn = get_db_connection()
        conn.execute(
            "UPDATE users SET goal_minutes = ? WHERE id = ?",
            (body.goal_minutes, request.state.user_id),
        )
        conn.commit()
        conn.close()
        return {"code": 0, "message": "Goal updated", "data": {"goal_minutes": body.goal_minutes}}
    except Exception as e:
        print(f"[UpdateGoal] Error: {e}")
        return {"code": -1, "message": str(e), "data": None}


@router.get("/home/dashboard")
async def get_home_dashboard(request: Request):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row

        user_id = request.state.user_id

        user_row = conn.execute(
            "SELECT u.id, COALESCE(p.user_name, u.name) AS name, u.current_streak, u.words_read_today, u.goal_minutes, u.hours_this_week "
            "FROM users u LEFT JOIN user_preferences p ON p.id = 1 WHERE u.id = ?",
            (user_id,),
        ).fetchone()
        if not user_row:
            conn.close()
            return {"code": -1, "message": "User not found", "data": None}
        user = dict(user_row)
        user_stats = {
            "id": user["id"],
            "name": user["name"],
            "current_streak": user["current_streak"],
            "words_read_today": user["words_read_today"],
            "goal_minutes": user["goal_minutes"],
            "hours_this_week": user["hours_this_week"],
        }

        cont_book = None
        # Continue reading: prefer favorited, in-progress books with actual content
        prog_row = conn.execute(
            "SELECT id, title, author, cover_url, lexile_level, progress, total_chapters, current_chapter_index "
            "FROM library WHERE is_saved = 1 AND progress > 0 AND progress < 100 AND LENGTH(content) > 200 "
            "ORDER BY last_read_at DESC LIMIT 1"
        ).fetchone()
        if not prog_row:
            prog_row = conn.execute(
                "SELECT id, title, author, cover_url, lexile_level, progress, total_chapters, current_chapter_index "
                "FROM library WHERE progress > 0 AND progress < 100 AND LENGTH(content) > 200 "
                "ORDER BY last_read_at DESC LIMIT 1"
            ).fetchone()
        if prog_row:
            p = dict(prog_row)
            tc = p.get("total_chapters", 1) or 1
            cci = p.get("current_chapter_index", 0) or 0
            prog = p.get("progress", 0) or 0
            cont_book = {
                "id": p["id"],
                "title": p.get("title", "Untitled"),
                "author": p.get("author", "Unknown Author"),
                "cover_url": p.get("cover_url", ""),
                "lexile_level": p.get("lexile_level", 800),
                "description": "",
                "current_chapter": cci + 1,
                "total_chapters": tc,
                "progress_percentage": prog,
                "minutes_left": max(1, int((100 - prog) / 100 * 10)) if prog < 100 else 0,
            }

        # Recommendations: daily rotated, content-filtered
        today_seed = int(date.today().strftime("%Y%m%d"))
        rng = random.Random(today_seed)

        # Get all readable books from library
        all_rec_rows = conn.execute(
            "SELECT id, title, author, cover_url, lexile_level, source_type, is_saved "
            "FROM library WHERE LENGTH(content) > 200 "
            "ORDER BY last_read_at DESC LIMIT 50"
        ).fetchall()

        # Separate into favorites and others
        fav_rows = [r for r in all_rec_rows if r["is_saved"]]
        other_rows = [r for r in all_rec_rows if not r["is_saved"]]

        # Shuffle with today's seed for daily rotation
        rng.shuffle(fav_rows)
        rng.shuffle(other_rows)

        # Pick up to 5: favorited first, fill with others
        rec_rows = fav_rows[:5]
        if len(rec_rows) < 5:
            rec_rows.extend(other_rows[:5 - len(rec_rows)])

        RECOMMEND_REASONS = [
            "Continue your reading journey",
            "Picked for you",
            "Based on your interests",
            "Readers also enjoyed",
            "Editor's choice",
        ]
        recommendations = []
        for i, row in enumerate(rec_rows):
            b = dict(row)
            recommendations.append(
                {
                    "id": b.get("id"),
                    "title": b.get("title", "Untitled"),
                    "author": b.get("author", "Unknown Author"),
                    "cover_url": b.get("cover_url", ""),
                    "lexile_level": b.get("lexile_level", 800),
                    "description": b.get("source_type", ""),
                    "match_percentage": None,
                    "recommendation_reason": RECOMMEND_REASONS[i % len(RECOMMEND_REASONS)],
                    "predicted_read_time": None,
                }
            )

        articles = []
        art_rows = conn.execute(
            "SELECT id, title, author, lexile_level, created_at FROM library WHERE source_type='news' AND LENGTH(content) > 200 ORDER BY created_at DESC LIMIT 3"
        ).fetchall()
        for row in art_rows:
            a = dict(row)
            articles.append(
                {
                    "id": a.get("id"),
                    "title": a.get("title", "Untitled"),
                    "source": a.get("author", "BBC News"),
                    "lexile_level": a.get("lexile_level", 800),
                    "predicted_read_time": 8,
                    "created_at": a.get("created_at", ""),
                }
            )

        books_completed = conn.execute(
            "SELECT COUNT(*) as cnt FROM reading_progress WHERE user_id = ? AND progress_percentage >= 100",
            (user_id,),
        ).fetchone()["cnt"]
        vocab_count = conn.execute("SELECT COUNT(*) as cnt FROM vocabulary").fetchone()["cnt"]

        today_str = date.today().isoformat()
        week_start = date.today() - timedelta(days=date.today().weekday())
        last_week_start = week_start - timedelta(days=7)

        weekly_rows = conn.execute(
            "SELECT log_date, minutes_read, words_read, books_opened FROM daily_reading_log WHERE user_id = ? AND log_date >= ? ORDER BY log_date",
            (user_id, week_start.isoformat()),
        ).fetchall()

        weekly_chart = [0, 0, 0, 0, 0, 0, 0]
        week_total = 0.0
        week_books = 0
        week_words = 0
        today_minutes = 0.0
        for row in weekly_rows:
            r = dict(row)
            d = date.fromisoformat(r["log_date"])
            idx = d.weekday()
            if 0 <= idx < 7:
                weekly_chart[idx] = int(r["minutes_read"])
                week_total += r["minutes_read"]
                week_words += r["words_read"]
                week_books += r["books_opened"]
            if r["log_date"] == today_str:
                today_minutes = r["minutes_read"]

        last_week_rows = conn.execute(
            "SELECT COALESCE(SUM(minutes_read), 0) as total_minutes, COALESCE(SUM(words_read), 0) as total_words FROM daily_reading_log WHERE user_id = ? AND log_date >= ? AND log_date < ?",
            (user_id, last_week_start.isoformat(), week_start.isoformat()),
        ).fetchone()
        last_week_total = float(dict(last_week_rows)["total_minutes"]) if last_week_rows else 0.0
        last_week_words = int(dict(last_week_rows)["total_words"]) if last_week_rows else 0

        # ---- compute streak and today's words from daily_reading_log ----
        streak_rows = conn.execute(
            "SELECT log_date FROM daily_reading_log WHERE user_id = ? AND minutes_read > 0 ORDER BY log_date DESC LIMIT 366",
            (user_id,),
        ).fetchall()
        computed_streak = 0
        expected = date.today()
        for sr in streak_rows:
            d = date.fromisoformat(sr["log_date"]) if isinstance(sr["log_date"], str) else sr["log_date"]
            if d == expected:
                computed_streak += 1
                expected = expected - timedelta(days=1)
            elif d < expected:
                break
        today_words_log = conn.execute(
            "SELECT COALESCE(words_read, 0) as w FROM daily_reading_log WHERE user_id = ? AND log_date = ?",
            (user_id, today_str),
        ).fetchone()
        computed_words_today = today_words_log["w"] if today_words_log else 0
        user_stats["current_streak"] = computed_streak
        user_stats["words_read_today"] = computed_words_today
        user_stats["hours_this_week"] = round(week_total / 60.0, 1)
        # ----------------------------------------------------------------

        conn.close()

        # Sync users table with computed values
        try:
            sync_conn = get_db_connection()
            sync_conn.execute(
                "UPDATE users SET current_streak = ?, words_read_today = ?, hours_this_week = ? WHERE id = ?",
                (computed_streak, computed_words_today, round(week_total / 60.0, 1), user_id),
            )
            sync_conn.commit()
            sync_conn.close()
        except Exception:
            pass

        check_and_notify_daily_goal(user_id)
        check_and_notify_streak_milestone(user_id)
        check_and_notify_vocab_review(user_id)

        hours_delta = round(week_total / 60.0 - last_week_total / 60.0, 1)
        hours_delta_str = ("+" if hours_delta > 0 else "") + str(hours_delta) + "h from last week"
        books_delta = books_completed
        books_delta_str = str(books_completed) + " completed this month"
        words_delta = week_words - last_week_words
        words_delta_str = ("+" if words_delta > 0 else "") + str(words_delta) + " from last week"
        streak_str = str(user_stats["current_streak"]) + "-day streak"

        stats = {
            "books_read": books_completed,
            "time_this_week": str(round(week_total / 60.0, 1)) + "h",
            "day_streak": user_stats["current_streak"],
            "words_saved": vocab_count,
            "deltas": {
                "time_delta": hours_delta_str,
                "books_delta": books_delta_str,
                "words_delta": words_delta_str,
                "streak_delta": streak_str,
            },
        }

        goal_minutes = user_stats.get("goal_minutes", 0) or 0
        if goal_minutes > 0:
            goal_pct = min(100, max(0, int(today_minutes / goal_minutes * 100)))
        else:
            goal_pct = 0
        goal = {
            "progress_percent": goal_pct,
            "today_minutes": int(today_minutes),
            "goal_minutes": goal_minutes,
            "streak_days": user_stats["current_streak"],
            "cta_text": "Goal achieved — great work today!"
            if goal_pct >= 100
            else ("You're on track — keep going!"
            if goal_pct >= 70
            else ("Start reading today!" if goal_pct == 0 else "Just a bit more today!")),
            "sub_text": "Reading daily improves vocabulary retention by up to 40%.",
            "weekly_chart": weekly_chart,
        }

        return {
            "code": 0,
            "message": "ok",
            "data": {
                "user_stats": user_stats,
                "continue_reading": cont_book,
                "recommendations": recommendations,
                "articles": articles,
                "stats": stats,
                "goal": goal,
            },
        }
    except Exception as e:
        print(f"[HomeDashboard] Error: {e}")
        return {"code": -1, "message": str(e), "data": None}
