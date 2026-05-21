from datetime import datetime

from ..db import get_db_connection

def create_notification(user_id: int, type: str, title: str, body: str = "", link: str = "", source: str = "system"):
    conn = get_db_connection()
    conn.execute(
        '''INSERT INTO notifications (user_id, type, title, body, link, source, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)''',
        (user_id, type, title, body, link, source)
    )
    conn.commit()
    conn.close()


def get_unread_count(user_id: int = 1):
    conn = get_db_connection()
    count = conn.execute(
        "SELECT COUNT(*) as cnt FROM notifications WHERE (user_id = ? OR user_id = 0) AND is_read = 0",
        (user_id,)
    ).fetchone()["cnt"]
    conn.close()
    return count


def get_notifications(user_id: int = 1, limit: int = 20):
    conn = get_db_connection()
    conn.row_factory = None
    rows = conn.execute(
        '''SELECT id, user_id, type, title, body, link, is_read, source, created_at
           FROM notifications
           WHERE user_id = ? OR user_id = 0
           ORDER BY is_read ASC, created_at DESC
           LIMIT ?''',
        (user_id, limit)
    ).fetchall()
    notifs = []
    for row in rows:
        notifs.append({
            "id": row[0],
            "user_id": row[1],
            "type": row[2],
            "title": row[3],
            "body": row[4],
            "link": row[5],
            "is_read": row[6],
            "source": row[7],
            "created_at": row[8],
        })
    conn.close()
    return notifs


def mark_as_read(notif_id: int, user_id: int = 1):
    conn = get_db_connection()
    conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id = 0)",
        (notif_id, user_id)
    )
    conn.commit()
    conn.close()


def mark_all_read(user_id: int = 1):
    conn = get_db_connection()
    conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE (user_id = ? OR user_id = 0) AND is_read = 0",
        (user_id,)
    )
    conn.commit()
    conn.close()


def create_platform_notification(type: str, title: str, body: str, link: str, target_user_id: int = 0, min_lexile: int = None, max_lexile: int = None):
    conn = get_db_connection()

    if min_lexile is not None or max_lexile is not None:
        conditions = []
        params = []
        if min_lexile is not None:
            conditions.append("target_lexile >= ?")
            params.append(min_lexile)
        if max_lexile is not None:
            conditions.append("target_lexile <= ?")
            params.append(max_lexile)
        where = " AND ".join(conditions)
        pref_rows = conn.execute(
            f"SELECT id, user_name FROM user_preferences WHERE {where}",
            params
        ).fetchall()

        if pref_rows:
            for p_row in pref_rows:
                conn.execute(
                    '''INSERT INTO notifications (user_id, type, title, body, link, source, is_read, created_at)
                       VALUES (?, ?, ?, ?, ?, 'platform', 0, CURRENT_TIMESTAMP)''',
                    (p_row[0], type, title, body, link)
                )
        else:
            conn.execute(
                '''INSERT INTO notifications (user_id, type, title, body, link, source, is_read, created_at)
                   VALUES (0, ?, ?, ?, ?, 'platform', 0, CURRENT_TIMESTAMP)''',
                (type, title, body, link)
            )
    elif target_user_id > 0:
        conn.execute(
            '''INSERT INTO notifications (user_id, type, title, body, link, source, is_read, created_at)
               VALUES (?, ?, ?, ?, ?, 'platform', 0, CURRENT_TIMESTAMP)''',
            (target_user_id, type, title, body, link)
        )
    else:
        conn.execute(
            '''INSERT INTO notifications (user_id, type, title, body, link, source, is_read, created_at)
               VALUES (0, ?, ?, ?, ?, 'platform', 0, CURRENT_TIMESTAMP)''',
            (type, title, body, link)
        )

    conn.commit()
    conn.close()


