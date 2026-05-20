from datetime import datetime, timedelta
from io import StringIO
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from db import get_db_connection
from schemas import AddVocabularyRequest


class ReviewRequest(BaseModel):
    quality: int  # 1-4: 1=Again, 2=Hard, 3=Good, 4=Easy


def apply_sm2(interval_days: int, ease_factor: float, repetition_count: int, quality: int):
    if quality < 3:
        repetition_count = 0
        interval_days = 1
    else:
        if repetition_count == 0:
            interval_days = 1
        elif repetition_count == 1:
            interval_days = 6
        else:
            interval_days = round(interval_days * ease_factor)
        repetition_count += 1

    ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    if ef < 1.3:
        ef = 1.3

    next_review_at = (datetime.utcnow() + timedelta(days=interval_days)).strftime("%Y-%m-%d %H:%M:%S")

    return {
        "interval_days": interval_days,
        "ease_factor": round(ef, 2),
        "repetition_count": repetition_count,
        "next_review_at": next_review_at,
    }


router = APIRouter(prefix="/api/vocabulary", tags=["vocabulary"])


@router.get("")
async def get_vocabulary(request: Request):
    try:
        conn = get_db_connection()
        cursor = conn.execute(
            "SELECT * FROM vocabulary WHERE user_id = ? ORDER BY created_at DESC",
            (request.state.user_id,),
        )
        vocab_items = [dict(row) for row in cursor.fetchall()]

        word_items = [item for item in vocab_items if item.get("item_type") == "word"]
        sentence_items = [item for item in vocab_items if item.get("item_type") == "sentence"]

        word_total = len(word_items)
        word_mastered = sum(1 for item in word_items if item.get("is_mastered") == 1)

        sentence_total = len(sentence_items)
        sentence_mastered = sum(1 for item in sentence_items if item.get("is_mastered") == 1)

        conn.close()
        return {
            "vocabulary": vocab_items,
            "word_items": word_items,
            "sentence_items": sentence_items,
            "word_stats": {"total": word_total, "mastered": word_mastered},
            "sentence_stats": {"total": sentence_total, "mastered": sentence_mastered},
        }
    except Exception as e:
        print(f"Error fetching vocabulary: {e}")
        return {
            "vocabulary": [],
            "word_items": [],
            "sentence_items": [],
            "word_stats": {"total": 0, "mastered": 0},
            "sentence_stats": {"total": 0, "mastered": 0},
        }


@router.post("")
async def add_vocabulary(request: Request, item: AddVocabularyRequest):
    text = item.text.strip()
    item_type = item.item_type if item.item_type in ("word", "sentence") else "word"

    if not text:
        raise HTTPException(status_code=400, detail="text cannot be empty")

    try:
        conn = get_db_connection()
        conn.execute(
            """INSERT INTO vocabulary (user_id, text, translation, context, item_type, book_title, chapter_title)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id, text)
               DO UPDATE SET translation = excluded.translation,
                             context = excluded.context,
                             item_type = excluded.item_type,
                             book_title = excluded.book_title,
                             chapter_title = excluded.chapter_title,
                             created_at = CURRENT_TIMESTAMP""",
            (request.state.user_id, text, item.translation, item.context, item_type, item.book_title, item.chapter_title),
        )
        conn.commit()

        cursor = conn.execute(
            "SELECT * FROM vocabulary WHERE user_id = ? AND text = ?",
            (request.state.user_id, text),
        )
        record = dict(cursor.fetchone())
        conn.close()
        return {"id": record["id"], "message": "Vocabulary saved successfully"}
    except Exception as e:
        print(f"Error adding vocabulary: {e}")
        raise HTTPException(status_code=500, detail="Failed to add vocabulary")


@router.get("/check/{word}")
async def check_vocabulary(request: Request, word: str):
    try:
        conn = get_db_connection()
        cursor = conn.execute(
            "SELECT * FROM vocabulary WHERE user_id = ? AND text = ?",
            (request.state.user_id, word.lower()),
        )
        result = cursor.fetchone()
        conn.close()
        return {"exists": result is not None, "data": dict(result) if result else None}
    except Exception as e:
        print(f"Error checking vocabulary: {e}")
        return {"exists": False, "data": None}


