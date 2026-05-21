import json
import traceback

import requests
from fastapi import HTTPException

from ..config import DEEPSEEK_API_KEY, DEEPSEEK_CHAT_COMPLETIONS_URL
from ..core.lexile_engine import get_user_preferences, get_ai_context_directive, get_lexile_style_directive
from ..dictionary import LOCAL_DICTIONARY

_translate_cache = {}
_mindmap_cache = {}


def translate_word(word: str) -> dict:
    word = word.strip().lower()
    if not word:
        return {"word": "", "translation": "", "phonetic": "", "pos": ""}

    if word in LOCAL_DICTIONARY:
        return LOCAL_DICTIONARY[word]

    if word in _translate_cache:
        return _translate_cache[word]

    if DEEPSEEK_API_KEY:
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
            }

            payload = {
                "model": "deepseek-v4-flash",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an English-Chinese translator. Return ONLY valid JSON: {\"word\":\"<word>\",\"translation\":\"<Chinese>\",\"phonetic\":\"<IPA>\",\"pos\":\"<NOUN|VERB|ADJ|ADV|...>\"}"
                    },
                    {"role": "user", "content": word}
                ],
                "max_tokens": 150,
                "temperature": 0.1
            }

            response = requests.post(
                DEEPSEEK_CHAT_COMPLETIONS_URL,
                headers=headers,
                json=payload,
                timeout=10
            )

            if response.status_code == 200:
                result_data = response.json()
                result = result_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if result:
                    try:
                        result_json = json.loads(result)
                        if result_json.get("word") and result_json.get("translation"):
                            _translate_cache[word] = result_json
                            return result_json
                    except json.JSONDecodeError:
                        if result.strip():
                            fallback = {
                                "word": word,
                                "translation": result.strip(),
                                "phonetic": "",
                                "pos": ""
                            }
                            _translate_cache[word] = fallback
                            return fallback
        except Exception as e:
            print(f"DeepSeek API error: {e}")

    return {
        "word": word,
        "translation": f"[{word}]",
        "phonetic": "/---/",
        "pos": "UNKNOWN"
    }

def translate_batch(words: list) -> dict:
    unknown = []
    results = {}
    for w in words:
        w = w.strip().lower()
        if not w:
            continue
        if w in LOCAL_DICTIONARY:
            results[w] = LOCAL_DICTIONARY[w]
        elif w in _translate_cache:
            results[w] = _translate_cache[w]
        else:
            unknown.append(w)

    if not unknown or not DEEPSEEK_API_KEY:
        return results

    try:
        word_list = ", ".join(unknown)
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
        }

        payload = {
            "model": "deepseek-v4-flash",
            "messages": [
                {
                    "role": "system",
                    "content": "You are an English-Chinese translator. Return ONLY valid JSON mapping each word to its translation info. No extra text."
                },
                {
                    "role": "user",
                    "content": f'Translate: {word_list}\n\nReturn JSON: {{"word1":{{"word":"word1","translation":"Chinese","phonetic":"IPA","pos":"NOUN/VERB/..."}},...}}'
                }
            ],
            "max_tokens": 200 * len(unknown),
            "temperature": 0.1
        }

        response = requests.post(
            DEEPSEEK_CHAT_COMPLETIONS_URL,
            headers=headers,
            json=payload,
            timeout=15
        )

        if response.status_code == 200:
            result_data = response.json()
            content = result_data.get("choices", [{}])[0].get("message", {}).get("content", "")
            if content:
                content = content.strip()
                try:
                    batch_json = json.loads(content)
                    for w, info in batch_json.items():
                        w_clean = w.strip().lower()
                        if isinstance(info, dict) and info.get("translation"):
                            _translate_cache[w_clean] = info
                            results[w_clean] = info
                except json.JSONDecodeError:
                    pass
    except Exception as e:
        print(f"Batch translate error: {e}")

    return results


