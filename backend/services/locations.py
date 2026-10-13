"""
Comprehensive All-India Location Hierarchy Service
Provides cascading: State -> District -> Taluka / Tehsil -> Village / Mandi
Covers all 28 States and 8 Union Territories with extensive talukas and village directories.
"""

from typing import Dict, List, Optional, Tuple
import re

import os
import json

HIERARCHY_JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "all_india_hierarchy.json")

# Exhaustive All-India Hierarchy (36 States/UTs, 658 Districts, 12,610 Talukas/Tehsils)
if os.path.exists(HIERARCHY_JSON_PATH):
    try:
        with open(HIERARCHY_JSON_PATH, "r", encoding="utf-8") as _f:
            INDIA_LOCATION_HIERARCHY: Dict[str, Dict[str, List[str]]] = json.load(_f)
    except Exception:
        from services.all_india_data import ALL_INDIA_MASTER_HIERARCHY
        INDIA_LOCATION_HIERARCHY: Dict[str, Dict[str, List[str]]] = ALL_INDIA_MASTER_HIERARCHY
else:
    try:
        from services.all_india_data import ALL_INDIA_MASTER_HIERARCHY
        INDIA_LOCATION_HIERARCHY: Dict[str, Dict[str, List[str]]] = ALL_INDIA_MASTER_HIERARCHY
    except Exception:
        from all_india_data import ALL_INDIA_MASTER_HIERARCHY
        INDIA_LOCATION_HIERARCHY: Dict[str, Dict[str, List[str]]] = ALL_INDIA_MASTER_HIERARCHY

