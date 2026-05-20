import io
import json
import os
import re
import zipfile

from bs4 import BeautifulSoup
from fastapi import HTTPException


def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split(r'(\d+)', str(s))]


def _parse_txt(raw_bytes: bytes) -> str:
    try:
        return raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        print("[UploadBook] UTF-8 解码失败，尝试 GBK...")
    try:
        return raw_bytes.decode("gbk", errors="ignore")
    except (UnicodeDecodeError, LookupError):
        print("[UploadBook] GBK 解码失败，使用 UTF-8 replace 模式...")
    return raw_bytes.decode("utf-8", errors="replace")


def _extract_chapter_title(soup, fallback_index: int) -> str:
    for selector in ['title', 'h1', 'h2', 'h3']:
        tag = soup.find(selector)
        if tag and tag.get_text(strip=True):
            return tag.get_text(strip=True)
    return f"Chapter {fallback_index + 1}"


def _looks_like_text_chapter(name: str) -> bool:
    lower = name.lower()
    skip_prefixes = (
        'mimetype', 'meta-inf', 'oebps/toc', 'oebps/content.opf',
        'oebps/container', 'oebps/nav', 'oebps/cover',
    )
    skip_keywords = (
        'cover', 'copyright', 'titlepage', 'title-page', 'title_page',
        'dedication', 'colophon', 'acknowledgment', 'acknowledgement',
        'index', 'glossary', 'appendix', 'bibliography', 'preface',
        'foreword', 'toc', 'nav', 'guide', 'contents', 'halftitle',
        'half-title', 'frontmatter', 'front-matter', 'front_matter',
        'imprint', 'epigraph',
    )
    if lower.startswith(skip_prefixes):
        return False
    stem = os.path.splitext(os.path.basename(lower))[0]
    for kw in skip_keywords:
        if kw in stem:
            return False
    if lower.endswith(('.html', '.xhtml', '.htm', '.xml')):
        return True
    return False


def parse_epub(raw_bytes: bytes) -> list:
    try:
        epub_zip = zipfile.ZipFile(io.BytesIO(raw_bytes), 'r')
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid EPUB/ZIP format")

    all_names = epub_zip.namelist()
    print(f"DEBUG: EPUB 内部文件概览 ({len(all_names)} files): {all_names[:10]}")

    document_names = sorted(
        [name for name in all_names
         if _looks_like_text_chapter(name)],
        key=natural_sort_key
    )

    print(f"DEBUG: 候选文本章节 (自然排序, {len(document_names)}): {document_names}")

    chapters = []
    chapter_index = 0
    for name in document_names:
        try:
            html_bytes = epub_zip.read(name)
        except Exception:
            continue

        soup = BeautifulSoup(html_bytes, 'html.parser')

        for tag in soup(["script", "style", "nav", "header", "footer", "image", "svg", "video"]):
            tag.extract()

        text = soup.get_text(separator='\n')
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            continue

        chapter_content = '\n'.join(lines)
        chapter_title = _extract_chapter_title(soup, chapter_index)
        chapter_index += 1

        chapters.append({
            "chapter_title": chapter_title,
            "content": chapter_content
        })

    chapters.sort(key=lambda ch: natural_sort_key(ch["chapter_title"]))

    print("--- 最终章节目录 (自然排序) ---")
    for i, ch in enumerate(chapters):
        print(f"  [{i+1}] {ch['chapter_title'][:60]}")
    print(f"--- 共 {len(chapters)} 章 ---")

    full_text = '\n\n'.join(ch['content'] for ch in chapters)
    if len(full_text) < 100:
        raise HTTPException(
            status_code=400,
            detail="可能该 EPUB 是加密的 DRM 文件或纯图片集，请尝试更换非加密版本或 TXT 格式。"
        )

    return chapters