@router.delete("/word/{word}")
async def delete_vocabulary_by_word(request: Request, word: str):
    try:
        conn = get_db_connection()
        cursor = conn.execute(
            "DELETE FROM vocabulary WHERE user_id = ? AND text = ?",
            (request.state.user_id, word.lower()),
        )
        conn.commit()
        deleted = cursor.rowcount > 0
        conn.close()
        if deleted:
            return {"message": "Vocabulary deleted successfully"}
        raise HTTPException(status_code=404, detail="Word not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting vocabulary: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete vocabulary")


@router.delete("/{id}")
async def delete_vocabulary(request: Request, id: int):
    try:
        conn = get_db_connection()
        cursor = conn.execute("DELETE FROM vocabulary WHERE id = ?", (id,))
        conn.commit()
        deleted = cursor.rowcount > 0
        conn.close()
        if deleted:
            return {"message": "Vocabulary deleted successfully"}
        raise HTTPException(status_code=404, detail="Vocabulary not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting vocabulary: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete vocabulary")


@router.put("/{id}/toggle-mastered")
async def toggle_vocabulary_mastered(request: Request, id: int):
    try:
        conn = get_db_connection()
        row = conn.execute(
            "SELECT * FROM vocabulary WHERE id = ? AND user_id = ?",
            (id, request.state.user_id),
        ).fetchone()
        if row is None:
            conn.close()
            raise HTTPException(status_code=404, detail="Vocabulary not found")

        current = row["is_mastered"] if row["is_mastered"] is not None else 0
        new_value = 1 if current == 0 else 0
        conn.execute(
            "UPDATE vocabulary SET is_mastered = ? WHERE id = ? AND user_id = ?",
            (new_value, id, request.state.user_id),
        )
        conn.commit()

        updated = conn.execute(
            "SELECT * FROM vocabulary WHERE id = ? AND user_id = ?",
            (id, request.state.user_id),
        ).fetchone()
        conn.close()
        return dict(updated)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error toggling vocabulary master status: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle master status")


@router.get("/review/due")
async def get_review_due(request: Request, limit: Optional[int] = 50):
    try:
        conn = get_db_connection()
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        cursor = conn.execute(
            """SELECT * FROM vocabulary
               WHERE user_id = ? AND item_type = 'word'
                 AND (next_review_at IS NULL OR next_review_at <= ?)
               ORDER BY next_review_at IS NULL DESC, next_review_at ASC
               LIMIT ?""",
            (request.state.user_id, now, limit),
        )
        items = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return {"due_items": items, "due_count": len(items)}
    except Exception as e:
        print(f"Error fetching review due items: {e}")
        return {"due_items": [], "due_count": 0}


@router.post("/review/{id}")
async def submit_review(request: Request, id: int, review: ReviewRequest):
    quality = review.quality
    if quality < 1 or quality > 4:
        raise HTTPException(status_code=400, detail="Quality must be between 1 and 4")

    try:
        conn = get_db_connection()
        row = conn.execute(
            "SELECT * FROM vocabulary WHERE id = ? AND user_id = ?",
            (id, request.state.user_id),
        ).fetchone()
        if row is None:
            conn.close()
            raise HTTPException(status_code=404, detail="Vocabulary not found")

        interval_days = row["interval_days"] if row["interval_days"] is not None else 0
        ease_factor = row["ease_factor"] if row["ease_factor"] is not None else 2.5
        repetition_count = row["repetition_count"] if row["repetition_count"] is not None else 0

        srs = apply_sm2(interval_days, ease_factor, repetition_count, quality)
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        conn.execute(
            """UPDATE vocabulary
               SET interval_days = ?, ease_factor = ?, repetition_count = ?,
                   next_review_at = ?, last_reviewed_at = ?, is_mastered = ?
               WHERE id = ? AND user_id = ?""",
            (
                srs["interval_days"], srs["ease_factor"], srs["repetition_count"],
                srs["next_review_at"], now,
                1 if srs["repetition_count"] >= 5 else row["is_mastered"],
                id, request.state.user_id,
            ),
        )
        conn.commit()

        updated = conn.execute(
            "SELECT * FROM vocabulary WHERE id = ? AND user_id = ?",
            (id, request.state.user_id),
        ).fetchone()
        conn.close()
        return dict(updated)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error submitting review: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit review")


