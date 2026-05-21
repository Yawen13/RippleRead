import sys
sys.path.insert(0, 'e:\\RippleRead\\RippleRead')

from app.main import LOCAL_DICTIONARY, translate_fallback, guess_phonetic, guess_pos

print("=== Testing Translation ===")

# Test local dictionary
word = "process"
if word in LOCAL_DICTIONARY:
    print(f"Local dictionary hit for '{word}':")
    print(f"  {LOCAL_DICTIONARY[word]}")
else:
    print(f"No local dictionary entry for '{word}'")
    print(f"Fallback translation: {translate_fallback(word)}")
    print(f"Phonetic: {guess_phonetic(word)}")
    print(f"POS: {guess_pos(word)}")

print("\n=== Testing More Words ===")
test_words = ["hello", "world", "learning", "progress", "unknownword"]
for w in test_words:
    if w in LOCAL_DICTIONARY:
        print(f"{w}: {LOCAL_DICTIONARY[w]['translation']}")
    else:
        print(f"{w}: {translate_fallback(w)}")

print("\n=== Testing Vocabulary Check ===")
import json
try:
    with open("static/vocabulary.json", "r", encoding="utf-8") as f:
        vocab = json.load(f)
    print(f"Vocabulary has {len(vocab)} items")
except:
    print("Vocabulary file not found or empty")