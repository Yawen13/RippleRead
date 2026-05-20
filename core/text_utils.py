import re


def _count_syllables(word):
    word = word.lower().strip()
    if not word:
        return 0
    cleaned = re.sub(r'e$', '', word)
    cleaned = re.sub(r'[^a-z]', '', cleaned)
    if not cleaned:
        return 1
    vowel_groups = len(re.findall(r'[aeiouy]+', cleaned))
    return max(1, vowel_groups)


def calculate_lexile(text):
    if not text or not isinstance(text, str):
        return 400
    text = text.strip()
    if not text:
        return 400
    try:
        import textstat
        fk_grade = textstat.flesch_kincaid_grade(text)
        fk_grade = max(0.0, min(18.0, fk_grade))
        lexile = int(80 * fk_grade + 320)
        return max(400, min(1300, lexile))
    except ImportError:
        pass
    sentences = [s for s in re.split(r'[.!?]+', text) if s.strip()]
    words_list = [w for w in re.findall(r"[a-zA-Z']+", text) if w.strip("'")]
    if not sentences or not words_list:
        return 400
    num_sentences = len(sentences)
    num_words = len(words_list)
    if num_sentences == 0 or num_words == 0:
        return 400
    total_syllables = sum(_count_syllables(w) for w in words_list)
    fk_grade = 0.39 * (num_words / num_sentences) + 11.8 * (total_syllables / num_words) - 15.59
    fk_grade = max(0.0, min(18.0, fk_grade))
    lexile = int(80 * fk_grade + 320)
    lexile = max(400, min(1300, lexile))
    return lexile
