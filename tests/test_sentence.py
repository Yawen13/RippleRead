import requests, json

BASE = 'http://localhost:8001'

print('=== 1. Save a sentence ===')
r = requests.post(f'{BASE}/api/vocabulary', json={
    'text': 'The government announced a significant expansion of its youth development program.',
    'translation': '政府宣布了其青年发展计划的重大扩展。',
    'context': 'From a news article',
    'item_type': 'sentence',
    'book_title': 'Test Article',
    'chapter_title': ''
})
print(f'POST sentence: status={r.status_code}')
print(f'Response: {r.json()}')

print()
print('=== 2. Save a word ===')
r = requests.post(f'{BASE}/api/vocabulary', json={
    'text': 'expansion',
    'translation': '扩展',
    'context': 'significant expansion of its youth development program',
    'item_type': 'word',
    'book_title': 'Test Article',
    'chapter_title': ''
})
print(f'POST word: status={r.status_code}')
print(f'Response: {r.json()}')

print()
print('=== 3. Fetch vocabulary ===')
r = requests.get(f'{BASE}/api/vocabulary')
data = r.json()
items = data.get('vocabulary', [])
print(f'Total items: {len(items)}')
for item in items:
    print(f'  id={item["id"]} type={item["item_type"]} text={item["text"][:60]} trans={item["translation"][:30]}')

sentences = [i for i in items if i.get('item_type') == 'sentence']
words = [i for i in items if i.get('item_type') == 'word']
print(f'Sentences count: {len(sentences)}')
print(f'Words count: {len(words)}')

if len(sentences) > 0:
    print('PASS: Sentence is stored correctly!')
else:
    print('FAIL: No sentences found!')

# Clean up
for item in items:
    if 'test' in item.get('text', '').lower() or item.get('text') in ['expansion', 'The government announced a significant expansion of its youth development program.']:
        requests.delete(f'{BASE}/api/vocabulary/{item["id"]}')
        print(f'Cleaned: id={item["id"]}')
