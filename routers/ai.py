import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app_config import DEEPSEEK_API_KEY
from schemas import TranslationRequest, CompanionChatRequest, ChapterInsightsRequest, WeaverRequest, WeaverSaveRequest
from services.ai_service import (
    translate_word,
    translate_batch,
    get_mindmap,
    simplify_content,
    generate_summary,
    analyze_sentence,
    companion_chat,
    chapter_insights,
    get_chat_history,
    generate_weaver_stream,
    weaver_save as save_weaver,
)
from services.notification_service import check_and_notify_weaver_ready

router = APIRouter(prefix="/api", tags=["ai"])


@router.post("/translate")
async def translate_route(request: TranslationRequest):
    return translate_word(request.word)


@router.post("/translate-batch")
async def translate_batch_route(request: dict):
    words = request.get("words", [])
    if not words:
        return {}
    return translate_batch(words)


@router.post("/mindmap")
async def mindmap_route(request: TranslationRequest):
    return get_mindmap(request.word)


@router.post("/simplify")
async def simplify_route(request: dict):
    content = request.get("content", "")
    target_level = request.get("target_level", None)
    return simplify_content(content, target_level)


@router.post("/summary")
async def summary_route(request: dict):
    content = request.get("content", "")
    return generate_summary(content)


@router.post("/analyze-sentence")
async def analyze_sentence_route(request: dict):
    sentence = request.get("sentence", "")
    return analyze_sentence(sentence)


@router.post("/ai/companion_chat")
async def companion_chat_route(request: CompanionChatRequest, req: Request):
    return companion_chat(
        user_id=req.state.user_id,
        book_id=request.book_id,
        current_chapter_index=request.current_chapter_index,
        target_chapter_index=request.target_chapter_index,
        action=request.action,
        message=request.message,
    )


@router.post("/ai/chapter_insights")
async def chapter_insights_route(request: ChapterInsightsRequest):
    return chapter_insights(
        book_id=request.book_id,
        chapter_index=request.chapter_index,
    )


@router.get("/ai/companion_chat/history/{book_id}")
async def chat_history_route(book_id: int, request: Request, chapter_index: int = 0):
    return get_chat_history(request.state.user_id, book_id, chapter_index)


@router.post("/explore/weaver")
async def ai_weaver(request: WeaverRequest):
    words = [w.strip().lower() for w in request.words if w.strip()]
    if not words:
        return {
            "code": 400,
            "message": "At least one word is required",
            "data": None,
        }

    if not DEEPSEEK_API_KEY:
        async def error_stream():
            yield f"data: {json.dumps({'error': 'AI service not configured. Please set your DeepSeek API key.'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    target_lexile = request.target_lexile
    if target_lexile < 200:
        target_lexile = 400
    if target_lexile > 1400:
        target_lexile = 1300

    word_count = request.word_count if request.word_count else 400

    stream = generate_weaver_stream(words, target_lexile, word_count)
    return StreamingResponse(stream, media_type="text/event-stream")


@router.post("/explore/weaver/save")
async def weaver_save_route(request: WeaverSaveRequest, req: Request):
    if not request.title or not request.content:
        return {
            "code": 400,
            "message": "Title and content are required",
            "data": None,
        }
    try:
        book_id = save_weaver(request.title, request.content, request.lexile_level, req.state.user_id)
        check_and_notify_weaver_ready(req.state.user_id, request.title, book_id)
        return {
            "code": 200,
            "message": "success",
            "data": {"id": book_id, "title": request.title},
        }
    except Exception as e:
        print(f"[WeaverSave] Error: {e}")
        return {
            "code": 500,
            "message": f"Failed to save: {str(e)}",
            "data": None,
        }
