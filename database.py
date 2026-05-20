import sqlite3
import os
import bcrypt
from datetime import date, timedelta


def _migrate_add_column(cursor, table, col_name, col_type):
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}")
        return True
    except sqlite3.OperationalError:
        return False


def init_database():
    db_path = 'rippleread.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("PRAGMA foreign_keys = ON")

    # ── Check if this is a brand new database ──
    tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    table_names = [t[0] for t in tables]
    is_new_db = len(table_names) == 0

    # ── Check if migration already ran ──
    needs_migration = False
    if not is_new_db:
        col_check = cursor.execute("PRAGMA table_info(users)").fetchall()
        col_names = [c[1] for c in col_check]
        needs_migration = 'username' not in col_names

    if needs_migration:
        print("[DB] Running user system migration...")

        # Backup old user data
        old_user = None
        try:
            old_user = cursor.execute("SELECT id, name, current_streak, words_read_today, goal_minutes, hours_this_week FROM users WHERE id = 1").fetchone()
        except Exception:
            pass

        # Drop old users table and recreate
        try:
            cursor.execute("DROP TABLE IF EXISTS users")
        except Exception:
            pass

        cursor.execute('''
            CREATE TABLE users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT NOT NULL UNIQUE,
                email         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                name          TEXT NOT NULL DEFAULT '',
                avatar_url    TEXT,
                current_streak    INTEGER NOT NULL DEFAULT 0,
                words_read_today  INTEGER NOT NULL DEFAULT 0,
                goal_minutes      INTEGER NOT NULL DEFAULT 30,
                hours_this_week   REAL NOT NULL DEFAULT 0,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login_at TIMESTAMP
            )
        ''')

        # Create default admin user
        default_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt(rounds=12)).decode()
        old_name = old_user[1] if old_user else 'Explorer'
        old_streak = old_user[2] if old_user else 7
        old_words = old_user[3] if old_user else 23
        old_goal = old_user[4] if old_user else 30
        old_hours = old_user[5] if old_user else 0

        cursor.execute(
            '''INSERT INTO users (id, username, email, password_hash, name, current_streak, words_read_today, goal_minutes, hours_this_week)
               VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)''',
            ('admin', 'admin@rippleread.local', default_hash, old_name, old_streak, old_words, old_goal, old_hours)
        )

        # Migrate user_preferences - drop CHECK(id=1) constraint
        try:
            col_info = cursor.execute("PRAGMA table_info(user_preferences)").fetchall()
            pref_cols = {c[1]: c[2] for c in col_info}
            if 'user_id' not in pref_cols:
                # Recreate user_preferences without CHECK(id=1)
                cursor.execute("ALTER TABLE user_preferences RENAME TO user_preferences_old")
                cursor.execute('''
                    CREATE TABLE user_preferences (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
                        font_size INTEGER NOT NULL DEFAULT 18,
                        line_height REAL NOT NULL DEFAULT 1.6,
                        target_lexile INTEGER NOT NULL DEFAULT 800,
                        native_language TEXT NOT NULL DEFAULT 'Chinese',
                        user_name TEXT NOT NULL DEFAULT 'Explorer',
                        theme TEXT NOT NULL DEFAULT 'light'
                    )
                ''')
                cursor.execute('''
                    INSERT INTO user_preferences (id, user_id, font_size, line_height, target_lexile, native_language, user_name, theme)
                    SELECT id, 1, font_size, line_height, target_lexile, native_language, user_name, theme
                    FROM user_preferences_old
                ''')
                cursor.execute("DROP TABLE user_preferences_old")
        except Exception as e:
            print(f"[DB] user_preferences migration note: {e}")

        # Migrate library
        try:
            _migrate_add_column(cursor, 'library', 'user_id', 'INTEGER NOT NULL DEFAULT 1 REFERENCES users(id)')
            cursor.execute("UPDATE library SET user_id = 1 WHERE user_id != 1 OR user_id IS NULL")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_library_user_id ON library(user_id)")
        except Exception as e:
            print(f"[DB] library migration note: {e}")

        # Migrate books
        try:
            _migrate_add_column(cursor, 'books', 'user_id', 'INTEGER NOT NULL DEFAULT 1 REFERENCES users(id)')
            cursor.execute("UPDATE books SET user_id = 1 WHERE user_id != 1 OR user_id IS NULL")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id)")
        except Exception as e:
            print(f"[DB] books migration note: {e}")

        # Migrate reading_progress
        try:
            _migrate_add_column(cursor, 'reading_progress', 'user_id', 'INTEGER NOT NULL DEFAULT 1 REFERENCES users(id)')
            cursor.execute("UPDATE reading_progress SET user_id = 1 WHERE user_id != 1 OR user_id IS NULL")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reading_progress_user_id ON reading_progress(user_id)")
        except Exception as e:
            print(f"[DB] reading_progress migration note: {e}")

        # Migrate vocabulary (already has user_id as TEXT, need to handle)
        try:
            col_info = cursor.execute("PRAGMA table_info(vocabulary)").fetchall()
            vocab_cols = {c[1]: c[2] for c in col_info}
            if vocab_cols.get('user_id', '').upper() == 'TEXT':
                # Need to recreate vocabulary table
                cursor.execute("ALTER TABLE vocabulary RENAME TO vocabulary_old")
                cursor.execute('''
                    CREATE TABLE vocabulary (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
                        text TEXT NOT NULL,
                        translation TEXT NOT NULL,
                        context TEXT NOT NULL DEFAULT '',
                        item_type TEXT NOT NULL DEFAULT 'word' CHECK(item_type IN ('word', 'sentence')),
                        book_title TEXT NOT NULL DEFAULT '',
                        chapter_title TEXT NOT NULL DEFAULT '',
                        is_mastered INTEGER DEFAULT 0,
                        next_review_at TIMESTAMP DEFAULT NULL,
                        interval_days INTEGER DEFAULT 0,
                        ease_factor REAL DEFAULT 2.5,
                        repetition_count INTEGER DEFAULT 0,
                        last_reviewed_at TIMESTAMP DEFAULT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, text)
                    )
                ''')
                cursor.execute('''
                    INSERT INTO vocabulary (id, user_id, text, translation, context, item_type, book_title, chapter_title,
                        is_mastered, next_review_at, interval_days, ease_factor, repetition_count, last_reviewed_at, created_at)
                    SELECT id, 1, text, translation, context, item_type, book_title, chapter_title,
                        is_mastered, next_review_at, interval_days, ease_factor, repetition_count, last_reviewed_at, created_at
                    FROM vocabulary_old
                ''')
                cursor.execute("DROP TABLE vocabulary_old")
        except Exception as e:
            print(f"[DB] Vocabulary migration note: {e}")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_vocabulary_user_id ON vocabulary(user_id)")

        # Migrate companion_chat_history
        try:
            _migrate_add_column(cursor, 'companion_chat_history', 'user_id', 'INTEGER NOT NULL DEFAULT 1 REFERENCES users(id)')
            cursor.execute("UPDATE companion_chat_history SET user_id = 1 WHERE user_id != 1 OR user_id IS NULL")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON companion_chat_history(user_id)")
        except Exception as e:
            print(f"[DB] chat_history migration note: {e}")

        # Migrate daily_reading_log
        try:
            _migrate_add_column(cursor, 'daily_reading_log', 'user_id', 'INTEGER NOT NULL DEFAULT 1 REFERENCES users(id)')
            cursor.execute("UPDATE daily_reading_log SET user_id = 1 WHERE user_id != 1 OR user_id IS NULL")
        except Exception as e:
            print(f"[DB] daily_reading_log migration note: {e}")

        conn.commit()
        print("[DB] Migration complete.")

    # ── Standard table creation (idempotent) ──

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT NOT NULL UNIQUE,
            email         TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            name          TEXT NOT NULL DEFAULT '',
            avatar_url    TEXT,
            current_streak    INTEGER NOT NULL DEFAULT 0,
            words_read_today  INTEGER NOT NULL DEFAULT 0,
            goal_minutes      INTEGER NOT NULL DEFAULT 30,
            hours_this_week   REAL NOT NULL DEFAULT 0,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_key TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            title TEXT,
            category TEXT,
            original_text TEXT NOT NULL,
            rewritten_text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(article_key, difficulty)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vocabulary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
            text TEXT NOT NULL,
            translation TEXT NOT NULL,
            context TEXT NOT NULL DEFAULT '',
            item_type TEXT NOT NULL DEFAULT 'word' CHECK(item_type IN ('word', 'sentence')),
            book_title TEXT NOT NULL DEFAULT '',
            chapter_title TEXT NOT NULL DEFAULT '',
            is_mastered INTEGER DEFAULT 0,
            next_review_at TIMESTAMP DEFAULT NULL,
            interval_days INTEGER DEFAULT 0,
            ease_factor REAL DEFAULT 2.5,
            repetition_count INTEGER DEFAULT 0,
            last_reviewed_at TIMESTAMP DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, text)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS library (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
            title TEXT NOT NULL,
            author TEXT,
            content TEXT NOT NULL,
            source_type TEXT NOT NULL DEFAULT 'book',
            lexile_level INTEGER DEFAULT 1050,
            progress INTEGER DEFAULT 0,
            cover_url TEXT,
            is_saved INTEGER DEFAULT 0,
            last_read_at TIMESTAMP DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            current_chapter_index INTEGER DEFAULT 0,
            total_chapters INTEGER DEFAULT 0,
            category TEXT DEFAULT '',
            source_book_id INTEGER DEFAULT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS companion_chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
            book_id INTEGER NOT NULL,
            chapter_index INTEGER NOT NULL DEFAULT 0,
            role TEXT NOT NULL DEFAULT 'ai' CHECK(role IN ('user', 'ai')),
            message TEXT NOT NULL,
            paragraph_index INTEGER DEFAULT -1,
            text_anchor TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
            font_size INTEGER NOT NULL DEFAULT 18,
            line_height REAL NOT NULL DEFAULT 1.6,
            target_lexile INTEGER NOT NULL DEFAULT 800,
            native_language TEXT NOT NULL DEFAULT 'Chinese',
            user_name TEXT NOT NULL DEFAULT 'Explorer',
            theme TEXT NOT NULL DEFAULT 'light'
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
            title TEXT NOT NULL UNIQUE,
            author TEXT NOT NULL DEFAULT 'Unknown Author',
            cover_url TEXT,
            description TEXT,
            lexile_level INTEGER DEFAULT 800,
            source_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reading_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
            book_id INTEGER NOT NULL,
            current_chapter INTEGER NOT NULL DEFAULT 1,
            total_chapters INTEGER NOT NULL DEFAULT 1,
            progress_percentage INTEGER NOT NULL DEFAULT 0,
            minutes_left INTEGER NOT NULL DEFAULT 0,
            last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (book_id) REFERENCES books(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT DEFAULT '',
            link TEXT DEFAULT '',
            is_read INTEGER DEFAULT 0,
            source TEXT DEFAULT 'system',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS daily_reading_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
            log_date TEXT NOT NULL,
            minutes_read REAL NOT NULL DEFAULT 0,
            words_read INTEGER NOT NULL DEFAULT 0,
            books_opened INTEGER NOT NULL DEFAULT 0,
            UNIQUE(user_id, log_date),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # ── Ensure default data ──
    row = cursor.execute("SELECT id FROM users WHERE id = 1").fetchone()
    if not row:
        default_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt(rounds=12)).decode()
        cursor.execute(
            '''INSERT INTO users (id, username, email, password_hash, name, current_streak, words_read_today, goal_minutes)
               VALUES (1, 'admin', 'admin@rippleread.local', ?, 'Explorer', 7, 23, 30)''',
            (default_hash,)
        )

    row = cursor.execute("SELECT id FROM books ORDER BY id ASC LIMIT 1").fetchone()
    if row:
        cursor.execute(
            "INSERT OR IGNORE INTO reading_progress (user_id, book_id, current_chapter, total_chapters, progress_percentage, minutes_left) VALUES (1, ?, 18, 61, 72, 15)",
            (row[0],)
        )

    # Ensure user_preferences row exists
    pref = cursor.execute("SELECT id FROM user_preferences WHERE id = 1").fetchone()
    if not pref:
        cursor.execute(
            '''INSERT INTO user_preferences (id, user_id, font_size, line_height, target_lexile, native_language, user_name, theme)
               VALUES (1, 1, 18, 1.6, 800, 'Chinese', 'Explorer', 'light')'''
        )
    else:
        _migrate_add_column(cursor, 'user_preferences', 'user_id', 'INTEGER NOT NULL DEFAULT 1 REFERENCES users(id)')
        cursor.execute("UPDATE user_preferences SET user_id = 1 WHERE user_id IS NULL OR user_id = 0")

    # Seed demo reading log
    today = date.today()
    existing_logs = cursor.execute("SELECT COUNT(*) FROM daily_reading_log").fetchone()[0]
    if existing_logs == 0:
        for i in range(7):
            d = today - timedelta(days=6 - i)
            mins = [22, 35, 18, 40, 28, 15, 32][i]
            words = [450, 720, 310, 850, 540, 240, 610][i]
            opened = [1, 2, 1, 1, 1, 0, 1][i]
            cursor.execute(
                "INSERT OR IGNORE INTO daily_reading_log (user_id, log_date, minutes_read, words_read, books_opened) VALUES (1, ?, ?, ?, ?)",
                (d.isoformat(), mins, words, opened)
            )

    # ── Indexes ──
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_library_is_saved ON library(is_saved)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_library_last_read_at ON library(last_read_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_library_source_type ON library(source_type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_library_created_at ON library(created_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_library_progress ON library(progress)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_library_source_book_id ON library(source_book_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_library_user_id ON library(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_daily_log_user_date ON daily_reading_log(user_id, log_date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_vocabulary_user_id ON vocabulary(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_books_source_id ON books(source_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_reading_progress_user_id ON reading_progress(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON companion_chat_history(user_id)')

    conn.commit()
    conn.close()
    print("[DB] Database initialized successfully.")


if __name__ == '__main__':
    init_database()