# Extensive Village Directories for Key Agricultural & Freight Centers
TALUKA_VILLAGES_DATABASE: Dict[str, List[str]] = {
    # Maharashtra - Pune
    "Haveli": [
        "Uruli Kanchan", "Hadapsar", "Loni Kalbhor", "Wagholi", "Manjari Khurd",
        "Manjari Budruk", "Keshavnagar", "Phursungi", "Pisoli", "Undri", "Kondhwa",
        "Khadakwasla", "Donje", "Shivane", "Uttamnagar", "Nanded", "Kirkatwadi",
        "Wadgaon Sheri", "Kharadi", "Dhayari", "Narhe", "Ambegaon Budruk", "Bakori"
    ],
    "Baramati": [
        "Malegaon Budruk", "Malegaon Khurd", "Someshwar", "Supa", "Jalochi",
        "Shirsuphal", "Pandare", "Morgaon", "Karanje", "Undavadi", "Songaon",
        "Dhekalwadi", "Dorlewadi", "Mekhali", "Gadhidarwadi", "Khandaj", "Gunawadi"
    ],
    "Shirur": [
        "Ranjangaon MIDC", "Shikrapur", "Talegaon Dhamdhere", "Koregaon Bhima",
        "Sanaswadi", "Pabal", "Nhavare", "Mandavgan Pharata", "Kanhur Mesai", "Malthan"
    ],
    "Khed (Rajgurunagar)": [
        "Chakan MIDC", "Rajgurunagar", "Alandi Devachi", "Mahalunge", "Khed",
        "Kharpudi", "Kuruli", "Nighoje", "Moi", "Koyali", "Waki Budruk"
    ],
    "Mulshi": [
        "Pirangut", "Hinjawadi Infotech Park", "Paud", "Maan", "Marunji",
        "Kasarsai", "Ghotawade", "Lavale", "Bhugaon", "Bhukum", "Urawade", "Mutha"
    ],
    "Daund": [
        "Daund City", "Patas", "Kedgaon", "Yawat", "Boripardhi", "Kashti",
        "Khamgaon", "Varvand", "Ravangaon", "Gopalwadi", "Malharnagar"
    ],
    "Indapur": [
        "Indapur", "Bhigwan Mandi", "Nimgaon Ketki", "Bawada", "Kati",
        "Anthurne", "Palasdeo", "Shetphal", "Kalamb", "Varkute"
    ],
    "Junnar": [
        "Junnar City", "Alephata Mandi", "Narayangaon Tomato Market", "Otur",
        "Belhe", "Rajuri", "Dingore", "Shiroli", "Aptale", "Khamundi"
    ],
    "Ambegaon": [
        "Manchar Mandi", "Ghodegaon", "Avsari Khurd", "Shinoli", "Pargaon",
        "Dimbhe", "Nirgudsar", "Loni", "Kolgaon"
    ],

    # Maharashtra - Nashik
    "Niphad": [
        "Pimpalgaon Baswant (Asia's Largest Onion Mandi)", "Lasalgaon Mandi",
        "Ozar", "Niphad Town", "Saykheda", "Ranwad", "Kundewadi", "Vinchur", "Kasbe Sukene"
    ],
    "Dindori": [
        "Dindori", "Vani (Saptashrungi Road)", "Mohadi", "Janori", "Khedgaon", "Nanashi", "Jambhutke"
    ],
    "Sinnar": [
        "Sinnar Town", "Musalgaon MIDC", "Malegaon MIDC", "Pangri", "Wavi", "Baragaon Pimpri", "Gonde"
    ],
    "Malegaon": [
        "Malegaon City", "Camp Area", "Sayane", "Dabhadi", "Zodga", "Ravalgon", "Nimgaon"
    ],

    # Maharashtra - Ahmednagar
    "Rahata (Shirdi)": [
        "Shirdi Temple Town", "Rahata Town", "Kankuri", "Sakuri", "Pimplas", "Loni Pravarnagar", "Babhaleshwar Mandi"
    ],
    "Sangamner": [
        "Sangamner Mandi", "Ashwi", "Talegaon Dighe", "Gunjalwadi", "Chikhali", "Sukewadi", "Sakur"
    ],
    "Kopargaon": [
        "Kopargaon Town", "Pohegaon", "Kolpewadi", "Dhamori", "Yesgaon", "Savalvihir"
    ],
    "Shrirampur": [
        "Shrirampur Mandi", "Belapur Mandi", "Nipani Wadgaon", "Taklibhan", "Gondhavani"
    ],

    # Gujarat - Surat
    "Kamrej": [
        "Kamrej Town", "Kholvad", "Valthan", "Vav", "Laskana Diamond Hub",
        "Dhoran Pardi", "Navagam", "Sevni", "Kathor", "Velanja", "Antroli Bullet Train Hub"
    ],
    "Choryasi": [
        "Sachin GIDC", "Dumas", "Hazira Port Complex", "Bhatha", "Ichhapore",
        "Magdalla Port", "Mora", "Vesu", "Bhimrad", "Sultanabad", "Jahangirpura"
    ],
    "Olpad": [
        "Olpad Town", "Sayan Sugar Mandi", "Kim GIDC", "Karanj", "Kudsad", "Masma", "Saras", "Dandi"
    ],
    "Bardoli": [
        "Bardoli Town", "Swaraj Ashram", "Baben", "Afwa", "Ten", "Madhi Sugar Mandi", "Mota", "Kadod"
    ],

    # Gujarat - Ahmedabad
    "Sanand": [
        "Sanand GIDC Auto Hub", "Bavla Road Hub", "Shela", "Telav", "Chekhla", "Modasar", "Nal Sarovar Road", "Charodi"
    ],
    "Daskroi": [
        "Bopal", "Ghuma", "Aslali Logistics Hub", "Bareja", "Bhavda", "Changodar Industrial Area", "Moraiya"
    ],
    "Dholka": [
        "Dholka Town", "Gira Mandi", "Koth", "Saroda", "Rupgadh", "Ambaliyara"
    ],

    # Karnataka - Bengaluru Urban
    "Anekal": [
        "Anekal Town", "Electronic City Phase 1", "Electronic City Phase 2",
        "Attibele Border Post", "Chandapura Market", "Jigani Industrial Area", "Bommasandra", "Sarjapur Mandi"
    ],
    "Bengaluru North": [
        "Yelahanka", "Hebbal", "Jakkur", "Thanisandra", "Bagalur", "Doddajala", "Devanahalli Road"
    ],
    "Bengaluru South": [
        "Kengeri", "Bannerghatta", "Kumbalgodu Industrial Area", "Bidadi Link", "Uttarahalli", "Konanakunte"
    ],

    # Madhya Pradesh - Indore
    "Mhow (Dr. Ambedkar Nagar)": [
        "Mhow Cantonment", "Pithampur Sector 1 Link", "Pithampur Sector 2 Link", "Harnasa", "Gujarkheda", "Dongargaon"
    ],
    "Sanwer": [
        "Sanwer Town", "Kshipra Mandi", "Dhamnay", "Baroli", "Ajnod", "Panod"
    ],

    # Uttar Pradesh
    "Lucknow Sadar": [
        "Hazratganj", "Aminabad", "Gomti Nagar Logistics Hub", "Alambagh Bus Terminal Mandi", "Chinhat Industrial Area", "Dubagga Vegetable Mandi", "Mohanlalganj Road"
    ],
    "Noida": [
        "Sector 62 Tech Hub", "Sector 18 Commercial", "Sector 63 Logistics & Packaging Hub", "Bhangel", "Barola", "Noida Phase 2 Industrial Area", "Sector 137 Metro Hub"
    ],
    "Varanasi Sadar": [
        "Godowlia", "Lanka", "Shivpur Grain Mandi", "Paharia Mandi", "Ramnagar Industrial Area", "Sarnath", "Pandeypur"
    ],
    "Agra Sadar": [
        "Sanjay Place", "Sikandra Industrial Area", "Kuberpur Freight Hub", "Tajganj", "Bodla", "Runkata Mandi"
    ],

    # Rajasthan
    "Jaipur": [
        "Muhana Mandi (Terminal Market)", "VKIA (Vishwakarma Industrial Area)", "Sitapura Industrial Area", "Mansarovar", "Sanganer APMC", "Jhotwara", "Bassi Agro Zone"
    ],
    "Jodhpur": [
        "Basni Industrial Area", "Mandi Yard Mandore", "Boranada SEZ", "Sangaria Industrial Area", "Pal Village", "Banar Road Hub"
    ],

    # Punjab & Haryana
    "Ludhiana East": [
        "Focal Point Industrial Area", "Dhandari Kalan Logistics Hub", "Sahnewal", "Transport Nagar", "Gill Road Market", "Sherpur Chowk"
    ],
    "Gurugram": [
        "Manesar IMT Auto Hub", "Udyog Vihar", "Pataudi Road Logistics Park", "Badshahpur Mandi", "Farrukhnagar Warehousing Zone", "Hero Honda Chowk"
    ],

    # West Bengal & Bihar
    "Kolkata North": [
        "Posta Wholesale Market", "Burrabazar Grain Hub", "Kankurgachi", "Dum Dum Goods Yard", "Shyambazar", "Ultadanga"
    ],
    "Patna Sadar": [
        "Bazar Samiti (Musalpur Mandi)", "Patna City", "Danapur Cantt Area", "Digha Ghat", "Fatuha Industrial Area", "Didarganj Logistics Hub"
    ],

    # Default General Taluka Hubs
    "default": [
        "APMC Main Market Yard", "Central Bus Stand Area", "Industrial MIDC / GIDC / RIICO Area",
        "Gram Panchayat Office Area", "Kisan Mandi Yard", "Railway Station Bypass",
        "Bypass Highway Chowk", "Main Bazaar / Gaothan"
    ]
}

