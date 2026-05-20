# RippleRead Refactor Plan

The first cleanup pass keeps behavior stable and removes the highest-risk
configuration issue. The next passes can split the large backend file without
changing the public API.

## Current State

- `main.py` owns the FastAPI app, route handlers, news fetching, ebook parsing,
  AI prompt construction, and persistence helpers.
- Frontend pages are plain HTML/CSS/JavaScript files served from the repository
  root.
- Runtime secrets are now read through `app_config.py`.

## Recommended Backend Split

1. Move request/response models into `schemas.py`. Started for settings and vocabulary.
2. Move shared database helpers into `db.py` or expand `database.py`. Started with `db.py`.
3. Create `services/` for side-effecting logic:
   - `services/news_service.py`
   - `services/ebook_service.py`
   - `services/ai_service.py`
   - `services/library_service.py`
4. Create `routers/` grouped by feature:
   - `routers/ai.py`
   - `routers/library.py`
   - `routers/books.py`
   - `routers/vocabulary.py` - done
   - `routers/statistics.py` - done
   - `routers/settings.py` - done
   - `routers/explore.py`
5. Keep `main.py` small:
   - create the FastAPI app
   - install middleware
   - include routers
   - mount static files
   - run startup initialization

## Recommended Frontend Split

- Keep `sidebar.html/js` as the shared shell.
- Move page-specific assets into `frontend/pages/<page>/` after backend route
  tests are in place.
- Keep static asset names stable while moving files, or update all links in one
  pass with browser verification.

## Verification Before Larger Moves

- Add smoke tests for the API endpoints used by each page.
- Verify that `reader.html`, `library.html`, `book_library.html`,
  `vocabulary.html`, `statistics.html`, and `explore.html` still load after any
  route split.
- Run a no-key mode test to confirm local fallback behavior still works.
