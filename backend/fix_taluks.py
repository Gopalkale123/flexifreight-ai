import sqlite3
import time
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

db_path = r"c:\anti_gravity_workspace\flexifreight-ai\backend\data\india_villages.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Create index on pincode
t0 = time.time()
cur.execute("CREATE INDEX IF NOT EXISTS idx_pincode ON villages(pincode)")
conn.commit()
print(f"Index on pincode created in {time.time()-t0:.2f}s")

# 2. Build mapping (pincode, district.lower()) -> taluk
t1 = time.time()
cur.execute("SELECT pincode, district, taluk FROM villages WHERE taluk != 'NA' AND taluk != '' AND taluk IS NOT NULL")
pin_to_taluk = {}
for p, d, t in cur.fetchall():
    key = (p.strip(), d.strip().lower())
    if key not in pin_to_taluk:
        pin_to_taluk[key] = t.strip()

print(f"Mapped {len(pin_to_taluk)} pincode-district pairs in {time.time()-t1:.2f}s")

# 3. Fetch rows needing update
cur.execute("SELECT id, pincode, district FROM villages WHERE taluk = 'NA' OR taluk = '' OR taluk IS NULL")
to_update = []
for _id, p, d in cur.fetchall():
    key = (p.strip(), d.strip().lower())
    t = pin_to_taluk.get(key)
    if t:
        to_update.append((t, _id))

print(f"Found {len(to_update)} rows to backfill.")
cur.executemany("UPDATE villages SET taluk = ? WHERE id = ?", to_update)
conn.commit()
print(f"Updated {len(to_update)} rows in {time.time()-t1:.2f}s!")

# 4. Test Anjangaon in Amravati
cur.execute("""
    SELECT clean_name, pincode, taluk 
    FROM villages 
    WHERE district = 'Amravati' COLLATE NOCASE AND taluk LIKE '%Anjangaon%'
    ORDER BY clean_name
""")
rows = cur.fetchall()
print(f"Total villages under Anjangaon in Amravati now: {len(rows)}")
for r in rows[:15]:
    print(" ", r)

# 5. Also sync to PostgreSQL if PostgreSQL is reachable
try:
    from dotenv import load_dotenv
    import psycopg2
    load_dotenv(r"c:\anti_gravity_workspace\flexifreight-ai\.env")
    pg_conn = psycopg2.connect(
        dbname=os.getenv("POSTGRES_DB", "flexifreight-ai"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "gopal123"),
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5433")
    )
    pg_cur = pg_conn.cursor()
    pg_cur.execute("""
        UPDATE india_villages iv
        SET taluk = sub.taluk
        FROM (
            SELECT DISTINCT pincode, LOWER(district) as ldist, taluk
            FROM india_villages
            WHERE taluk != 'NA' AND taluk != '' AND taluk IS NOT NULL
        ) sub
        WHERE iv.pincode = sub.pincode 
          AND LOWER(iv.district) = sub.ldist
          AND (iv.taluk = 'NA' OR iv.taluk = '' OR iv.taluk IS NULL);
    """)
    pg_conn.commit()
    print("PostgreSQL updated with backfilled taluks successfully.")
    pg_cur.close()
    pg_conn.close()
except Exception as e:
    print(f"Note on PostgreSQL sync: {e}")

conn.close()