# Load extensive Amravati census village directories from JSON if available
_AMRAVATI_JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "amravati_taluka_villages.json")
if os.path.exists(_AMRAVATI_JSON_PATH):
    try:
        with open(_AMRAVATI_JSON_PATH, "r", encoding="utf-8") as _f:
            _extra_data = json.load(_f)
            for _t_name, _v_list in _extra_data.items():
                TALUKA_VILLAGES_DATABASE[_t_name] = _v_list
                _short = _t_name.replace(" Surji", "").replace(" Railway", "").replace("-Khandeshwar", "")
                if _short != _t_name:
                    TALUKA_VILLAGES_DATABASE[_short] = _v_list
    except Exception as _e:
        pass


def get_all_states() -> List[str]:
    """Returns sorted list of all available states."""
    return sorted(list(INDIA_LOCATION_HIERARCHY.keys()))


def get_districts_for_state(state: str) -> List[str]:
    """Returns list of districts for a given state."""
    if not state or state not in INDIA_LOCATION_HIERARCHY:
        return []
    return sorted(list(INDIA_LOCATION_HIERARCHY[state].keys()))


def _get_district_db_aliases(district: Optional[str]) -> List[str]:
    """Generates official and colloquial spelling aliases for Indian districts."""
    if not district:
        return []
    d = district.strip()
    clean = re.sub(r'\(.*?\)', '', d).strip()
    aliases = [d, clean]
    alias_dict = {
        'ahmednagar': ['Ahmed Nagar', 'Ahmednagar', 'Ahmadnagar'],
        'aurangabad': ['Aurangabad', 'Chhatrapati Sambhajinagar'],
        'chhatrapati sambhajinagar': ['Aurangabad', 'Chhatrapati Sambhajinagar'],
        'osmanabad': ['Osmanabad', 'Dharashiv'],
        'dharashiv': ['Osmanabad', 'Dharashiv'],
        'raigad': ['Raigarh(MH)', 'Raigarh', 'Raigad'],
        'mumbai': ['Mumbai', 'Mumbai City', 'Mumbai Suburban'],
        'pune': ['Pune'],
        'bengaluru': ['Bangalore', 'Bengaluru Urban', 'Bengaluru Rural', 'Bengaluru'],
        'bangalore': ['Bangalore', 'Bengaluru Urban', 'Bengaluru Rural', 'Bengaluru'],
        'mysuru': ['Mysore', 'Mysuru'],
        'mysore': ['Mysore', 'Mysuru'],
        'belagavi': ['Belgaum', 'Belagavi'],
        'belgaum': ['Belgaum', 'Belagavi'],
        'allahabad': ['Prayagraj', 'Allahabad'],
        'prayagraj': ['Prayagraj', 'Allahabad'],
        'faizabad': ['Ayodhya', 'Faizabad'],
        'ayodhya': ['Ayodhya', 'Faizabad'],
        'gurgaon': ['Gurugram', 'Gurgaon'],
        'gurugram': ['Gurugram', 'Gurgaon']
    }
    for k, v in alias_dict.items():
        if k in d.lower():
            aliases.extend(v)
    return list(dict.fromkeys(aliases))


