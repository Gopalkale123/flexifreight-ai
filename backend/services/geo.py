"""
Geo Service: administrative boundaries, reverse geocoding and region-bounded
village lookup (OpenStreetMap / Nominatim) with polite rate-limiting and an
on-disk cache.

Used by:
  * /api/v1/locations/boundary        -> polygon of State / District / Taluka for the map picker
  * /api/v1/locations/reverse         -> click on map -> State/District/Taluka/Village (+ pincode)
  * /api/v1/locations/resolve-village -> custom village name -> coordinates inside the chosen taluka
  * agent.distance_agent              -> accurate geocoding that never leaves the selected region
"""

import difflib
import hashlib
import json
import os
import re
import threading
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

NOMINATIM = "https://nominatim.openstreetmap.org"
USER_AGENT = "FlexiFreightAI-Logistics/2.0 (freight geocoding)"
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "geo_cache")

_rate_lock = threading.Lock()
_last_call = 0.0
_mem_cache: Dict[str, Any] = {}


# --------------------------------------------------------------------------- #
# Low level: cached + rate limited Nominatim call
# --------------------------------------------------------------------------- #
def _cache_path(key: str) -> str:
    return os.path.join(CACHE_DIR, hashlib.sha1(key.encode("utf-8")).hexdigest() + ".json")


