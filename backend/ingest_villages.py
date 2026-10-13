import os
import sys
import time
import sqlite3
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv(r"c:\anti_gravity_workspace\flexifreight-ai\.env")
db_url = os.getenv("DATABASE_URL")
engine = create_engine(db_url)

sqlite_path = r"c:\anti_gravity_workspace\flexifreight-ai\backend\data\india_villages.db"
sq_conn = sqlite3.connect(sqlite_path)
sq_cur = sq_conn.cursor()

with engine.connect() as conn:
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS india_villages (
            id SERIAL PRIMARY KEY,
            village_name VARCHAR(150),
            clean_name VARCHAR(150),
            pincode VARCHAR(10),
            office_type VARCHAR(20),
            taluk VARCHAR(100),
            district VARCHAR(100),
            state VARCHAR(100),
            delivery_status VARCHAR(50)
        );
        CREATE INDEX IF NOT EXISTS idx_pg_villages_dist_taluk ON india_villages(LOWER(district), LOWER(taluk));
        CREATE INDEX IF NOT EXISTS idx_pg_villages_taluk ON india_villages(LOWER(taluk));
        CREATE INDEX IF NOT EXISTS idx_pg_villages_pincode ON india_villages(pincode);
    """))
    conn.commit()
    existing_pg = conn.execute(text("SELECT COUNT(*) FROM india_villages")).scalar()

print(f"Existing rows in PostgreSQL: {existing_pg}")

if existing_pg < 150000:
    print("Populating PostgreSQL from SQLite...")
    sq_cur.execute("SELECT village_name, clean_name, pincode, office_type, taluk, district, state, delivery_status FROM villages")
    rows = sq_cur.fetchall()
    
    import psycopg2
    from psycopg2.extras import execute_values
    
    pg_conn = psycopg2.connect(
        dbname=os.getenv("POSTGRES_DB", "flexifreight-ai"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "gopal123"),
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5433")
    )
    pg_cur = pg_conn.cursor()
    t0 = time.time()
    execute_values(pg_cur, """
        INSERT INTO india_villages (village_name, clean_name, pincode, office_type, taluk, district, state, delivery_status)
        VALUES %s
    """, rows, page_size=10000)
    pg_conn.commit()
    pg_cur.close()
    pg_conn.close()
    print(f"Populated {len(rows)} villages into PostgreSQL in {time.time()-t0:.2f}s!")
else:
    print(f"PostgreSQL already populated with {existing_pg} villages.")

with engine.connect() as conn:
    cnt = conn.execute(text("SELECT COUNT(*) FROM india_villages")).scalar()
    size_res = conn.execute(text("SELECT pg_size_pretty(pg_total_relation_size('india_villages'))")).scalar()
    print(f"PostgreSQL: {cnt} rows | Total Disk Size (Data + Indexes): {size_res}")

sq_conn.close()
