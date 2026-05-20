# RippleRead

RippleRead is a local reading companion for English learners. It combines a
FastAPI backend, SQLite storage, and multi-page HTML/CSS/JavaScript frontend.

## Project Layout

- `main.py` - FastAPI app, remaining API routes, and static file serving.
- `database.py` - SQLite schema initialization and lightweight migrations.
- `db.py` - Shared SQLite connection helper for feature routers.
- `app_config.py` - Runtime configuration and secret loading.
- `core/lexile_engine.py` - User preference driven Lexile and AI prompt context.
- `routers/` - Split FastAPI routers for settings, statistics, and vocabulary.
- `schemas.py` - Shared Pydantic request models for extracted routers.
- `index.html`, `reader.html`, `library.html`, `book_library.html`,
  `vocabulary.html`, `statistics.html`, `explore.html` - Frontend pages.
- `sidebar.html`, `sidebar.js` - Shared navigation, settings, and profile UI.
- `scripts/fetch_gutenberg.py` - Utility for importing public-domain book data.
- `rippleread.db` - Local SQLite database, ignored by git for new clones.

## Setup

1. Create and activate a Python virtual environment.
2. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

3. Configure DeepSeek credentials with either an environment variable:

   ```powershell
   $env:DEEPSEEK_API_KEY="your_key_here"
   ```

   or a local `config.json` copied from `config.example.json`.

4. Start the app:

   ```powershell
   python start_server.py
   ```

5. Open `http://127.0.0.1:8001`.

## Notes

- Do not commit `config.json`, `.env`, or `rippleread.db`.
- The backend is being split gradually. Settings, statistics, and vocabulary
  routes already live in `routers/`; larger AI, reader, library, and news
  routes remain in `main.py`.