def _compute_streak(user_id: int, conn=None) -> int:
    from datetime import date, timedelta
    close_conn = False
    if conn is None:
        conn = get_db_connection()
        close_conn = True
    rows = conn.execute(
        "SELECT log_date FROM daily_reading_log WHERE user_id = ? AND minutes_read > 0 ORDER BY log_date DESC LIMIT 366",
        (user_id,),
    ).fetchall()
    streak = 0
    expected = date.today()
    for r in rows:
        d = date.fromisoformat(r["log_date"]) if isinstance(r["log_date"], str) else r["log_date"]
        if d == expected:
            streak += 1
            expected = expected - timedelta(days=1)
        elif d < expected:
            break
    if close_conn:
        conn.close()
    return streak


def check_and_notify_daily_goal(user_id: int = 1):
    from datetime import date
    conn = get_db_connection()
    user = conn.execute(
        "SELECT goal_minutes FROM users WHERE id = ?",
        (user_id,)
    ).fetchone()
    if not user:
        conn.close()
        return
    goal = user["goal_minutes"] or 0
    today_str = date.today().isoformat()
    today_log = conn.execute(
        "SELECT minutes_read FROM daily_reading_log WHERE user_id = ? AND log_date = ?",
        (user_id, today_str)
    ).fetchone()
    today_minutes = today_log["minutes_read"] if today_log else 0
    streak = _compute_streak(user_id, conn)
    conn.close()

    if goal > 0 and today_minutes >= goal:
        if not _check_recent_notif(user_id, "reading", "daily_goal"):
            create_notification(
                user_id, "reading",
                "You hit today's goal \u2014 " + str(streak) + "-day streak!",
                "daily_goal",
                "statistics.html",
                "system"
            )


def check_and_notify_streak_milestone(user_id: int = 1):
    streak = _compute_streak(user_id)

    milestones = {
        7: "7-day streak! Your vocabulary retention is up 40%.",
        30: "30-day streak! You're building an incredible habit.",
        100: "100-day streak! You're a reading legend."
    }

    if streak in milestones:
        key = "streak_" + str(streak)
        if not _check_recent_notif(user_id, "reading", key):
            create_notification(
                user_id, "reading",
                milestones[streak],
                key,
                "statistics.html",
                "system"
            )


def check_and_notify_book_finished(user_id: int, book_id: int, book_title: str):
    key = "book_finished_" + str(book_id)
    if not _check_recent_notif(user_id, "reading", key):
        create_notification(
            user_id, "reading",
            "You finished\u300a" + book_title + "\u300b! Try writing a review?",
            key,
            "reader.html?id=" + str(book_id),
            "system"
        )


def check_and_notify_weaver_ready(user_id: int, story_title: str, book_id: int):
    create_notification(
        user_id, "content",
        "Your story '" + story_title + "' is ready \u2014 read it now",
        "weaver_" + str(book_id),
        "reader.html?id=" + str(book_id),
        "system"
    )


def check_and_notify_news_fetched(count: int, source: str = "BBC News", min_lexile: int = 0, max_lexile: int = 0):
    lexile_info = ""
    if min_lexile > 0 and max_lexile > 0:
        lexile_info = ", Lexile " + str(min_lexile) + "-" + str(max_lexile) + "L"
    create_notification(
        0, "content",
        str(count) + " new articles from " + source + lexile_info,
        "news_fetch",
        "library.html",
        "system"
    )


def check_and_notify_vocab_review(user_id: int = 1):
    conn = get_db_connection()
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    due = conn.execute(
        """SELECT COUNT(*) as cnt FROM vocabulary
           WHERE user_id = ? AND item_type = 'word'
             AND (next_review_at IS NULL OR next_review_at <= ?)""",
        (user_id, now,)
    ).fetchone()["cnt"]
    conn.close()

    if due > 10:
        if not _check_recent_notif(user_id, "vocab", "review_reminder"):
            create_notification(
                user_id, "vocab",
                "You have " + str(due) + " words due for review \u2014 5 min to refresh",
                "review_reminder",
                "vocabulary.html",
                "system"
            )


def _check_recent_notif(user_id: int, type: str, key: str):
    conn = get_db_connection()
    row = conn.execute(
        "SELECT id FROM notifications WHERE (user_id = ? OR user_id = 0) AND type = ? AND body = ? AND created_at > datetime('now', '-1 day')",
        (user_id, type, key)
    ).fetchone()
    conn.close()
    return row is not None
