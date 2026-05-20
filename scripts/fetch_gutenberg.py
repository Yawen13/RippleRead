r"""
fetch_gutenberg.py -- 独立数据采集脚本
从 Gutendex API 拉取排名前 100 本英文书籍，清洗后写入 SQLite books 表。

用法:
    cd e:\RippleRead\RippleRead
    python scripts\fetch_gutenberg.py
"""

import requests
import sqlite3
import re
import random
import os
import sys
import time

GUTENDEX_BASE = "https://gutendex.com/books"
TARGET_COUNT = 100
REQUEST_TIMEOUT = 15
RETRY_MAX = 3
RETRY_DELAY = 2

PLACEHOLDER_COVER = (
    "https://placehold.co/400x600/2d3a3a/8a9b9b?text=No+Cover"
)


def format_author(raw_authors: list) -> str:
    """
    清洗作者名：Gutendex 返回 [{name: "Austen, Jane"}]
    将其翻转为 "Jane Austen"。无作者返回 "Unknown Author"。
    支持多逗号情况，如 "Augustine, Saint, of Hippo" -> "of Hippo Saint Augustine"。
    """
    if not raw_authors or len(raw_authors) == 0:
        return "Unknown Author"

    author = raw_authors[0]
    name = author.get("name", "").strip()
    if not name:
        return "Unknown Author"

    if "," in name:
        parts = [p.strip() for p in name.split(",") if p.strip()]
        if len(parts) >= 2:
            name = " ".join(reversed(parts))
    return name or "Unknown Author"


def extract_cover_url(formats: dict) -> str:
    """从 formats 字典提取 image/jpeg 封面，否则返回占位图。"""
    if not formats or not isinstance(formats, dict):
        return PLACEHOLDER_COVER
    cover = formats.get("image/jpeg", "")
    if cover and cover.startswith("http"):
        return cover
    return PLACEHOLDER_COVER


def extract_description(subjects: list) -> str:
    """提取 subjects 列表的前 2~3 项，用逗号拼接。"""
    if not subjects or not isinstance(subjects, list):
        return ""
    top_subjects = subjects[:3]
    return ", ".join(top_subjects)


def generate_mock_lexile() -> int:
    """生成 Mock 蓝思值，留待未来 AI 清洗。"""
    return random.randint(700, 1200)


def clean_title(raw_title: str) -> str:
    """清除书名中的多余换行符和首尾空白。"""
    if not raw_title:
        return "Untitled"
    return re.sub(r"\s+", " ", raw_title).strip()


def fetch_books_from_gutendex(target_count: int = TARGET_COUNT) -> list:
    """
    通过 Gutendex API 分页循环拉取数据，直到收集到足够条目。
    返回清洗后的书籍列表。
    """
    books = []
    url = f"{GUTENDEX_BASE}?languages=en&sort=popular"
    page = 0

    print(f"[*] 开始爬取 Gutendex 数据（目标 {target_count} 本）...\n")

    while url and len(books) < target_count:
        page += 1
        success = False

        for attempt in range(1, RETRY_MAX + 1):
            try:
                print(f"  [>>] 请求第 {page} 页 (attempt {attempt}): {url}")
                resp = requests.get(url, timeout=REQUEST_TIMEOUT)
                resp.raise_for_status()
                data = resp.json()
                results = data.get("results", [])
                url = data.get("next")
                success = True
                break
            except requests.exceptions.RequestException as e:
                print(f"  [!!] 第 {page} 页第 {attempt} 次请求失败: {e}")
                if attempt < RETRY_MAX:
                    time.sleep(RETRY_DELAY)
                else:
                    print(f"  [XX] 第 {page} 页三次重试均失败，跳过该页")
                    success = False

        if not success:
            continue

        if not results:
            print(f"  [--] 第 {page} 页无数据，终止爬取")
            break

        for item in results:
            if len(books) >= target_count:
                break

            title = clean_title(item.get("title", ""))
            author = format_author(item.get("authors", []))
            cover_url = extract_cover_url(item.get("formats", {}))
            description = extract_description(item.get("subjects", []))
            lexile = generate_mock_lexile()
            source_id = item.get("id")

            books.append({
                "title": title,
                "author": author,
                "cover_url": cover_url,
                "description": description,
                "lexile_level": lexile,
                "source_id": source_id,
            })

        print(f"  [OK] 第 {page} 页完成，累计采集 {len(books)} 本")

        if url is None:
            break

        time.sleep(0.3)

    print(f"\n[DONE] 采集完成，共获取 {len(books)} 本书籍\n")
    return books[:target_count]


def insert_books_to_db(books: list, db_path: str = "rippleread.db"):
    """将清洗后的书籍批量写入 books 表，使用 INSERT OR IGNORE 防重复。"""
    if not books:
        print("[!!] 无数据可写入")
        return 0

    conn = sqlite3.connect(db_path)
    inserted_count = 0
    skipped_count = 0

    for i, book in enumerate(books, 1):
        cursor = conn.execute(
            """INSERT OR IGNORE INTO books (title, author, cover_url, description, lexile_level, source_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                book["title"],
                book["author"],
                book["cover_url"],
                book["description"],
                book["lexile_level"],
                book["source_id"],
            ),
        )
        if cursor.rowcount > 0:
            inserted_count += 1
            print(f"  [{i:3d}/{len(books)}] + {book['title'][:50]}... -- {book['author']}")
        else:
            skipped_count += 1
            print(f"  [{i:3d}/{len(books)}] = 已存在，跳过: {book['title'][:50]}...")

    conn.commit()
    conn.close()

    print(f"\n[SUMMARY] 写入完成: 新增 {inserted_count} 本，跳过 {skipped_count} 本（共 {len(books)} 条）")
    return inserted_count


def verify_data(db_path: str = "rippleread.db"):
    """验收：检查数据库内作者名格式和封面链接是否正确。"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT id, title, author, cover_url FROM books ORDER BY id DESC LIMIT 10").fetchall()
    conn.close()

    print("\n[VERIFY] 数据验证（最近 10 条）:")
    print("-" * 80)
    for row in rows:
        author_ok = "+" if "," not in row["author"] and row["author"] != "Unknown Author" else "!"
        cover_ok = "+" if row["cover_url"] and row["cover_url"].startswith("http") else "X"
        print(f"  #{row['id']:3d} | {author_ok} {row['author'][:25]:25s} | {cover_ok} {row['title'][:45]}...")
    print("-" * 80)


if __name__ == "__main__":
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "rippleread.db")

    print("=" * 60)
    print("  RippleRead -- Gutendex 数据采集脚本")
    print("=" * 60)
    print(f"  数据库: {db_path}")
    print("=" * 60 + "\n")

    books = fetch_books_from_gutendex(TARGET_COUNT)
    insert_books_to_db(books, db_path)
    verify_data(db_path)

    print("\n[FINISH] 脚本执行完毕")
