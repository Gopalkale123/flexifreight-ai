import sqlite3
import psycopg2
from psycopg2.extras import execute_values
import os
from dotenv import load_dotenv

load_dotenv(r"c:\anti_gravity_workspace\flexifreight-ai\.env")

sq = sqlite3.connect(r"c:\anti_gravity_workspace\flexifreight-ai\backend\data\india_villages.db")
cur = sq.cursor()
cur.execute("SELECT village_name, clean_name, pincode, office_type, taluk, district, state, delivery_status FROM villages WHERE office_type = 'VILLAGE'")
rows = cur.fetchall()
print(f"Total new revenue village records in SQLite to sync: {len(rows)}")

try:
    pg = psycopg2.connect(
        dbname=os.getenv("POSTGRES_DB", "flexifreight-ai"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "gopal123"),
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5433")
    )
    pcur = pg.cursor()
    # Delete existing 'VILLAGE' records for Amravati to avoid duplicates
    pcur.execute("DELETE FROM india_villages WHERE office_type = 'VILLAGE' AND district = 'Amravati'")
    execute_values(pcur, """
        INSERT INTO india_villages (village_name, clean_name, pincode, office_type, taluk, district, state, delivery_status)
        VALUES %s
    """, rows, page_size=2000)
    pg.commit()
    print("Successfully synchronized all new revenue villages to PostgreSQL!")
    pcur.close()
    pg.close()
except Exception as e:
    print(f"Note syncing to PG: {e}")

sq.close()
