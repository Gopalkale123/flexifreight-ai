"""
Merge talukas found in india_villages.db into the curated all-India hierarchy
and persist the result to data/all_india_hierarchy.json.

Spelling variants of an already-known taluka (e.g. "Chandur Rly", "Daryapu")
are skipped so dropdowns stay clean; the village query layer already matches
those variants via LIKE clauses.

Usage:  python backend/scripts/build_hierarchy.py [--dry-run]
"""
import difflib
import json
import os
import re
import shutil
import sqlite3
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)

from services.all_india_data import ALL_INDIA_MASTER_HIERARCHY  # noqa: E402

DB_PATH = os.path.join(BACKEND, "data", "india_villages.db")
OUT_PATH = os.path.join(BACKEND, "data", "all_india_hierarchy.json")

DISTRICT_ALIASES = {
    "ahmed nagar": "Ahmednagar", "ahmadnagar": "Ahmednagar",
    "aurangabad": "Chhatrapati Sambhajinagar (Aurangabad)",
    "osmanabad": "Dharashiv (Osmanabad)",
    "raigarh(mh)": "Raigad", "raigarh mh": "Raigad",
    "mumbai": "Mumbai City",
    "bangalore": "Bengaluru Urban", "bangalore rural": "Bengaluru Rural",
    "mysore": "Mysuru", "belgaum": "Belagavi", "gulbarga": "Kalaburagi",
    "bellary": "Ballari", "bijapur": "Vijayapura",
    "allahabad": "Prayagraj", "faizabad": "Ayodhya", "gurgaon": "Gurugram",
}

NOISE_WORDS = {"railway", "rly", "raiway", "rs", "city", "tehsil", "taluk", "taluka", "khandeshwar"}


# Known alternate spellings / typos -> canonical normalised form
SYNONYMS = {
    "teosa": "tiosa", "newasa": "nevasa", "mawal": "maval",
    "paratwada": "achalpur", "ahmedangar": "nagar", "ahmednagar": "nagar", "amaravati": "amravati",
}


def norm(name: str) -> str:
    n = re.sub(r"\(.*?\)", "", name).lower()
    n = re.sub(r"[^a-z ]", " ", n)
    out = "".join(w for w in n.split() if w not in NOISE_WORDS)
    return SYNONYMS.get(out, out)


def is_variant(candidate: str, existing_norms: list) -> bool:
    c = norm(candidate)
    if not c:
        return True
    for e in existing_norms:
        if c == e or difflib.SequenceMatcher(None, c, e).ratio() >= 0.85:
            return True
        if len(c) >= 4 and len(e) >= 4 and (c in e or e in c):
            return True
    return False


def find_state(merged: dict, raw: str) -> str:
    for st in merged:
        if st.lower() == raw.lower() or st.lower() in raw.lower():
            return st
    key = raw.strip().title()
    merged.setdefault(key, {})
    return key


def find_district(districts: dict, raw: str) -> str:
    base = re.sub(r"\(.*?\)", "", raw).strip().lower()
    canon = DISTRICT_ALIASES.get(base)
    if canon and canon in districts:
        return canon
    raw_n = base.replace(" ", "").replace("-", "")
    for d in districts:
        d_n = re.sub(r"\(.*?\)", "", d).strip().lower().replace(" ", "").replace("-", "")
        if d_n == raw_n or d_n in raw_n or raw_n in d_n:
            return d
    key = raw.strip().title()
    districts.setdefault(key, [])
    return key


def main(dry_run: bool) -> None:
    merged = {st: {d: list(t) for d, t in ds.items()} for st, ds in ALL_INDIA_MASTER_HIERARCHY.items()}
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT state, district, taluk FROM villages "
        "WHERE taluk IS NOT NULL AND taluk NOT IN ('NA', '') "
        "GROUP BY state, district, taluk"
    ).fetchall()
    conn.close()

    added = skipped = 0
    for st_raw, d_raw, t_raw in rows:
        tal = t_raw.strip().title()
        if len(tal) < 2 or tal == "Na":
            continue
        st = find_state(merged, st_raw)
        d = find_district(merged[st], d_raw)
        existing = merged[st][d]
        if is_variant(tal, [norm(x) for x in existing]):
            skipped += 1
            continue
        existing.append(tal)
        added += 1

    total = sum(len(t) for ds in merged.values() for t in ds.values())
    print(f"Added {added} talukas, skipped {skipped} variants/duplicates. Total talukas: {total}")
    for dist in ("Amravati", "Pune", "Ahmednagar"):
        print(f"  Maharashtra/{dist}: {len(merged['Maharashtra'].get(dist, []))} -> {merged['Maharashtra'].get(dist)}")

    if dry_run:
        print("Dry run: nothing written.")
        return
    shutil.copy2(OUT_PATH, OUT_PATH + ".bak")
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=1)
    print(f"Wrote {OUT_PATH} (backup: .bak)")


if __name__ == "__main__":
    main("--dry-run" in sys.argv)