def get_talukas_for_district(state: str, district: str) -> List[str]:
    """Returns list of all talukas/tehsils for a given district, pulling from the 12,610 all-India catalog."""
    if not state or not district:
        return []
    state_data = INDIA_LOCATION_HIERARCHY.get(state, {})
    talukas = state_data.get(district)
    if not talukas:
        aliases = _get_district_db_aliases(district)
        for a in aliases:
            if a in state_data:
                talukas = state_data[a]
                break
    if not talukas:
        for d, t_list in state_data.items():
            if district.lower() in d.lower() or d.lower() in district.lower():
                talukas = t_list
                break
    return talukas or []


import sqlite3
import os

DB_VILLAGES_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "india_villages.db")


def _get_taluka_sql_clauses(clean_taluka: str) -> Tuple[str, List[str]]:
    """
    Constructs precise SQL WHERE conditions and params for taluka matching.
    Prevents cross-taluka village leakage (e.g. Chandur Railway vs Chandur Bazar).
    """
    tl = clean_taluka.lower().strip()
    
    # 1. Distinguishing rules for talukas with shared prefix/words
    if "chandur railway" in tl or (tl == "chandur" and "bazar" not in tl):
        return (
            "(taluk LIKE '%Chandur Railway%' OR taluk LIKE '%Chandur Rly%' OR taluk LIKE '%Chandur Raiway%' OR taluk = 'Chandur') AND (taluk NOT LIKE '%Bazar%' AND taluk NOT LIKE '%Chandurbazar%')",
            []
        )
    elif "chandur bazar" in tl or "chandurbazar" in tl:
        return (
            "(taluk LIKE '%Chandur Bazar%' OR taluk LIKE '%Chandurbazar%') AND (taluk NOT LIKE '%Railway%' AND taluk NOT LIKE '%Rly%')",
            []
        )
    elif "dhamangaon" in tl:
        return (
            "(taluk LIKE '%Dhamangaon%')",
            []
        )
    elif "anjangaon" in tl:
        return (
            "(taluk LIKE '%Anjangaon%')",
            []
        )
    elif "nandgaon" in tl:
        return (
            "(taluk LIKE '%Nandgaon%')",
            []
        )
    elif "achalpur" in tl:
        return (
            "(taluk LIKE '%Achalpur%' OR taluk LIKE '%Paratwada%')",
            []
        )
    elif "tiosa" in tl or "teosa" in tl:
        return (
            "(taluk LIKE '%Tiosa%' OR taluk LIKE '%Teosa%')",
            []
        )
    elif "pune city" in tl:
        return (
            "(taluk = 'Pune City' OR taluk = 'Pune') AND (taluk NOT LIKE '%Haveli%' AND taluk NOT LIKE '%Baramati%' AND taluk NOT LIKE '%Shirur%' AND taluk NOT LIKE '%Khed%' AND taluk NOT LIKE '%Mulshi%' AND taluk NOT LIKE '%Junnar%' AND taluk NOT LIKE '%Daund%')",
            []
        )
    elif "nagpur urban" in tl:
        return (
            "(taluk LIKE '%Nagpur Urban%' OR taluk = 'Nagpur') AND taluk NOT LIKE '%Rural%'",
            []
        )
    elif "nagpur rural" in tl:
        return (
            "taluk LIKE '%Nagpur Rural%' AND taluk NOT LIKE '%Urban%'",
            []
        )
    elif "solapur north" in tl or "north solapur" in tl:
        return (
            "(taluk LIKE '%North%' OR taluk LIKE '%Solapur North%') AND taluk NOT LIKE '%South%'",
            []
        )
    elif "solapur south" in tl or "south solapur" in tl:
        return (
            "(taluk LIKE '%South%' OR taluk LIKE '%Solapur South%') AND taluk NOT LIKE '%North%'",
            []
        )
    
    # 2. General multi-word or single-word taluka
    words = [w for w in re.split(r'[\s\-\(\)\/]+', clean_taluka) if len(w) > 2 and w.lower() not in ['city', 'rural', 'urban', 'sadar', 'taluk', 'tehsil']]
    if len(words) >= 2:
        clause = "(taluk = ? COLLATE NOCASE OR taluk LIKE ? COLLATE NOCASE OR (taluk LIKE ? COLLATE NOCASE AND taluk LIKE ? COLLATE NOCASE))"
        params = [clean_taluka, f"%{clean_taluka}%", f"%{words[0]}%", f"%{words[1]}%"]
        return clause, params
    elif len(words) == 1:
        clause = "(taluk = ? COLLATE NOCASE OR taluk LIKE ? COLLATE NOCASE)"
        params = [clean_taluka, f"%{words[0]}%"]
        return clause, params
    else:
        clause = "(taluk = ? COLLATE NOCASE OR taluk LIKE ? COLLATE NOCASE)"
        params = [clean_taluka, f"%{clean_taluka}%"]
        return clause, params


