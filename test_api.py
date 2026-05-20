import urllib.request
import json

# Test simplify API with real AI
print('=== Testing /api/simplify (AI) ===')
url = 'http://localhost:8001/api/simplify'
content = """Artificial intelligence is transforming numerous industries by enabling machines to perform complex tasks that previously required human intelligence. This technology has substantial implications for businesses and society as a whole."""
data = json.dumps({"content": content, "target_level": "IELTS 5.0"}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
with urllib.request.urlopen(req) as response:
    result = json.loads(response.read())
    print('Original:', content)
    print('Simplified:', result.get('simplified_content', ''))

# Test summary API with real AI
print('\n=== Testing /api/summary (AI) ===')
url = 'http://localhost:8001/api/summary'
content = """Plaid Cymru leader Rhun ap Iorwerth says his party is ready to run the Welsh government after winning the most seats in the Senedd election. The historic vote saw Plaid Cymru secure 43 seats, with Reform UK coming second and Labour pushed into third place. This ends over a century of Labour dominance in Wales."""
data = json.dumps({"content": content}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
with urllib.request.urlopen(req) as response:
    result = json.loads(response.read())
    print('TLDR:', result.get('TLDR', ''))
    print('Key Points:', result.get('key_points', []))