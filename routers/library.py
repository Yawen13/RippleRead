import asyncio
import json
import os
import re
from typing import Optional

import requests
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Query, Request, UploadFile, File
from pydantic import BaseModel

from core.text_utils import calculate_lexile
from db import get_db_connection
from schemas import UpdateProgressRequest
from services.ebook_service import parse_epub, _parse_txt
from services.library_service import (
    get_library,
    get_library_saved,
    get_library_recent,
    delete_library_item,
    update_progress,
    get_book_content,
    toggle_favorite,
    rechunk_book,
    normalize_library_row,
)
from services.news_service import fetch_news, fetch_news_to_library
from services.notification_service import check_and_notify_book_finished, check_and_notify_news_fetched

router = APIRouter(tags=["library"])


@router.get("/api/news")
async def news_route(category: Optional[str] = Query(default='general', description='News category: general, technology, business, science, sports')):
    VALID_CATEGORIES = {'general', 'technology', 'business', 'science', 'sports'}
    if category not in VALID_CATEGORIES:
        category = 'general'
    articles, source_used, errors = await asyncio.to_thread(fetch_news, category)
    return {
        "news": articles,
        "source": source_used,
        "category": category,
        "total": len(articles),
    }


@router.post("/api/fetch-news")
async def fetch_news_route(request: Request, category: Optional[str] = Query(default='general', description='News category')):
    VALID_CATEGORIES = {'general', 'technology', 'business', 'science', 'sports'}
    if category not in VALID_CATEGORIES:
        category = 'general'
    articles, errors = await asyncio.to_thread(fetch_news_to_library, category)
    inserted = 0
    sources = set()
    try:
        conn = get_db_connection()
        for article in articles:
            content = article.get('content', article.get('description', ''))
            if not content:
                continue
            conn.execute(
                '''INSERT OR IGNORE INTO library (user_id, title, author, content, source_type, lexile_level, progress, cover_url, created_at, is_saved, last_read_at, category)
                   VALUES (?, ?, ?, ?, 'news', ?, 0, NULL, CURRENT_TIMESTAMP, 0, NULL, ?)''',
                (request.state.user_id, article['title'], article['source'], content, article.get('lexile', 400), article.get('category', category))
            )
            if conn.total_changes > inserted:
                inserted += 1
                sources.add(article.get('source', 'Unknown'))
        conn.commit()
        conn.close()
    except Exception as e:
        errors.append(f"DB insert error: {e}")
    if inserted > 0:
        check_and_notify_news_fetched(inserted)
    return {
        "message": f"Successfully fetched {inserted} news articles",
        "source": "bbc_nyt_rss" if not errors or articles else "fallback",
        "category": category,
        "inserted": inserted,
    }


@router.get("/api/news/library")
async def news_library_route(request: Request, category: Optional[str] = Query(default=None, description='Filter by category: general, technology, business, science, sports')):
    try:
        conn = get_db_connection()
        user_id = request.state.user_id
        if category:
            rows = conn.execute(
                "SELECT id, title, author, source_type, lexile_level, progress, cover_url, is_saved, last_read_at, created_at, current_chapter_index, total_chapters, category, source_book_id FROM library WHERE source_type = 'news' AND category = ? AND user_id = ? ORDER BY created_at DESC LIMIT 50",
                (category, user_id)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, title, author, source_type, lexile_level, progress, cover_url, is_saved, last_read_at, created_at, current_chapter_index, total_chapters, category, source_book_id FROM library WHERE source_type = 'news' AND user_id = ? ORDER BY created_at DESC LIMIT 50",
                (user_id,)
            ).fetchall()
        conn.close()
        articles = [normalize_library_row(dict(row)) for row in rows]
        return {
            "news": articles,
            "category": category,
            "total": len(articles),
        }
    except Exception as e:
        print(f"Error fetching news library: {e}")
        return {"news": [], "category": category, "total": 0}


@router.get("/api/library")
async def library_route(request: Request):
    try:
        return get_library(request.state.user_id)
    except Exception as e:
        print(f"Error fetching library: {e}")
        return []


@router.get("/api/library/saved")
async def library_saved_route(request: Request):
    try:
        return get_library_saved(request.state.user_id)
    except Exception as e:
        print(f"Error fetching saved library: {e}")
        return []


@router.get("/api/library/recent")
async def library_recent_route(request: Request):
    try:
        return get_library_recent(request.state.user_id)
    except Exception as e:
        print(f"Error fetching recent library: {e}")
        return None


@router.delete("/api/library/{item_id}")
async def library_delete_route(item_id: int, request: Request):
    try:
        deleted = delete_library_item(item_id, request.state.user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"message": "Item deleted successfully", "id": item_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DeleteLibrary] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete item")


@router.put("/api/library/{item_id}/favorite")
async def library_favorite_route(item_id: int, request: Request):
    try:
        result = toggle_favorite(item_id, request.state.user_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"code": 0, "message": "ok", "data": result}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Favorite] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle favorite")


@router.post("/api/library/{item_id}/rechunk")
async def library_rechunk_route(item_id: int, request: Request):
    try:
        result = rechunk_book(item_id, request.state.user_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"code": 0, "message": result.get("message", "ok"), "data": result}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Rechunk] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to re-split chapters")