def _nominatim(endpoint: str, params: Dict[str, Any], timeout: float = 12.0) -> Optional[Any]:
    """GET Nominatim `endpoint` (search|reverse). Returns parsed JSON or None. Cached forever."""
    global _last_call
    clean = {k: v for k, v in params.items() if v not in (None, "")}
    qs = urllib.parse.urlencode(sorted(clean.items()))
    key = f"{endpoint}?{qs}"

    if key in _mem_cache:
        return _mem_cache[key]
    path = _cache_path(key)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            _mem_cache[key] = data
            return data
        except Exception:
            pass

    with _rate_lock:  # Nominatim usage policy: max 1 request / second
        wait = 1.1 - (time.time() - _last_call)
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(f"{NOMINATIM}/{endpoint}?{qs}", headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as res:
                data = json.loads(res.read().decode("utf-8"))
        except Exception as e:
            print(f"⚠️ Nominatim {endpoint} notice: {e}")
            return None
        finally:
            _last_call = time.time()

    _mem_cache[key] = data
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception:
        pass
    return data


# --------------------------------------------------------------------------- #
# Name helpers
# --------------------------------------------------------------------------- #
_NOISE = re.compile(r"\b(taluka|taluk|tehsil|tahsil|subdistrict|sub-district|district|division|city|rural|urban)\b", re.I)


def _clean(name: Optional[str]) -> str:
    n = re.sub(r"\(.*?\)", "", name or "")
    n = _NOISE.sub(" ", n)
    return re.sub(r"\s+", " ", n).strip()


def _norm(name: Optional[str]) -> str:
    return re.sub(r"[^a-z]", "", _clean(name).lower())


def _best_match(target: str, options: List[str], cutoff: float = 0.72) -> Optional[str]:
    t = _norm(target)
    if not t:
        return None
    norm_map = {o: _norm(o) for o in options}
    for o, n in norm_map.items():
        if n == t:
            return o
    for o, n in norm_map.items():
        if n and len(n) >= 4 and len(t) >= 4 and (n in t or t in n):
            return o
    scored = [(difflib.SequenceMatcher(None, t, n).ratio(), o) for o, n in norm_map.items() if n]
    if scored:
        score, opt = max(scored)
        if score >= cutoff:
            return opt
    return None


def _hierarchy() -> Dict[str, Dict[str, List[str]]]:
    from services.locations import INDIA_LOCATION_HIERARCHY
    return INDIA_LOCATION_HIERARCHY


def match_hierarchy(state: str = "", district: str = "", taluka: str = "") -> Dict[str, Optional[str]]:
    """Map raw OSM names onto the names used in the app's State -> District -> Taluka dropdowns."""
    h = _hierarchy()
    m_state = _best_match(state, list(h.keys()), 0.8) if state else None
    m_dist = m_tal = None
    if m_state:
        m_dist = _best_match(district, list(h[m_state].keys())) if district else None
        if not m_dist and taluka:  # OSM sometimes puts the district in `county`
            m_dist = _best_match(taluka, list(h[m_state].keys()), 0.9)
        if m_dist:
            m_tal = _best_match(taluka, h[m_state][m_dist]) if taluka else None
    return {"state": m_state, "district": m_dist, "taluka": m_tal}


# --------------------------------------------------------------------------- #
# Geometry helpers
# --------------------------------------------------------------------------- #
def _ring_contains(ring: List[List[float]], lng: float, lat: float) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def point_in_geojson(geojson: Optional[Dict[str, Any]], lat: float, lng: float) -> bool:
    if not geojson:
        return False
    polys = []
    if geojson.get("type") == "Polygon":
        polys = [geojson["coordinates"]]
    elif geojson.get("type") == "MultiPolygon":
        polys = geojson["coordinates"]
    for poly in polys:
        if poly and _ring_contains(poly[0], lng, lat) and not any(_ring_contains(h, lng, lat) for h in poly[1:]):
            return True
    return False


def _bbox_from_nominatim(bb: List[str]) -> List[float]:
    s, n, w, e = (float(x) for x in bb)  # Nominatim: south, north, west, east
    return [s, w, n, e]  # -> [south, west, north, east]


# --------------------------------------------------------------------------- #
# Boundaries
# --------------------------------------------------------------------------- #
def get_boundary(state: str = "", district: str = "", taluka: str = "") -> Dict[str, Any]:
    """
    Polygon for the deepest level supplied. Result:
    {found, level, name, geojson, bbox:[S,W,N,E], center:[lat,lng]}
    """
    taluka_c = _clean(taluka) if taluka and taluka != "__ALL__" else ""
    district_c = _clean(district)
    state_c = (state or "").strip()

    if taluka_c:
        level = "taluka"
        queries = [
            f"{taluka_c}, {district_c}, {state_c}, India",
            f"{taluka_c} taluka, {district_c} district, {state_c}, India",
            f"{taluka_c} tehsil, {district_c}, {state_c}, India",
        ]
        threshold = 0.0008
    elif district_c:
        level = "district"
        queries = [f"{district_c} district, {state_c}, India", f"{district_c}, {state_c}, India"]
        threshold = 0.004
    elif state_c:
        level = "state"
        queries = [f"{state_c}, India"]
        threshold = 0.02
    else:
        return {"found": False, "level": "country", "bbox": [6.5, 68.0, 35.7, 97.5], "center": [22.5, 79.0]}

    for q in queries:
        results = _nominatim("search", {
            "q": q, "format": "jsonv2", "polygon_geojson": 1, "polygon_threshold": threshold,
            "limit": 6, "countrycodes": "in", "addressdetails": 0,
        })
        if not results:
            continue
        polys = [r for r in results if r.get("geojson", {}).get("type") in ("Polygon", "MultiPolygon")]
        admin = [r for r in polys if r.get("category") == "boundary"] or polys
        if not admin:
            continue
        r = admin[0]
        bbox = _bbox_from_nominatim(r["boundingbox"])
        return {
            "found": True,
            "level": level,
            "name": r.get("display_name", "").split(",")[0],
            "geojson": r["geojson"],
            "bbox": bbox,
            "center": [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
        }

    # Fallback: parent level
    if level == "taluka":
        parent = get_boundary(state, district, "")
        parent["fallback_from"] = "taluka"
        return parent
    if level == "district":
        parent = get_boundary(state, "", "")
        parent["fallback_from"] = "district"
        return parent
    return {"found": False, "level": level, "bbox": [6.5, 68.0, 35.7, 97.5], "center": [22.5, 79.0]}


# --------------------------------------------------------------------------- #
# Reverse geocoding (click on map -> village + hierarchy)
# --------------------------------------------------------------------------- #
def reverse_geocode(lat: float, lng: float) -> Dict[str, Any]:
    # round so nearby clicks share a cache entry (~100 m)
    data = _nominatim("reverse", {
        "lat": round(lat, 3), "lon": round(lng, 3), "format": "jsonv2",
        "zoom": 16, "addressdetails": 1, "accept-language": "en",
    })
    if not data or "address" not in data:
        return {"found": False, "lat": lat, "lng": lng}
    a = data["address"]
    village = (a.get("village") or a.get("hamlet") or a.get("suburb") or a.get("town")
               or a.get("city_district") or a.get("neighbourhood") or a.get("locality")
               or a.get("city") or "")
    raw_taluka = a.get("county") or a.get("subdistrict") or a.get("municipality") or ""
    raw_district = a.get("state_district") or ""
    raw_state = a.get("state") or ""
    matched = match_hierarchy(raw_state, raw_district, raw_taluka)
    # city/town can itself be the taluka head-quarter
    if matched["district"] and not matched["taluka"]:
        town = a.get("town") or a.get("city") or village
        h = _hierarchy()
        matched["taluka"] = _best_match(town, h[matched["state"]][matched["district"]]) if town else None
    pincode = a.get("postcode", "")
    return {
        "found": True,
        "lat": lat, "lng": lng,
        "village": village,
        "pincode": pincode,
        "village_label": f"{village} ({pincode})" if village and pincode else village,
        "raw": {"state": raw_state, "district": raw_district, "taluka": raw_taluka},
        "state": matched["state"], "district": matched["district"], "taluka": matched["taluka"],
        "display_name": data.get("display_name", ""),
    }


# --------------------------------------------------------------------------- #
# Region-bounded village search
# --------------------------------------------------------------------------- #
def _viewbox(bbox: List[float], pad: float = 0.0) -> str:
    s, w, n, e = bbox
    return f"{w - pad},{n + pad},{e + pad},{s - pad}"  # left,top,right,bottom


def find_village(village: str, state: str = "", district: str = "", taluka: str = "",
                 limit: int = 5) -> List[Dict[str, Any]]:
    """
    Search `village` only inside the selected taluka (then district) and return candidates ranked:
    inside taluka polygon > inside district > unverified. Each: {lat,lng,name,display_name,scope,verified}
    """
    name = _clean(village)
    pin = re.search(r"\b(\d{6})\b", village or "")
    if not name and not pin:
        return []

    tal_b = get_boundary(state, district, taluka) if taluka and taluka != "__ALL__" else None
    dist_b = get_boundary(state, district, "") if district else None
    if tal_b and tal_b.get("fallback_from"):
        tal_b = None  # taluka polygon unavailable -> don't pretend we verified it

    scopes: List[Tuple[str, Dict[str, Any]]] = []
    if tal_b and tal_b.get("found"):
        scopes.append(("taluka", tal_b))
    if dist_b and dist_b.get("found"):
        scopes.append(("district", dist_b))

    out: List[Dict[str, Any]] = []
    seen = set()

    def _add(r: Dict[str, Any], scope: str, bound: Dict[str, Any]) -> None:
        la, lo = float(r["lat"]), float(r["lon"])
        k = (round(la, 3), round(lo, 3))
        if k in seen:
            return
        inside = point_in_geojson(bound.get("geojson"), la, lo)
        if not inside and scope != "none":
            return
        seen.add(k)
        out.append({
            "lat": la, "lng": lo,
            "name": r.get("name") or name,
            "display_name": ", ".join(r.get("display_name", "").split(", ")[:4]),
            "scope": scope,
            "verified": scope in ("taluka", "district"),
        })

    for scope, bound in scopes:
        for q in ([f"{name}"] if name else []) + ([] if not pin else [None]):
            params = {
                "format": "jsonv2", "limit": 8, "countrycodes": "in", "accept-language": "en",
                "viewbox": _viewbox(bound["bbox"], 0.02), "bounded": 1,
            }
            if q is None:
                params.update({"postalcode": pin.group(1)})
            else:
                params.update({"q": q})
            res = _nominatim("search", params) or []
            # prefer settlements over roads/shops with the same name
            res.sort(key=lambda r: 0 if r.get("category") == "place" else 1)
            for r in res:
                _add(r, scope, bound)
        if out:
            break  # best (smallest) scope that produced a hit wins

    return out[:limit]


# --------------------------------------------------------------------------- #
# Region validation for other geocoders
# --------------------------------------------------------------------------- #
def within_region(lat: float, lng: float, state: str = "", district: str = "", taluka: str = "") -> Optional[bool]:
    """True/False if the point is inside the district (or taluka) boundary; None if unknown."""
    try:
        b = get_boundary(state, district, "") if district else None
        if b and b.get("found") and b.get("geojson"):
            return point_in_geojson(b["geojson"], lat, lng)
    except Exception:
        pass
    return None
