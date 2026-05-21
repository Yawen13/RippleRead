import requests

# Test analyze-sentence API
print('=== Testing /api/analyze-sentence ===')
try:
    response = requests.post('http://localhost:8001/api/analyze-sentence', 
                           json={'sentence': 'I love reading English books.'},
                           timeout=10)
    print('Status:', response.status_code)
    result = response.json()
    print('Response:', result)
except Exception as e:
    print('Error:', e)