@router.put("/api/library/{item_id}/progress")
@router.post("/api/library/{item_id}/progress")
async def progress_route(request: Request, item_id: int, body: UpdateProgressRequest):
    try:
        result, error = update_progress(item_id, body, request.state.user_id)
        if error:
            raise HTTPException(status_code=404, detail=error)
        if body.progress >= 100:
            conn = get_db_connection()
            book = conn.execute("SELECT title FROM library WHERE id = ? AND user_id = ?", (item_id, request.state.user_id)).fetchone()
            conn.close()
            if book:
                check_and_notify_book_finished(request.state.user_id, item_id, book["title"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[UpdateProgress] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update progress")


@router.get("/api/read/{book_id}")
async def read_route(book_id: int, request: Request):
    try:
        book = get_book_content(book_id, request.state.user_id)
        if book:
            return book
        raise HTTPException(status_code=404, detail="Book not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching book content: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch book content")


@router.post("/api/upload-book")
async def upload_book(request: Request, file: UploadFile = File(...)):
    filename = file.filename or "untitled"
    if not filename:
        raise HTTPException(status_code=400, detail="No file provided")

    suffix = os.path.splitext(filename)[1].lower()
    if suffix not in (".txt", ".epub"):
        raise HTTPException(status_code=400, detail="Only .txt and .epub files are supported")

    await file.seek(0)
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    print(f"--- 收到文件: {file.filename}, 大小: {len(content)} bytes ---")

    if suffix == ".txt":
        full_text = _parse_txt(content)
        content_to_store = full_text
        total_chapters = 0
        current_chapter_index = 0
    elif suffix == ".epub":
        chapters = parse_epub(content)
        full_text = '\n\n'.join(ch['content'] for ch in chapters)
        content_to_store = json.dumps(chapters, ensure_ascii=False)
        total_chapters = len(chapters)
        current_chapter_index = 0

    print(f"解析出文本前 50 个字符: {full_text[:50]}")

    if not full_text or not full_text.strip():
        raise HTTPException(status_code=400, detail="File appears to be empty or unreadable")

    word_count = len(full_text.split())
    if word_count < 50:
        print(f"[UploadBook] 文本过短 ({word_count} 词)，使用默认蓝思值 500")
        lexile_level = 500
    else:
        lexile_level = calculate_lexile(full_text)

    title = os.path.splitext(filename)[0]

    try:
        conn = get_db_connection()
        conn.execute(
            '''INSERT INTO library (user_id, title, author, content, source_type, lexile_level, progress, cover_url, is_saved, created_at, last_read_at, current_chapter_index, total_chapters)
               VALUES (?, ?, '', ?, 'local', ?, 0, NULL, 0, CURRENT_TIMESTAMP, NULL, ?, ?)''',
            (request.state.user_id, title, content_to_store, lexile_level, current_chapter_index, total_chapters)
        )
        conn.commit()
        book_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        conn.close()
    except Exception as e:
        print(f"[UploadBook] DB insert error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save book to database")

    return {
        "id": book_id,
        "title": title,
        "lexile_level": lexile_level,
        "source_type": "local",
        "message": "Book imported successfully",
        "total_chapters": total_chapters,
    }


class ImportURLRequest(BaseModel):
    url: str
    title: str = ""


@router.post("/api/import/url")
async def import_url_route(request: Request, body: ImportURLRequest):
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    user_title = body.title.strip()

    try:
        resp = requests.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }, timeout=15)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.content, "lxml")

        if not user_title:
            title_tag = soup.find("title")
            if title_tag:
                user_title = title_tag.get_text(strip=True)
            else:
                user_title = url
            if len(user_title) > 150:
                user_title = user_title[:147] + "..."

        paragraphs = []
        article_tag = soup.find("article")
        search_root = article_tag if article_tag else soup

        for p in search_root.find_all("p"):
            text = p.get_text(strip=True)
            if len(text) > 40:
                low = text.lower()
                if any(x in low for x in [
                    "cookie", "subscribe", "advertisement", "all rights reserved",
                    "click here", "sign up", "newsletter", "related articles",
                    "share this", "follow us", "terms of use", "privacy policy",
                    "you may also like", "sponsored content", "recommended for you",
                ]):
                    continue
                paragraphs.append(text)

        if not paragraphs:
            raise HTTPException(status_code=400, detail="No readable content found. Try a different URL.")

        full_text = "\n\n".join(paragraphs)
        full_text = re.sub(r"\n{3,}", "\n\n", full_text)
        full_text = re.sub(r" {2,}", " ", full_text)

        if len(full_text) > 15000:
            full_text = full_text[:15000]

        lexile_level = calculate_lexile(full_text)

        conn = get_db_connection()
        conn.execute(
            """INSERT INTO library (user_id, title, author, content, source_type, lexile_level, progress,
               cover_url, is_saved, created_at, last_read_at, current_chapter_index, total_chapters)
               VALUES (?, ?, 'URL Import', ?, 'local', ?, 0, NULL, 0, CURRENT_TIMESTAMP, NULL, 0, 0)""",
            (request.state.user_id, user_title, full_text, lexile_level),
        )
        conn.commit()
        library_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()

        print(f"[ImportURL] Imported '{user_title}' -> library_id={library_id}, lexile={lexile_level}")

        return {
            "code": 0,
            "message": "URL imported successfully",
            "library_id": library_id,
            "title": user_title,
            "lexile_level": lexile_level,
        }
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach this URL: {e}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ImportURL] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