@router.get("/review/stats")
async def get_review_stats(request: Request):
    try:
        conn = get_db_connection()
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        due = conn.execute(
            """SELECT COUNT(*) as cnt FROM vocabulary
               WHERE user_id = ? AND item_type = 'word'
                 AND (next_review_at IS NULL OR next_review_at <= ?)""",
            (request.state.user_id, now),
        ).fetchone()["cnt"]

        learning = conn.execute(
            """SELECT COUNT(*) as cnt FROM vocabulary
               WHERE user_id = ? AND item_type = 'word'
                 AND next_review_at IS NOT NULL AND repetition_count < 3""",
            (request.state.user_id,),
        ).fetchone()["cnt"]

        mature = conn.execute(
            """SELECT COUNT(*) as cnt FROM vocabulary
               WHERE user_id = ? AND item_type = 'word'
                 AND repetition_count >= 3""",
            (request.state.user_id,),
        ).fetchone()["cnt"]

        total_words = conn.execute(
            "SELECT COUNT(*) as cnt FROM vocabulary WHERE user_id = ? AND item_type = 'word'",
            (request.state.user_id,),
        ).fetchone()["cnt"]

        conn.close()
        return {
            "due": due,
            "learning": learning,
            "mature": mature,
            "total_words": total_words,
        }
    except Exception as e:
        print(f"Error fetching review stats: {e}")
        return {"due": 0, "learning": 0, "mature": 0, "total_words": 0}


@router.get("/export")
async def export_vocabulary(request: Request, format: str = "anki", type: str = "word"):
    print(f"[export] format={format} type={type}")
    try:
        conn = get_db_connection()
        if type == "all":
            cursor = conn.execute(
                "SELECT * FROM vocabulary WHERE user_id = ? ORDER BY text ASC",
                (request.state.user_id,),
            )
        else:
            cursor = conn.execute(
                "SELECT * FROM vocabulary WHERE user_id = ? AND item_type = ? ORDER BY text ASC",
                (request.state.user_id, type),
            )
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()

        output = StringIO()

        if format == "anki":
            output.write("#separator:tab\n")
            output.write("#html:true\n")
            output.write("#columns:Front\tBack\tTags\n")
            for item in rows:
                front = item["text"].replace("\t", " ").replace("\n", " ")
                back_parts = [item["translation"].replace("\t", " ").replace("\n", " ")]
                if item["context"]:
                    back_parts.append('<br><br><i>"' + item["context"].replace("\t", " ").replace("\n", " ") + '"</i>')
                back = "".join(back_parts)
                tags = ["RippleRead"]
                if item["book_title"]:
                    tags.append(item["book_title"].replace(" ", "_"))
                output.write("\t".join([front, back, " ".join(tags)]) + "\n")
            filename = "rippleread_anki.csv"
        else:
            output.write("Word,Translation,Context,Source,Mastered\n")
            for item in rows:
                source = ""
                if item["book_title"]:
                    source = item["book_title"]
                    if item["chapter_title"]:
                        source += " / " + item["chapter_title"]
                row_line = ",".join([
                    _csv_escape(item["text"]),
                    _csv_escape(item["translation"]),
                    _csv_escape(item["context"] or ""),
                    _csv_escape(source),
                    "Yes" if item["is_mastered"] == 1 else "No",
                ])
                output.write(row_line + "\n")
            filename = "rippleread_vocabulary.csv"

        content = output.getvalue()
        output.close()

        return Response(
            content=content.encode("utf-8-sig"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        print(f"Error exporting vocabulary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export vocabulary: {str(e)}")


def _csv_escape(value: str) -> str:
    v = value.replace('"', '""')
    if "," in v or '"' in v or "\n" in v or "\t" in v:
        return '"' + v + '"'
    return v
