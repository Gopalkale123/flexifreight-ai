import urllib.request
import re
import sqlite3
import time
import os
import sys
from html.parser import HTMLParser

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

TEHSILS = [
    ("anjangaon-surji", "Anjangaon Surji", "444705"),
    ("daryapur", "Daryapur", "444803"),
    ("achalpur", "Achalpur", "444806"),
    ("amravati", "Amravati", "444601"),
    ("bhatkuli", "Bhatkuli", "444602"),
    ("chandur-railway", "Chandur Railway", "444904"),
    ("chandurbazar", "Chandurbazar", "444704"),
    ("chikhaldara", "Chikhaldara", "444807"),
    ("dhamangaon-railway", "Dhamangaon Railway", "444709"),
    ("dharni", "Dharni", "444702"),
    ("morshi", "Morshi", "444905"),
    ("nandgaon-khandeshwar", "Nandgaon-Khandeshwar", "444708"),
    ("tiosa", "Tiosa", "444903"),
    ("warud", "Warud", "444906")
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

all_taluka_villages = {}

for slug, taluka_name, default_pin in TEHSILS:
    url = f"https://villageinfo.in/maharashtra/amravati/{slug}.html"
    print(f"Fetching {taluka_name} ({url})...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as res:
            html = res.read().decode('utf-8', errors='ignore')
            
        # Extract villages from links
        # Links format: /maharashtra/amravati/{slug}/{village-slug}/ or full url
        # Regex for <a href=".../slug/village-slug/">Village Name</a>
        anchors = re.findall(rf'<a\s+[^>]*href=["\'][^"\']*/maharashtra/amravati/{slug}/([^"\'/]+)/?["\'][^>]*>([^<]+)</a>', html, re.IGNORECASE)
        vils = []
        for v_slug, v_name in anchors:
            if v_slug in ['block', 'panchayats', 'about', 'contact', 'terms', 'privacy']:
                continue
            clean_name = v_name.strip()
            if clean_name and clean_name not in vils:
                vils.append(clean_name)
        
        # Fallback to slugs if anchor text was empty
        if not vils:
            matches = re.findall(rf'/maharashtra/amravati/{slug}/([^/"\s\?]+)/?', html)
            for m in matches:
                if m in ['block', 'panchayats', 'about', 'contact', 'terms', 'privacy']:
                    continue
                name = m.replace('-', ' ').title()
                if name not in vils:
                    vils.append(name)
                        
        print(f" -> Found {len(vils)} villages for {taluka_name}")
        all_taluka_villages[taluka_name] = vils
        time.sleep(0.5)
    except Exception as e:
        print(f"⚠️ Error fetching {taluka_name}: {e}")

# Save to SQLite & PostgreSQL
sqlite_path = r"c:\anti_gravity_workspace\flexifreight-ai\backend\data\india_villages.db"
conn = sqlite3.connect(sqlite_path)
cur = conn.cursor()

# Get existing postal villages for Amravati to preserve known pincodes
cur.execute("SELECT clean_name, pincode, taluk FROM villages WHERE district LIKE '%amravati%' OR district LIKE '%amaravati%'")
existing_postal = {}
for c_name, pin, t in cur.fetchall():
    existing_postal[c_name.strip().lower()] = pin

print(f"\nExisting postal cache has {len(existing_postal)} entries for Amravati.")

inserted_count = 0
for taluka_name, vils in all_taluka_villages.items():
    pin_for_taluka = next((p for s, t, p in TEHSILS if t == taluka_name), "444705")
    # Also add standard aliases for taluka (e.g. "Anjangaon" for "Anjangaon Surji")
    alias_taluka = taluka_name.replace(" Surji", "").replace(" Railway", "").replace("-Khandeshwar", "")
    
    for v in vils:
        clean_v = v.strip()
        # Check if known postal pincode exists
        v_pin = existing_postal.get(clean_v.lower(), pin_for_taluka)
        
        # Check if this village already exists in SQLite under this taluka
        cur.execute("""
            SELECT id FROM villages 
            WHERE clean_name = ? AND district = 'Amravati' AND (taluk = ? OR taluk = ?)
        """, (clean_v, taluka_name, alias_taluka))
        if not cur.fetchone():
            # Insert with taluka name
            cur.execute("""
                INSERT INTO villages (village_name, clean_name, pincode, office_type, taluk, district, state, delivery_status)
                VALUES (?, ?, ?, 'VILLAGE', ?, 'Amravati', 'Maharashtra', 'Delivery')
            """, (f"{clean_v} ({v_pin})", clean_v, v_pin, taluka_name))
            
            # If taluka has an alias, also insert or update alias so searches with either work
            if alias_taluka != taluka_name:
                cur.execute("""
                    INSERT INTO villages (village_name, clean_name, pincode, office_type, taluk, district, state, delivery_status)
                    VALUES (?, ?, ?, 'VILLAGE', ?, 'Amravati', 'Maharashtra', 'Delivery')
                """, (f"{clean_v} ({v_pin})", clean_v, v_pin, alias_taluka))
                
            inserted_count += 1

conn.commit()
conn.close()
print(f"Successfully inserted {inserted_count} new village records into SQLite!")

# Also write the dictionary to a python file or JSON so it can be directly imported
import json
with open(r"c:\anti_gravity_workspace\flexifreight-ai\backend\data\amravati_taluka_villages.json", "w", encoding="utf-8") as f:
    json.dump(all_taluka_villages, f, indent=2, ensure_ascii=False)
print("Saved amravati_taluka_villages.json successfully!")