def get_mindmap(word: str) -> dict:
    word = word.strip().lower()

    if not word:
        return {
            "word": word,
            "translation": "",
            "pronunciation": "",
            "etymology": "",
            "synonyms": [],
            "antonyms": [],
            "collocations": []
        }

    if word in _mindmap_cache:
        return _mindmap_cache[word]

    if not DEEPSEEK_API_KEY:
        return {
            "word": word,
            "translation": "",
            "pronunciation": "",
            "etymology": "",
            "synonyms": [],
            "antonyms": [],
            "collocations": [],
            "_error": "AI service not configured."
        }

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
        }

        prompt = f"""Analyze "{word}". Return ONLY valid JSON:
{{"translation":"Chinese","pronunciation":"IPA","etymology":"root analysis in Chinese, e.g. demand -> de-[加强]+mand[命令]","synonyms":["word(POS) Chinese — diff:..."],"antonyms":["word(POS) Chinese"],"collocations":["phrase — Chinese"]}}
Max 3 synonyms, 2 antonyms, 3 collocations."""

        payload = {
            "model": "deepseek-v4-flash",
            "messages": [
                {"role": "system", "content": "You are an etymologist. Output ONLY valid JSON, no markdown."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 600,
            "temperature": 0.3
        }

        response = requests.post(
            DEEPSEEK_CHAT_COMPLETIONS_URL,
            headers=headers,
            json=payload,
            timeout=20
        )

        if response.status_code == 200:
            result_data = response.json()
            result = result_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

            if result:
                result = result.replace("```json", "").replace("```", "").strip()

                try:
                    result_json = json.loads(result)
                    out = {
                        "word": word,
                        "translation": result_json.get("translation", ""),
                        "pronunciation": result_json.get("pronunciation", ""),
                        "etymology": result_json.get("etymology", ""),
                        "synonyms": result_json.get("synonyms", []),
                        "antonyms": result_json.get("antonyms", []),
                        "collocations": result_json.get("collocations", [])
                    }
                    _mindmap_cache[word] = out
                    return out
                except json.JSONDecodeError:
                    return {
                        "word": word,
                        "translation": "",
                        "pronunciation": "",
                        "etymology": "",
                        "synonyms": [],
                        "antonyms": [],
                        "collocations": [],
                        "_error": "AI returned invalid data. Please try again."
                    }
        else:
            print(f"DeepSeek API HTTP error in mindmap: {response.status_code}")
    except requests.Timeout:
        print("DeepSeek API timeout in mindmap")
        return {
            "word": word,
            "translation": "",
            "pronunciation": "",
            "etymology": "",
            "synonyms": [],
            "antonyms": [],
            "collocations": [],
            "_error": "AI service timed out. Please try again."
        }
    except Exception as e:
        print(f"DeepSeek API error in mindmap: {e}")
        return {
            "word": word,
            "translation": "",
            "pronunciation": "",
            "etymology": "",
            "synonyms": [],
            "antonyms": [],
            "collocations": [],
            "_error": "AI service unavailable. Please try again later."
        }

    return {
        "word": word,
        "translation": "",
        "pronunciation": "",
        "etymology": "",
        "synonyms": [],
        "antonyms": [],
        "collocations": [],
        "_error": "AI service unavailable. Please try again later."
    }


def simplify_content(content: str, target_level=None) -> dict:
    if not target_level:
        preferences = get_user_preferences()
        target_lexile = preferences["target_lexile"]
        target_level = f"Lexile {target_lexile}L"
    else:
        target_lexile = None

    if not content:
        return {"success": False, "simplified_content": "", "original_content": content}

    if DEEPSEEK_API_KEY:
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
            }

            lexile_context = ""
            if target_lexile is not None:
                lexile_context = get_ai_context_directive(target_lexile)

            payload = {
                "model": "deepseek-v4-flash",
                "messages": [
                    {
                        "role": "system",
                        "content": f"""You are an expert English language simplifier. Rewrite the following text to match the {target_level} reading level.
                        Make the language simpler and easier to understand while preserving the original meaning.
                        {lexile_context}
                        Use shorter sentences and more common vocabulary.
                        Return ONLY the simplified text, no extra explanation."""
                    },
                    {"role": "user", "content": content[:3000]}
                ],
                "max_tokens": 2000,
                "temperature": 0.5
            }

            response = requests.post(
                DEEPSEEK_CHAT_COMPLETIONS_URL,
                headers=headers,
                json=payload,
                timeout=60
            )

            if response.status_code == 200:
                result_data = response.json()
                simplified = result_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                if simplified:
                    return {
                        "success": True,
                        "simplified_content": simplified,
                        "original_content": content,
                        "target_level": target_level
                    }
        except Exception as e:
            print(f"DeepSeek API error in simplify: {e}")

    simplified = content.replace("complex", "simple").replace("significant", "important")
    simplified = simplified.replace("consequently", "therefore").replace("furthermore", "also")
    simplified = simplified.replace("approximately", "about").replace("numerous", "many")
    simplified = simplified.replace("substantial", "large").replace("considerable", "big")
    simplified = simplified.replace("utilize", "use").replace("prior to", "before")

    return {
        "success": True,
        "simplified_content": simplified,
        "original_content": content,
        "target_level": target_level
    }


def generate_summary(content: str) -> dict:
    content = content.strip()

    if not content:
        return {
            "one_sentence_summary": "",
            "key_takeaways": [],
            "reading_focus": ""
        }

    if DEEPSEEK_API_KEY:
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
            }

            prompt = f"""You are a seasoned news editor. Read the article below and return ONLY a valid JSON object (no markdown, no code blocks, no extra text) with exactly these three fields:

1. "one_sentence_summary": A crisp one-sentence summary of the article's core message (max 30 words).
2. "key_takeaways": An array of 3 specific fact-based takeaways extracted from the article. Each must be a concrete detail or real opinion from the text — NO generic phrases like "main topic discussed" or "key events mentioned".
3. "reading_focus": A single sentence telling the reader what to pay special attention to while reading (e.g., "Pay attention to the paradox between economic growth and environmental protection").

Article content:
{content[:4000]}"""

            payload = {
                "model": "deepseek-v4-flash",
                "messages": [
                    {"role": "system", "content": "You are a seasoned news editor. You must output ONLY valid JSON without any markdown formatting or code blocks."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 1000,
                "temperature": 0.3
            }

            response = requests.post(
                DEEPSEEK_CHAT_COMPLETIONS_URL,
                headers=headers,
                json=payload,
                timeout=60
            )

            if response.status_code == 200:
                result_data = response.json()
                result_content = result_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

                result_content = result_content.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

                if result_content:
                    try:
                        result_json = json.loads(result_content)
                        return {
                            "one_sentence_summary": result_json.get("one_sentence_summary", ""),
                            "key_takeaways": result_json.get("key_takeaways", []),
                            "reading_focus": result_json.get("reading_focus", "")
                        }
                    except json.JSONDecodeError:
                        return {
                            "one_sentence_summary": "AI summary temporarily unavailable — the response was not in the expected format.",
                            "key_takeaways": [],
                            "reading_focus": ""
                        }
        except Exception as e:
            print(f"DeepSeek API error in summary: {e}")

    sentences = [s.strip() for s in content.replace('?', '.').replace('!', '.').split('.') if s.strip()]
    first_sentence = sentences[0] if sentences else content[:100]
    second_sentence = sentences[1] if len(sentences) > 1 else ""
    third_sentence = sentences[2] if len(sentences) > 2 else ""

    takeaways = [s for s in [first_sentence, second_sentence, third_sentence] if len(s) > 15][:3]

    return {
        "one_sentence_summary": first_sentence[:150] if first_sentence else "No content provided.",
        "key_takeaways": takeaways if takeaways else ["Article content is too short to extract key points."],
        "reading_focus": "Read the full article to understand the context behind the opening statement."
    }


def analyze_sentence(sentence: str) -> dict:
    sentence = sentence.strip()

    if not sentence:
        return {
            "translation": "",
            "grammar_breakdown": {
                "subject": "",
                "verb": "",
                "object": "",
                "tense_and_clause": ""
            },
            "key_phrases": [],
            "ai_tip": ""
        }

    if DEEPSEEK_API_KEY:
        try:
            preferences = get_user_preferences()
            native_language = preferences["native_language"]

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
            }

            prompt = f"""Analyze the following English sentence and return ONLY a valid JSON object with these fields:
1. "translation": A fluent {native_language} translation of the sentence
2. "grammar_breakdown": Object with "subject", "verb", "object", "tense_and_clause" (use {native_language} for the labels/descriptions)
3. "key_phrases": Array of 2-3 objects with "phrase" (original English) and "meaning" ({native_language} explanation)
4. "ai_tip": A concise learning tip about this sentence in {native_language}

Sentence to analyze: {sentence}"""

            payload = {
                "model": "deepseek-v4-flash",
                "messages": [
                    {"role": "system", "content": f"You are an expert English-{native_language} translator and grammar analyzer."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 1000,
                "temperature": 0.3
            }

            response = requests.post(
                DEEPSEEK_CHAT_COMPLETIONS_URL,
                headers=headers,
                json=payload,
                timeout=60
            )

            if response.status_code == 200:
                result_data = response.json()
                result_content = result_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

                result_content = result_content.replace("```json", "").replace("```", "").strip()

                if result_content:
                    try:
                        result_json = json.loads(result_content)
                        return {
                            "translation": result_json.get("translation", ""),
                            "grammar_breakdown": {
                                "subject": result_json.get("grammar_breakdown", {}).get("subject", ""),
                                "verb": result_json.get("grammar_breakdown", {}).get("verb", ""),
                                "object": result_json.get("grammar_breakdown", {}).get("object", ""),
                                "tense_and_clause": result_json.get("grammar_breakdown", {}).get("tense_and_clause", "")
                            },
                            "key_phrases": result_json.get("key_phrases", []),
                            "ai_tip": result_json.get("ai_tip", "")
                        }
                    except json.JSONDecodeError:
                        return {
                            "translation": result_content,
                            "grammar_breakdown": {
                                "subject": "AI分析中",
                                "verb": "AI分析中",
                                "object": "AI分析中",
                                "tense_and_clause": "AI分析中"
                            },
                            "key_phrases": [],
                            "ai_tip": ""
                        }
        except Exception as e:
            print(f"DeepSeek API error in analyze-sentence: {e}")

    return {
        "translation": f"[翻译中...] {sentence}",
        "grammar_breakdown": {
            "subject": "需要AI分析",
            "verb": "需要AI分析",
            "object": "需要AI分析",
            "tense_and_clause": "需要AI分析"
        },
        "key_phrases": [],
        "ai_tip": "请检查API密钥配置"
    }


def _number_paragraphs(text: str) -> tuple:
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    numbered = []
    for i, p in enumerate(paragraphs):
        numbered.append(f"[P{i}] {p}")
    return '\n\n'.join(numbered), len(paragraphs)


def _save_chat_history(book_id: int, chapter_index: int, role: str, message: str, paragraph_index: int = -1, text_anchor: str = "", user_id: int = 1):
    try:
        from ..db import get_db_connection
        conn = get_db_connection()
        conn.execute(
            '''INSERT INTO companion_chat_history (book_id, chapter_index, role, message, paragraph_index, text_anchor, user_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (book_id, chapter_index, role, message, paragraph_index, text_anchor or "", user_id)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[ChatHistory] Failed to save: {e}")


ANTI_SPOILER_RULES = """=== ANTI-SPOILER PROTOCOL (CRITICAL — VIOLATION IS UNACCEPTABLE) ===
1. You ONLY know the chapters shown above. You have ZERO knowledge of anything that happens later in the book.
2. If the user asks about future events (e.g., "Does X die?", "Who is the killer?", "Do they get married?"), you MUST reply with exactly this phrasing: "As your reading companion, I can only work with the clues we've seen so far — and I'd encourage you to uncover the mystery yourself." Then, if possible, add 1-2 sentences about clues FROM THE AVAILABLE CHAPTERS that the reader might want to examine more closely.
3. You may offer hints and speculation based ONLY on the chapters listed above — never as fact, always as possibility.
4. NEVER say things like "You'll find out later" or "That gets revealed in Chapter 10" — this is still a spoiler.
5. NEVER summarize or reference anything beyond the chapters listed above."""


def companion_chat(book_id, current_chapter_index, target_chapter_index, action, message, user_id: int = 1) -> dict:
    is_welcome = (action == "welcome")

    if not is_welcome and not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    from db import get_db_connection
    conn = get_db_connection()
    row = conn.execute('SELECT content, title FROM library WHERE id = ?', (book_id,)).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Book not found")

    content = row["content"] or ""
    book_title = row["title"] or "Untitled"

    try:
        chapters = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        chapters = [{"chapter_title": book_title, "content": content}]

    if not chapters:
        raise HTTPException(status_code=400, detail="Book has no content")

    total_chapters = len(chapters)

    if is_welcome:
        tci = max(0, min(target_chapter_index, total_chapters - 1))
        visible_chapters = chapters[:tci + 1]
    else:
        cci = max(0, min(current_chapter_index, total_chapters - 1))
        visible_chapters = chapters[:cci + 1]

    context_parts = []
    for i, ch in enumerate(visible_chapters):
        ctx_text = ch.get("content", "")
        ctx_title = ch.get("chapter_title", f"Chapter {i+1}")
        context_parts.append(f"--- {ctx_title} ---\n{ctx_text[:3000]}")

    book_context = "\n\n".join(context_parts)

    current_ch_num = target_chapter_index + 1 if is_welcome else current_chapter_index + 1
    user_position = f"Chapter {current_ch_num} of {total_chapters}"

    latest_chapter = visible_chapters[-1]
    latest_chapter_text = latest_chapter.get("content", "")
    latest_chapter_title = latest_chapter.get("chapter_title", f"Chapter {len(visible_chapters)}")
    numbered_chapter, total_paragraphs = _number_paragraphs(latest_chapter_text)

    ai_ctx = get_ai_context_directive()

    if is_welcome:
        system_prompt = f"""You are the RippleRead AI Reading Companion — a warm, literary guide who has just accompanied the reader to a brand-new chapter.
Your role is NOT to summarize. You are a guide at the threshold of a new chapter, sparking curiosity and anticipation.

=== LANGUAGE ===
You MUST always respond in English by default. Only switch to another language if the user explicitly writes to you in that language first.

=== READER ADAPTATION ===
{ai_ctx}

=== YOUR PERSONA ===
You speak like a mentor who has walked this path before — wise, slightly mysterious, and deeply invested in the reader's own journey of discovery. Your words should feel like someone gently placing a lantern at the entrance of a dark, fascinating corridor.

=== BOOK CONTEXT ===
Book title: "{book_title}"
The reader has just turned to: {user_position}
Previous chapters (for continuity only — DO NOT re-summarize them):
{book_context}
Current chapter content with paragraph markers [P0], [P1], ... ({total_paragraphs} paragraphs total):
--- {latest_chapter_title} ---
{numbered_chapter}

{ANTI_SPOILER_RULES}

=== OUTPUT FORMAT (STRICT) ===
You MUST return ONLY a valid JSON object, no markdown, no code blocks, no extra text:
{{"reply": "your welcome hook text here", "paragraph_index": N, "text_anchor": "exact phrase from the paragraph"}}

paragraph_index is the [P number] of the paragraph your hook most closely relates to. If no specific paragraph fits, use -1.
text_anchor is a distinctive EXACT substring (10-40 characters) copied verbatim from the target paragraph — the specific sentence or phrase your hook references. This is used to position the annotation icon precisely inline. If your hook is general and not tied to a specific sentence, use an empty string "".

=== WELCOME TASK (STRICT) ===
The reader has just navigated to this chapter. Your ENTIRE reply must be:
1. A VERY SHORT hook — one to three sentences max (total ≤ 40 English words). This is NOT a summary. It is an invitation.
2. Your tone must be mysterious, intriguing, and inviting — like opening a door just a crack to let light through.
3. NEVER summarize the chapter. NEVER describe what happens. Instead, hint at an atmosphere, a tension, a question, or a curiosity the reader should carry into the reading.
4. End by encouraging the reader to begin reading — not by telling them what they'll find.
5. Example tone: "The fog on the river hides more than just the opposite bank. Notice who chooses not to speak at dinner tonight." — NOT: "This chapter describes a dinner scene where..."
6. If the book has only one chapter (TXT upload), adapt naturally: give a short, inviting hook about the text as a whole.
7. Set paragraph_index to the [P number] of the paragraph that best matches your hook (e.g., if your hook references paragraph [P3], set paragraph_index to 3).
8. Set text_anchor to an EXACT distinctive phrase (10-40 chars) copied from that paragraph — the specific sentence your hook points to. This positions the ✨ icon inline at the exact sentence, not just the paragraph end. If your hook is atmospheric/general and not tied to a specific sentence, set text_anchor to "". Example: if paragraph [P3] says "She paused at the threshold, her heart racing with anticipation." and your hook hints at this moment, set text_anchor to "She paused at the threshold, her heart racing" or similar — but it MUST be an exact verbatim substring."""

        user_message = "The reader just opened this chapter. Give your welcome invitation."
    else:
        system_prompt = f"""You are the RippleRead AI Reading Companion — a warm, insightful guide accompanying a reader through their book. Your tone is encouraging, curious, and intellectually stimulating, like a thoughtful friend in a book club.

=== LANGUAGE ===
You MUST always respond in English by default. Only switch to another language if the user explicitly writes to you in that language first.

=== READER ADAPTATION ===
{ai_ctx}

=== YOUR IDENTITY ===
You are NOT the author. You are a companion who has read the same material as the user — no more, no less. You help the reader engage deeply with the text through discussion, analysis, and guided reflection.

=== BOOK CONTEXT ===
Book title: "{book_title}"
User's reading position: {user_position}
Chapters the user has already read (DO NOT refer to anything beyond these):

{book_context}

Current chapter with paragraph markers [P0], [P1], ... ({total_paragraphs} paragraphs total):
--- {latest_chapter_title} ---
{numbered_chapter}

{ANTI_SPOILER_RULES}

=== OUTPUT FORMAT (STRICT) ===
You MUST return ONLY a valid JSON object, no markdown, no code blocks, no extra text:
{{"reply": "your response to the reader here", "paragraph_index": N, "text_anchor": "exact phrase from the paragraph"}}

paragraph_index is the [P number] of the paragraph your response most closely relates to. Look at your reply — which paragraph in the current chapter does it discuss or reference? Choose the closest match. If your reply is a general discussion not tied to any specific paragraph, use -1.
text_anchor is a distinctive EXACT substring (10-40 characters) copied verbatim from the target paragraph — the specific sentence or phrase your response discusses. This is used to position the annotation icon precisely inline at the sentence level, not just at the paragraph end. If your response is general, use an empty string "".

=== DISCUSSION GUIDELINES ===
- Proactively highlight interesting details, literary devices, character motivations, and themes from the current and previous chapters.
- When the user shares thoughts, validate and build upon them.
- Ask thoughtful questions that deepen engagement with the text.
- Keep responses concise (2-4 paragraphs unless the user explicitly asks for a detailed analysis).
- When you quote or discuss a specific sentence from the numbered paragraphs, copy that exact sentence (or a distinctive fragment of it) into the text_anchor field so the reader can find it instantly.
- Use specific quotes or passages from the available chapters to support your observations — and when you quote a specific paragraph, set paragraph_index to its [P number]."""

        user_message = message.strip()

    if not DEEPSEEK_API_KEY:
        return {
            "reply": "I'd love to discuss this book with you! To enable AI-powered companion chat, please configure your DeepSeek API key with DEEPSEEK_API_KEY or config.json.",
            "current_chapter": current_ch_num,
            "total_chapters": total_chapters,
            "paragraph_index": -1,
            "text_anchor": "",
        }

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
        }

        payload = {
            "model": "deepseek-v4-flash",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            "max_tokens": 300 if is_welcome else 800,
            "temperature": 0.8 if is_welcome else 0.7
        }

        response = requests.post(
            DEEPSEEK_CHAT_COMPLETIONS_URL,
            headers=headers,
            json=payload,
            timeout=90
        )

        if response.status_code == 200:
            result_data = response.json()
            raw_content = result_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

            reply = raw_content
            paragraph_index = -1
            text_anchor = ""

            if raw_content:
                cleaned = raw_content.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                try:
                    parsed = json.loads(cleaned)
                    reply = parsed.get("reply", raw_content)
                    paragraph_index = parsed.get("paragraph_index", -1)
                    if not isinstance(paragraph_index, int):
                        paragraph_index = -1
                    text_anchor = str(parsed.get("text_anchor", "") or "").strip()
                except (json.JSONDecodeError, TypeError):
                    reply = raw_content

            _save_chat_history(
                book_id=book_id,
                chapter_index=current_ch_num - 1,
                role="ai",
                message=reply,
                paragraph_index=paragraph_index,
                text_anchor=text_anchor,
                user_id=user_id,
            )

            return {
                "reply": reply or "(The AI companion is deep in thought — try asking again.)",
                "current_chapter": current_ch_num,
                "total_chapters": total_chapters,
                "paragraph_index": paragraph_index,
                "text_anchor": text_anchor,
            }
        else:
            print(f"[CompanionChat] DeepSeek error {response.status_code}: {response.text[:200]}")
            return {
                "reply": "Hmm, I'm having trouble gathering my thoughts right now. Let's continue our discussion in a moment!",
                "current_chapter": current_ch_num,
                "total_chapters": total_chapters,
                "paragraph_index": -1,
                "text_anchor": "",
            }
    except requests.Timeout:
        print("[CompanionChat] DeepSeek request timed out")
        if is_welcome:
            return {
                "reply": "A new chapter awaits. Take your time — I'll be here when you're ready to talk about it.",
                "current_chapter": current_ch_num,
                "total_chapters": total_chapters,
                "paragraph_index": -1,
                "text_anchor": "",
            }
        return {
            "reply": "I need a moment to think about that. Let's come back to it — what else caught your attention in this chapter?",
            "current_chapter": current_ch_num,
            "total_chapters": total_chapters,
            "paragraph_index": -1,
            "text_anchor": "",
        }
    except Exception as e:
        print(f"[CompanionChat] Error: {e}")
        if is_welcome:
            return {
                "reply": "Turn the page. Something interesting is waiting.",
                "current_chapter": current_ch_num,
                "total_chapters": total_chapters,
                "paragraph_index": -1,
                "text_anchor": "",
            }
        return {
            "reply": "I seem to have lost my train of thought. Let's pick up where we left off — what would you like to discuss?",
            "current_chapter": current_ch_num,
            "total_chapters": total_chapters,
            "paragraph_index": -1,
            "text_anchor": "",
        }


def chapter_insights(book_id, chapter_index) -> dict:
    from db import get_db_connection
    conn = get_db_connection()
    row = conn.execute('SELECT content, title FROM library WHERE id = ?', (book_id,)).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Book not found")

    content = row["content"] or ""
    book_title = row["title"] or "Untitled"

    try:
        chapters = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        chapters = [{"chapter_title": book_title, "content": content}]

    total_chapters = len(chapters)
    ci = max(0, min(chapter_index, total_chapters - 1))
    ch = chapters[ci]
    chapter_text = ch.get("content", "")
    chapter_title = ch.get("chapter_title", f"Chapter {ci + 1}")

    if not chapter_text or not chapter_text.strip():
        return {"insights": [], "chapter_index": ci, "total_chapters": total_chapters}

    numbered_chapter, total_paragraphs = _number_paragraphs(chapter_text)

    if not DEEPSEEK_API_KEY:
        return {"insights": [], "chapter_index": ci, "total_chapters": total_chapters}

    system_prompt = f"""You are a literary analyst for the RippleRead reading platform. Your job is to scan a chapter and identify 2-3 sentences that deserve AI-powered reading companion annotations.

=== READER PROFILE ===
{get_ai_context_directive()}

=== BOOK CONTEXT ===
Book title: "{book_title}"
Chapter: {chapter_title} ({ci + 1} of {total_chapters})

=== CHAPTER CONTENT (with paragraph markers) ===
{numbered_chapter}

=== SELECTION CRITERIA ===
Pick 2-3 sentences that meet at least one of these criteria:
1. Literary beauty — striking imagery, metaphor, or elegant prose that rewards closer reading
2. Character insight — reveals something important about a character's personality, motivation, or change
3. Thematic weight — touches on a central theme or idea of the work
4. Narrative tension — creates suspense, irony, or dramatic contrast
5. Foreshadowing — hints at future developments (based ONLY on what's visible in THIS chapter)
6. Emotional depth — a moment of heightened emotion (joy, sorrow, fear, etc.)
7. Complex idea — presents a concept worth unpacking or reflecting on

=== IMPORTANT RULES ===
- Each insight's "text_anchor" MUST be an EXACT verbatim substring (15-60 characters) copied from the numbered paragraph — this is how we position the marker in the text
- Each insight's "insight" is a brief, insightful commentary (1-2 sentences, warm and personal tone, like a knowledgeable friend pointing out something interesting)
- Vary your selections across different paragraphs when possible
- Do NOT pick sentences from the same paragraph unless they represent fundamentally different insights
- If the chapter is very short (< 3 paragraphs), pick 1-2 sentences instead

=== OUTPUT FORMAT (STRICT) ===
You MUST return ONLY a valid JSON object, no markdown, no code blocks, no extra text:
{{"insights": [{{"paragraph_index": N, "text_anchor": "exact phrase from paragraph", "insight": "your brief commentary"}}]}}

paragraph_index is the [P number] marker. text_anchor must be exact and verbatim."""

    user_message = "Analyze this chapter and return 2-3 key sentences worth annotating."

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
        }

        payload = {
            "model": "deepseek-v4-flash",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            "max_tokens": 800,
            "temperature": 0.7
        }

        response = requests.post(
            DEEPSEEK_CHAT_COMPLETIONS_URL,
            headers=headers,
            json=payload,
            timeout=90
        )

        if response.status_code == 200:
            result_data = response.json()
            raw_content = result_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

            insights = []
            if raw_content:
                cleaned = raw_content.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                try:
                    parsed = json.loads(cleaned)
                    raw_insights = parsed.get("insights", [])
                    if isinstance(raw_insights, list):
                        for item in raw_insights:
                            pi = item.get("paragraph_index", -1)
                            if not isinstance(pi, int) or pi < 0 or pi >= total_paragraphs:
                                continue
                            ta = str(item.get("text_anchor", "") or "").strip()
                            insight = str(item.get("insight", "") or "").strip()
                            if insight and len(insight) >= 10:
                                insights.append({
                                    "paragraph_index": pi,
                                    "text_anchor": ta,
                                    "insight": insight
                                })
                except (json.JSONDecodeError, TypeError):
                    pass

            return {
                "insights": insights[:3],
                "chapter_index": ci,
                "total_chapters": total_chapters,
            }
        else:
            print(f"[ChapterInsights] DeepSeek error {response.status_code}: {response.text[:200]}")
            return {"insights": [], "chapter_index": ci, "total_chapters": total_chapters}
    except requests.Timeout:
        print("[ChapterInsights] DeepSeek request timed out")
        return {"insights": [], "chapter_index": ci, "total_chapters": total_chapters}
    except Exception as e:
        print(f"[ChapterInsights] Error: {e}")
        return {"insights": [], "chapter_index": ci, "total_chapters": total_chapters}


def get_chat_history(user_id: int, book_id: int, chapter_index: int = 0) -> dict:
    try:
        from ..db import get_db_connection
        conn = get_db_connection()
        cursor = conn.execute(
            '''SELECT * FROM companion_chat_history
               WHERE user_id = ? AND book_id = ? AND chapter_index = ?
               ORDER BY created_at ASC''',
            (user_id, book_id, chapter_index)
        )
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return {"history": rows}
    except Exception as e:
        print(f"[ChatHistory] Failed to fetch: {e}")
        return {"history": []}


def generate_weaver_stream(words, target_lexile, word_count):
    lexile_directive = get_lexile_style_directive(target_lexile)
    words_list = ", ".join(words)

    system_prompt = f"""You are a creative AI storyteller for the RippleRead language-learning platform.
Your task is to write a short, engaging micro-novel (about {word_count} words) that naturally incorporates the following target English vocabulary words: {words_list}.

=== ABSOLUTE REQUIREMENTS ===
1. You MUST use EVERY target word at least once in the story. Bold each target word the first time it appears by wrapping it in **word**.
2. {lexile_directive}
3. Target length: approximately {word_count} words. Stay close to this target.
4. Write a complete, self-contained story with a clear beginning, middle, and end.
5. The story should be interesting and emotionally resonant — not a dry vocabulary exercise.
6. After the story, append just '|||TRANSLATION|||' followed by a natural Chinese translation of the entire story.

=== RESPONSE FORMAT ===
Write the story in natural paragraphs. Do NOT use markdown headers or code blocks. Just write the story directly."""

    def event_generator():
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
            }

            payload = {
                "model": "deepseek-v4-flash",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Write a micro-novel using these words: {words_list}. Target Lexile: {target_lexile}L."}
                ],
                "max_tokens": 2000,
                "temperature": 0.8,
                "stream": True
            }

            response = requests.post(
                DEEPSEEK_CHAT_COMPLETIONS_URL,
                headers=headers,
                json=payload,
                timeout=120,
                stream=True
            )

            if response.status_code != 200:
                error_msg = f"AI service returned error: {response.status_code}"
                print(f"[AIWeaver] {error_msg}")
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                yield "data: [DONE]\n\n"
                return

            accumulated_content = ""
            for line in response.iter_lines(decode_unicode=True):
                if not line or not line.startswith("data: "):
                    continue

                data_str = line[6:]
                if data_str == "[DONE]":
                    break

                try:
                    chunk_data = json.loads(data_str)
                    delta = chunk_data.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        accumulated_content += content
                        yield f"data: {json.dumps({'chunk': content})}\n\n"
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue

            english_story = ""
            chinese_translation = ""

            if "|||TRANSLATION|||" in accumulated_content:
                parts = accumulated_content.split("|||TRANSLATION|||", 1)
                english_story = parts[0].strip()
                chinese_translation = parts[1].strip() if len(parts) > 1 else ""
            else:
                english_story = accumulated_content.strip()

            yield f"data: {json.dumps({'done': True, 'english': english_story, 'chinese': chinese_translation})}\n\n"

        except requests.Timeout:
            print("[AIWeaver] Request timed out")
            traceback.print_exc()
            yield f"data: {json.dumps({'error': 'AI service timed out. Please try again.'})}\n\n"
        except Exception as e:
            print(f"[AIWeaver] Streaming error: {e}")
            traceback.print_exc()
            yield f"data: {json.dumps({'error': f'Streaming interrupted: {str(e)}'})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return event_generator()


def weaver_save(title: str, content: str, lexile_level: int, user_id: int = 1):
    from db import get_db_connection
    conn = get_db_connection()
    conn.execute(
        '''INSERT INTO library (title, author, content, source_type, lexile_level, progress, cover_url, is_saved, created_at, last_read_at, user_id)
           VALUES (?, 'AI Word Weaver', ?, 'weaver', ?, 0, NULL, 1, CURRENT_TIMESTAMP, NULL, ?)''',
        (title, content, lexile_level or 750, user_id)
    )
    conn.commit()
    book_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    conn.close()
    return book_id
