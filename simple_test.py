import sqlite3

# Check existing news content
conn = sqlite3.connect('rippleread.db')
cursor = conn.cursor()

# Delete old news to test fresh fetch
cursor.execute('DELETE FROM library WHERE source_type="news"')
conn.commit()
print("Deleted old news articles")

# Check remaining news
cursor.execute('SELECT COUNT(*) FROM library WHERE source_type="news"')
count = cursor.fetchone()[0]
print(f"News articles remaining: {count}")

conn.close()