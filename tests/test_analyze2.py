import requests
import json

# Test with different sentences
test_sentences = [
    "I love reading English books.",
    "She is studying hard for the exam.",
    "The quick brown fox jumps over the lazy dog."
]

print('=== Testing /api/analyze-sentence with real API ===')
for sentence in test_sentences:
    print(f'\n--- Sentence: "{sentence}" ---')
    try:
        response = requests.post('http://localhost:8001/api/analyze-sentence', 
                               json={'sentence': sentence},
                               timeout=30)
        print('Status:', response.status_code)
        result = response.json()
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print('Error:', e)