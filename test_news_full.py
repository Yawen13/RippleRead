import requests
import time

print("=== Testing News Fetch API ===")
print("Calling /api/fetch-news...")

start_time = time.time()
try:
    response = requests.post("http://localhost:9000/api/fetch-news", timeout=120)
    elapsed = time.time() - start_time
    
    if response.status_code == 200:
        result = response.json()
        print(f"\n✅ Success! Time: {elapsed:.2f}s")
        print(f"Message: {result['message']}")
    else:
        print(f"\n❌ Failed with status: {response.status_code}")
        print(f"Response: {response.text}")
except requests.exceptions.Timeout:
    print(f"\n❌ Request timed out after {time.time() - start_time:.2f}s")
except Exception as e:
    print(f"\n❌ Error: {str(e)}")

# Check database content
print("\n=== Checking Database Content ===")
import sqlite3
conn = sqlite3.connect('rippleread.db')
cursor = conn.cursor()

cursor.execute('SELECT id, title, LENGTH(content) as len FROM library WHERE source_type="news" ORDER BY id DESC')
news_items = cursor.fetchall()

print(f"\nTotal news articles: {len(news_items)}")
print("\n--- News Details ---")
for item in news_items:
    print(f"\nID: {item[0]}")
    print(f"Title: {item[1][:60]}...")
    print(f"Content Length: {item[2]} characters")
    
    # Get full content
    cursor.execute('SELECT content FROM library WHERE id=?', (item[0],))
    content = cursor.fetchone()[0]
    print(f"Content Preview (first 300 chars):")
    print(f"{content[:300]}...")

conn.close()

print("\n=== Test Complete ===")