import requests
import json

print('=== Testing /api/analyze-sentence ===')
try:
    response = requests.post('http://127.0.0.1:8001/api/analyze-sentence', 
                           json={'sentence': 'Hello world'},
                           timeout=30)
    print('Status:', response.status_code)
    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))
except Exception as e:
    print('Error:', e)
    import traceback
    traceback.print_exc()