def _query_villages_from_db(
    taluka: str, 
    district: Optional[str] = None, 
    query: Optional[str] = None,
    limit: int = 3500
) -> List[str]:
    """
    Queries official Indian Census/Postal Village Database for given Taluka and District.
    Supports viewing ALL villages in the district (if taluka is empty or '__ALL__').
    Uses district aliases and strict taluka matching to avoid cross-taluka leakage.
    """
    if not os.path.exists(DB_VILLAGES_PATH):
        return []
    
    clean_taluka = re.sub(r'\(.*?\)', '', (taluka or "")).strip()
    is_all_talukas = not clean_taluka or clean_taluka in ["__ALL__", "All Talukas", "Whole District", "All"] or "all talukas" in clean_taluka.lower()
    
    aliases = _get_district_db_aliases(district)
    
    try:
        conn = sqlite3.connect(DB_VILLAGES_PATH, timeout=5.0)
        cur = conn.cursor()
        
        # 1. Search Query:
        if query and query.strip():
            q = query.strip()
            params = []
            where_clauses = []
            if aliases:
                where_clauses.append('(' + ' OR '.join(['district LIKE ? COLLATE NOCASE' for _ in aliases]) + ')')
                params.extend([f"%{a}%" for a in aliases])
            
            # If a specific taluka is selected, filter strictly within that taluka
            if not is_all_talukas and clean_taluka:
                t_clause, t_params = _get_taluka_sql_clauses(clean_taluka)
                where_clauses.append(t_clause)
                params.extend(t_params)

            # Match search text against clean_name or pincode
            where_clauses.append('(clean_name LIKE ? COLLATE NOCASE OR pincode LIKE ?)')
            params.extend([f"%{q}%", f"{q}%"])
            params.append(limit)

            where_sql = ' AND '.join(where_clauses) if where_clauses else '1=1'
            cur.execute(f"""
                SELECT clean_name, pincode, taluk FROM villages
                WHERE {where_sql}
                GROUP BY clean_name
                ORDER BY clean_name
                LIMIT ?
            """, params)
            rows = cur.fetchall()
            conn.close()
            return [f"{r[0]} ({r[1]})" if r[1] else r[0] for r in rows]

        # 2. Entire District Mode (if All Talukas chosen or taluka is empty):
        if is_all_talukas and aliases:
            d_clause = ' OR '.join(['district LIKE ? COLLATE NOCASE' for _ in aliases])
            params = [f"%{a}%" for a in aliases] + [limit]
            cur.execute(f"""
                SELECT clean_name, pincode FROM villages 
                WHERE ({d_clause})
                GROUP BY clean_name 
                ORDER BY clean_name
                LIMIT ?
            """, params)
            rows = cur.fetchall()
            conn.close()
            return [f"{r[0]} ({r[1]})" if r[1] else r[0] for r in rows]

        # 3. Filter strictly by District + Taluka:
        rows = []
        t_clause, t_params = _get_taluka_sql_clauses(clean_taluka)

        if aliases:
            d_clause = ' OR '.join(['district LIKE ? COLLATE NOCASE' for _ in aliases])
            params = [f"%{a}%" for a in aliases] + t_params + [limit]
            cur.execute(f"""
                SELECT clean_name, pincode FROM villages 
                WHERE ({d_clause}) AND ({t_clause})
                GROUP BY clean_name 
                ORDER BY clean_name
                LIMIT ?
            """, params)
            rows = cur.fetchall()

        conn.close()
        return [f"{r[0]} ({r[1]})" if r[1] else r[0] for r in rows]
    except Exception as e:
        print(f"⚠️ Note querying villages DB: {e}")
        return []


