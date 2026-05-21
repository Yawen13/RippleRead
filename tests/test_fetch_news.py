import requests

# Test the fetch-news API
print("Testing news fetch API...")
try:
    response = requests.post("http://localhost:9000/api/fetch-news")
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Success: {result['message']}")
    else:
        print(f"❌ Failed with status: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"❌ Error: {str(e)}")

# Check the news content in database
print("\nChecking news content in database...")
import sqlite3
conn = sqlite3.connect('rippleread.db')
cursor = conn.cursor()
cursor.execute('SELECT id, title, LENGTH(content) as len FROM library WHERE source_type="news" ORDER BY id DESC LIMIT 5')
news_items = cursor.fetchall()

print(f"\nLatest {len(news_items)} news articles:")
for item in news_items:
    print(f"ID: {item[0]}, Title: {item[1][:50]}..., Content Length: {item[2]} characters")
    
    # Show first 200 chars of content
    cursor.execute('SELECT content FROM library WHERE id=?', (item[0],))
    content = cursor.fetchone()[0]
    print(f"Content preview:\n{content[:200]}...\n")

conn.close()