import os
import jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .database import init_database
from .config import JWT_SECRET, JWT_ALGORITHM

from .routers.settings import router as settings_router
from .routers.statistics import router as statistics_router
from .routers.vocabulary import router as vocabulary_router
from .routers.ai import router as ai_router
from .routers.library import router as library_router
from .routers.books import router as books_router
from .routers.explore import router as explore_router
from .routers.search import router as search_router
from .routers.notifications import router as notifications_router
from .routers.auth import router as auth_router
from .routers.deploy import router as deploy_router

app = FastAPI()


@app.on_event("startup")
def startup_event():
    init_database()


# ── Auth middleware ──
PUBLIC_API_PREFIXES = ("/api/auth/", "/api/deploy")
PUBLIC_PATH_PREFIXES = (
    "/login.html", "/login", "/api/auth/",
    "/tailwind.css", "/style.css", "/home.css", "/library.css",
    "/book_library.css", "/explore.css", "/news.css", "/notebook.css",
    "/RippleReadLOGO", "/favicon",
)

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path

    # Let OPTIONS (CORS preflight) through
    if request.method == "OPTIONS":
        return await call_next(request)

    # Skip auth for non-API paths
    if not path.startswith("/api/"):
        return await call_next(request)

    # Skip auth for public API routes
    for prefix in PUBLIC_API_PREFIXES:
        if path.startswith(prefix):
            return await call_next(request)

    # Check authorization header
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Authentication required"})

    try:
        token = auth[7:]
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        request.state.user_id = int(payload["sub"])
    except jwt.ExpiredSignatureError:
        return JSONResponse(status_code=401, content={"detail": "Token has expired"})
    except jwt.InvalidTokenError:
        return JSONResponse(status_code=401, content={"detail": "Invalid token"})

    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──
app.include_router(auth_router)
app.include_router(settings_router)
app.include_router(statistics_router)
app.include_router(vocabulary_router)
app.include_router(ai_router)
app.include_router(library_router)
app.include_router(books_router)
app.include_router(explore_router)
app.include_router(search_router)
app.include_router(notifications_router)
app.include_router(deploy_router)


@app.get("/")
async def read_index():
    return FileResponse("templates/index.html")


app.mount("/static", StaticFiles(directory="static", html=False), name="static")
app.mount("/", StaticFiles(directory="templates", html=True), name="templates")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

# Start server entry point
def start():
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("app.main:app", host=host, port=port, log_level="info")