def get_villages_for_taluka(
    taluka: str, 
    district: Optional[str] = None, 
    state: Optional[str] = None, 
    query: Optional[str] = None
) -> List[str]:
    """
    Returns exhaustive list of official villages, mandis, and post office branches for a specific taluka.
    Pulls from the 157,946+ All-India database, prepended with curated APMC Mandi yards.
    GUARANTEES that the taluka name itself is always included at the top of the village dropdown.
    """
    results: List[str] = []
    clean_tal = re.sub(r'\(.*?\)', '', (taluka or "")).strip()
    is_all_talukas = not clean_tal or clean_tal in ["__ALL__", "All Talukas", "Whole District", "All"] or "all talukas" in clean_tal.lower()
    
    # 1. If user typed a search query, search directly
    if query and query.strip():
        q_clean = query.strip().lower()
        db_villages = _query_villages_from_db(taluka, district, query=query)
        res_list = list(db_villages)
        if not is_all_talukas and clean_tal:
            taluka_hq_entry = f"{clean_tal} (Taluka HQ / APMC Mandi)"
            if q_clean in clean_tal.lower() or q_clean in taluka_hq_entry.lower():
                if taluka_hq_entry not in res_list:
                    res_list.insert(0, taluka_hq_entry)
                if clean_tal not in res_list:
                    res_list.insert(1, clean_tal)
        if not res_list:
            # Fallback to query as custom title
            return [query.strip().title()]
        return res_list

    # 2. Query official Indian Village & Post Office Database first (includes Pincode)
    db_villages = _query_villages_from_db(taluka, district, limit=3500)
    seen_clean = set()
    for v in db_villages:
        clean = re.sub(r'\(.*?\)', '', v).strip().lower()
        if clean and clean not in seen_clean:
            seen_clean.add(clean)
            results.append(v)
            
    # 3. Check curated APMC mandi / industrial / extra entries for this taluka
    curated = TALUKA_VILLAGES_DATABASE.get(taluka, [])
    clean_short = clean_tal.replace(" Surji", "").replace(" Railway", "").replace("-Khandeshwar", "")
    if not curated and clean_short != taluka:
        curated = TALUKA_VILLAGES_DATABASE.get(clean_short, [])
        
    for item in curated:
        clean = re.sub(r'\(.*?\)', '', item).strip().lower()
        if clean and clean not in seen_clean:
            seen_clean.add(clean)
            results.append(item)
            
    # 4. If no records found (rare sub-talukas), provide standard rural logistics nodes
    if not results:
        results = [
            f"{taluka} APMC Main Mandi Yard",
            f"{taluka} Gaothan / Central Bazaar",
            f"{taluka} Krishi Seva Kendra & Seed Hub",
            f"{taluka} Industrial Area (MIDC / GIDC / RIICO)",
            f"{taluka} Logistics & Warehouse Complex",
            f"{taluka} Railway Station Goods Shed",
            f"{taluka} Highway Bypass Chowk",
            f"{taluka} Gram Panchayat Complex",
            f"{taluka} North Agri Belt / Wadi",
            f"{taluka} South Mandi Link",
            f"{taluka} East Farmer Collective",
            f"{taluka} West Industrial Extension"
        ]

    # 5. USER REQUIREMENT: ALWAYS include that Taluka's name in villages dropdown!
    # Index 0: Taluka (Taluka HQ / APMC Mandi)
    # Index 1: Taluka (clean name without brackets)
    if not is_all_talukas and clean_tal:
        taluka_hq_entry = f"{clean_tal} (Taluka HQ / APMC Mandi)"
        # Remove if already exists elsewhere in list to avoid duplicates
        results = [r for r in results if r != taluka_hq_entry and r != clean_tal]
        results.insert(0, taluka_hq_entry)
        results.insert(1, clean_tal)

    return results


