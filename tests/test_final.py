import requests

# Test summary API without AI (fallback)
print('Test 1: Summary without AI (short content)')
try:
    response = requests.post('http://localhost:8001/api/summary', 
                           json={'content': 'Short content.'},
                           timeout=5)
    print('Status:', response.status_code)
    print('Response:', response.text)
except Exception as e:
    print('Error:', e)

# Test simplify API without AI (fallback)
print('\nTest 2: Simplify without AI')
try:
    response = requests.post('http://localhost:8001/api/simplify', 
                           json={'content': 'This is a complex sentence with significant meaning.', 'target_level': 'IELTS 5.0'},
                           timeout=5)
    print('Status:', response.status_code)
    print('Response:', response.text)
except Exception as e:
    print('Error:', e)