from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, Request

from db import get_db_connection


router = APIRouter(prefix="/api/statistics", tags=["statistics"])


@router.get("/summary")
async def get_statistics_summary(request: Request, days: int = Query(default=90, ge=1, le=365)):
    try:
        conn = get_db_connection()
        user_id = request.state.user_id

        total_books_read = conn.execute(
            "SELECT COUNT(*) FROM library WHERE progress = 100 AND user_id = ?",
            (user_id,)
        ).fetchone()[0]

        total_vocab_mastered = conn.execute(
            "SELECT COUNT(*) FROM vocabulary WHERE is_mastered = 1 AND item_type = 'word' AND user_id = ?",
            (user_id,)
        ).fetchone()[0]

        total_sentence_mastered = conn.execute(
            "SELECT COUNT(*) FROM vocabulary WHERE is_mastered = 1 AND item_type = 'sentence' AND user_id = ?",
            (user_id,)
        ).fetchone()[0]

        row = conn.execute(
            "SELECT AVG(lexile_level) FROM library WHERE progress > 0 AND user_id = ?",
            (user_id,)
        ).fetchone()
        avg_lexile_level = round(row[0], 1) if row[0] is not None else 0.0

        today = datetime.utcnow().date()
        start_date = today - timedelta(days=days - 1)

        rows = conn.execute(
            """SELECT d, SUM(cnt) as cnt FROM (
                   SELECT DATE(created_at) as d, COUNT(*) as cnt
                   FROM vocabulary
                   WHERE DATE(created_at) >= ? AND user_id = ?
                   GROUP BY d
                   UNION ALL
                   SELECT DATE(last_read_at) as d, COUNT(*) as cnt
                   FROM library
                   WHERE DATE(last_read_at) >= ? AND user_id = ?
                   GROUP BY d
               ) GROUP BY d ORDER BY d ASC""",
            (start_date.isoformat(), user_id, start_date.isoformat(), user_id),
        ).fetchall()

        date_counts = {}
        for row in rows:
            date_counts[row[0]] = row[1]

        heatmap = []
        current = start_date
        while current <= today:
            iso = current.isoformat()
            heatmap.append({
                "date": iso,
                "count": date_counts.get(iso, 0),
            })
            current += timedelta(days=1)

        conn.close()

        return {
            "total_books_read": total_books_read,
            "total_vocab_mastered": total_vocab_mastered,
            "total_sentence_mastered": total_sentence_mastered,
            "avg_lexile_level": avg_lexile_level,
            "heatmap": heatmap,
        }
    except Exception as e:
        print(f"Error fetching statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch statistics")