# Sample Pincode Resolver (Database backed + offline fallback)
PINCODE_REGISTRY: Dict[str, Dict[str, str]] = {
    # Maharashtra - Pune
    "411001": {"state": "Maharashtra", "district": "Pune", "taluka": "Pune City", "village": "Shivajinagar / Pune GPO"},
    "412201": {"state": "Maharashtra", "district": "Pune", "taluka": "Haveli", "village": "Uruli Kanchan"},
    "411028": {"state": "Maharashtra", "district": "Pune", "taluka": "Haveli", "village": "Hadapsar"},
    "412207": {"state": "Maharashtra", "district": "Pune", "taluka": "Shirur", "village": "Ranjangaon MIDC"},
    "412208": {"state": "Maharashtra", "district": "Pune", "taluka": "Shirur", "village": "Shikrapur"},
    "410501": {"state": "Maharashtra", "district": "Pune", "taluka": "Khed (Rajgurunagar)", "village": "Chakan MIDC"},
    "413102": {"state": "Maharashtra", "district": "Pune", "taluka": "Baramati", "village": "Baramati"},
    "411057": {"state": "Maharashtra", "district": "Pune", "taluka": "Mulshi", "village": "Hinjawadi Infotech Park"},
    "422209": {"state": "Maharashtra", "district": "Nashik", "taluka": "Niphad", "village": "Pimpalgaon Baswant"},
    "422306": {"state": "Maharashtra", "district": "Nashik", "taluka": "Niphad", "village": "Lasalgaon Mandi"}
}


def lookup_by_pincode(pincode: str) -> Optional[Dict[str, str]]:
    """Looks up State, District, Taluka, and Village by Indian 6-digit Pincode across all 155,570 codes."""
    clean_pin = re.sub(r"\D", "", pincode or "")
    if len(clean_pin) != 6:
        return None
        
    # Check comprehensive database first
    if os.path.exists(DB_VILLAGES_PATH):
        try:
            conn = sqlite3.connect(DB_VILLAGES_PATH, timeout=5.0)
            cur = conn.cursor()
            cur.execute("""
                SELECT clean_name, taluk, district, state 
                FROM villages 
                WHERE pincode = ? 
                LIMIT 1
            """, (clean_pin,))
            row = cur.fetchone()
            conn.close()
            if row:
                return {
                    "state": row[3].title(),
                    "district": row[2].title(),
                    "taluka": row[1].title() if row[1] != "NA" else row[2].title(),
                    "village": row[0]
                }
        except Exception:
            pass
            
    # Fallback to static registry
    if clean_pin in PINCODE_REGISTRY:
        return PINCODE_REGISTRY[clean_pin]
        
    return None

