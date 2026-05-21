from fastapi import APIRouter, Query, Request

from ..db import get_db_connection
from ..services.search_service import search_library, search_books, search_vocabulary

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search")
async def search(q: str = Query("", min_length=1, description="搜索关键词"), request: Request = None):
    try:
        conn = get_db_connection()
        library = search_library(conn, q)
        books = search_books(conn, q)
        vocabulary = search_vocabulary(conn, q, user_id=request.state.user_id if request else None)
        conn.close()
        return {
            "code": 0,
            "data": {
                "library": library,
                "books": books,
                "vocabulary": vocabulary,
            },
        }
    except Exception as e:
        print(f"[Search] Error: {e}")
        return {"code": -1, "message": str(e), "data": None}
