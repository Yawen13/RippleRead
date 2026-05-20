from fastapi import APIRouter, Query

from db import get_db_connection
from services.library_service import normalize_library_row

router = APIRouter(prefix="/api/explore", tags=["explore"])


@router.get("/feed")
async def explore_feed(lexile: int = Query(..., description="User's current Lexile level")):
    try:
        conn = get_db_connection()
        rows = conn.execute(
            'SELECT id, title, author, source_type, lexile_level, progress, cover_url, is_saved, last_read_at, created_at, current_chapter_index, total_chapters, category, source_book_id FROM library WHERE source_type = ? ORDER BY created_at DESC LIMIT 30',
            ('news',)
        ).fetchall()
        conn.close()

        articles = []
        for row in rows:
            article = normalize_library_row(dict(row))
            content = article.get("content", "")

            art_lexile = article.get("lexile_level") or 400
            if isinstance(art_lexile, str):
                try:
                    art_lexile = int(art_lexile)
                except ValueError:
                    art_lexile = 400

            gap = art_lexile - lexile
            is_optimal_challenge = 10 <= gap <= 50

            articles.append({
                "id": article.get("id"),
                "title": article.get("title", ""),
                "author": article.get("author", ""),
                "lexile_level": art_lexile,
                "user_lexile": lexile,
                "difficulty_gap": gap,
                "is_optimal_challenge": is_optimal_challenge,
                "content": content,
                "source_type": article.get("source_type", "news"),
                "cover_url": article.get("cover_url"),
                "created_at": article.get("created_at"),
            })

        return {
            "code": 200,
            "message": "success",
            "data": {
                "articles": articles,
                "user_lexile": lexile,
                "total": len(articles),
            }
        }
    except Exception as e:
        print(f"Error in explore_feed: {e}")
        return {
            "code": 500,
            "message": f"Failed to fetch explore feed: {str(e)}",
            "data": {"articles": [], "user_lexile": lexile, "total": 0},
        }
