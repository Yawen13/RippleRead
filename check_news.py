import sqlite3

conn = sqlite3.connect('rippleread.db')
cursor = conn.cursor()

# Get all news articles
cursor.execute('SELECT id, title, LENGTH(content) as len FROM library WHERE source_type="news"')
news_items = cursor.fetchall()

print("News articles in database:")
for item in news_items:
    print(f"ID: {item[0]}, Title: {item[1][:50]}..., Content Length: {item[2]}")

# Check content of a specific article
if news_items:
    print("\n--- Content of first news article ---")
    cursor.execute('SELECT content FROM library WHERE id=?', (news_items[0][0],))
    content = cursor.fetchone()[0]
    print(f"Content (first 500 chars):\n{content[:500]}...")

conn.close()