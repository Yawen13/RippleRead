import sqlite3
conn = sqlite3.connect('rippleread.db')

cursor = conn.execute("PRAGMA table_info(library)")
print("Library columns:", [row[1] for row in cursor.fetchall()])

cursor = conn.execute('SELECT COUNT(*) FROM library')
print('Library count:', cursor.fetchone()[0])

cursor = conn.execute('SELECT * FROM library LIMIT 2')
print('\nSample library items:')
for row in cursor.fetchall():
    print(row)

conn.close()