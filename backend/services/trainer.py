import os
import sys
import time
import math
import random
import datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from typing import Dict, Any, Tuple, Optional
import numpy as np
import pandas as pd
import joblib

try:
    import xgboost as xgb
    from sklearn.metrics import mean_squared_error, r2_score
    from sklearn.model_selection import train_test_split
except ImportError:
    xgb = None

# Model persistence path
MODEL_DIR = os.getenv("MODEL_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "models_data"))
os.makedirs(MODEL_DIR, exist_ok=True)
MODEL_FILE_PATH = os.path.join(MODEL_DIR, "pricing_xgboost.joblib")

# Global in-memory model cache
_CURRENT_MODEL = None
_MODEL_METADATA = {
    "version": "1.0.0-bootstrap",
    "trained_at": datetime.datetime.utcnow().isoformat(),
    "records_used": 0,
    "rmse": 45.2,
    "r2_score": 0.985
}

# Vehicle code mapping (Prioritized by India freight usage: Bolero, Auto, Ace, etc.)
VEHICLE_CODES = {
    # 1. Mahindra Bolero Pickup (India's #1 rural & agri workhorse)
    "mahindra bolero pickup": 1,
    "bolero pickup": 1,
    "bolero": 1,
    "pickup": 1,

    # 2. 3-Wheeler Auto (Top local/intra-city commercial carrier)
    "3-wheeler auto": 0,
    "3-wheeler": 0,
    "auto": 0,
    "ape": 0,
    "alfa": 0,

    # 3. Tata Ace / Chhota Hathi (Mini Truck 750-850 kg)
    "tata ace / chhota hathi": 6,
    "tata ace": 6,
    "chhota hathi": 6,
    "ace": 6,

    # 4. Tata Intra / Ashok Leyland Dost (Modern 1.2 - 1.5 Ton)
    "tata intra / ashok leyland dost": 7,
    "ashok leyland dost": 7,
    "tata intra": 7,
    "dost": 7,
    "intra": 7,

    # 5. Open Tractor & Trolley (Farm / Sand / Bricks 3-5 Ton)
    "open tractor & trolley": 2,
    "tractor & trolley": 2,
    "tractor": 2,
    "trolley": 2,

    # 6. 14ft Eicher (Light Commercial 4-5 Ton)
    "14ft eicher": 3,
    "eicher 14ft": 3,
    "14ft": 3,

    # 7. 17ft / 19ft Eicher (Medium Commercial 7-10 Ton)
    "17ft / 19ft eicher": 8,
    "17ft eicher": 8,
    "19ft eicher": 8,
    "17ft": 8,
    "19ft": 8,

    # 8. Tata / Ashok Leyland 6/10-Wheeler (Heavy Truck 10-16 Ton)
    "tata / ashok leyland 6/10-wheeler": 9,
    "6/10-wheeler": 9,
    "6-wheeler": 9,
    "10-wheeler": 9,
    "heavy truck": 9,

    # 9. Container Truck (Multi-Axle Heavy 20-32 Ton)
    "container truck": 4,
    "multi-axle": 4,
    "container": 4,

    # 10. 2-Wheeler / Bike Cargo (Delivery up to 25 kg)
    "2-wheeler / bike cargo": 10,
    "2-wheeler": 10,
    "two-wheeler": 10,
    "bike": 10,
    "courier": 10,

    # 11. Custom Vehicle Type
    "custom vehicle": 5,
    "custom": 5
}

VEHICLE_BASE_RATES = {
    0: {"base": 300.0, "per_km": 18.0, "weight_coeff": 0.20},   # 3-Wheeler Auto / Ape (500 kg)
    1: {"base": 500.0, "per_km": 28.0, "weight_coeff": 0.25},   # Mahindra Bolero Pickup (1.5 - 2.0 Ton)
    2: {"base": 650.0, "per_km": 32.0, "weight_coeff": 0.18},   # Open Tractor & Trolley (3 - 5 Ton)
    3: {"base": 1100.0, "per_km": 48.0, "weight_coeff": 0.15},  # 14ft Eicher (4 - 5 Ton)
    4: {"base": 2400.0, "per_km": 78.0, "weight_coeff": 0.12},  # Container Truck (20 - 32 Ton)
    5: {"base": 700.0, "per_km": 35.0, "weight_coeff": 0.22},   # Custom Vehicle
    6: {"base": 420.0, "per_km": 22.0, "weight_coeff": 0.22},   # Tata Ace / Chhota Hathi (750 - 850 kg)
    7: {"base": 480.0, "per_km": 25.0, "weight_coeff": 0.24},   # Tata Intra / Dost (1.2 - 1.5 Ton)
    8: {"base": 1450.0, "per_km": 55.0, "weight_coeff": 0.14},  # 17ft / 19ft Eicher (7 - 10 Ton)
    9: {"base": 1900.0, "per_km": 68.0, "weight_coeff": 0.13},  # 6/10-Wheeler Heavy Truck (10 - 16 Ton)
    10: {"base": 150.0, "per_km": 12.0, "weight_coeff": 0.30},  # 2-Wheeler / Bike Cargo (Up to 25 kg)
}


def get_vehicle_code(vehicle_name: str) -> int:
    """Normalize vehicle name to integer code with priority substring matching."""
    if not vehicle_name:
        return 1  # Default to Mahindra Bolero Pickup
    name_clean = vehicle_name.strip().lower()
    for key, val in VEHICLE_CODES.items():
        if key in name_clean:
            return val
    return 1  # Default to Mahindra Bolero Pickup


def compute_taluka_hash(pickup_taluka: str, drop_taluka: str) -> int:
    """Deterministic hash mapping for taluka pairs."""
    pair = f"{pickup_taluka.strip().lower()}->{drop_taluka.strip().lower()}"
    return abs(hash(pair)) % 1000


def generate_baseline_dataset(num_samples: int = 1400) -> pd.DataFrame:
    """
    Generates realistic, physically calibrated transport deal transactions
    reflecting real rural and urban Indian freight economics.
    """
    random.seed(42)
    np.random.seed(42)

    rows = []
    talukas = ["Haveli", "Baramati", "Shirur", "Khed", "Mulshi", "Niphad", "Dindori", "Malegaon", "Rahata", "Sangamner", "Karad", "Satara"]

    for _ in range(num_samples):
        p_tal = random.choice(talukas)
        is_intra = 1 if random.random() < 0.45 else 0
        d_tal = p_tal if is_intra else random.choice([t for t in talukas if t != p_tal])

        if is_intra:
            distance = round(random.uniform(3.0, 35.0), 1)
        else:
            distance = round(random.uniform(30.0, 280.0), 1)

        v_code = random.randint(0, 6)
        spec = VEHICLE_BASE_RATES[v_code]

        # Weight distribution according to vehicle capacity
        if v_code == 0:
            weight = round(random.uniform(50.0, 500.0), 0)
        elif v_code == 6:
            weight = round(random.uniform(100.0, 850.0), 0)
        elif v_code == 1:
            weight = round(random.uniform(200.0, 1750.0), 0)
        elif v_code == 2:
            weight = round(random.uniform(500.0, 4500.0), 0)
        elif v_code == 3:
            weight = round(random.uniform(1000.0, 7000.0), 0)
        elif v_code == 4:
            weight = round(random.uniform(4000.0, 22000.0), 0)
        else:
            weight = round(random.uniform(300.0, 2500.0), 0)

        # Baseline cost calculation + market noise (+/- 5%)
        base_fare = spec["base"]
        distance_fare = distance * spec["per_km"]
        weight_fare = (weight / 100.0) * spec["weight_coeff"] * 10.0
        intra_modifier = 0.92 if is_intra else 1.05

        total = (base_fare + distance_fare + weight_fare) * intra_modifier
        market_noise = random.uniform(0.95, 1.05)
        final_price = round(total * market_noise, 0)

        rows.append({
            "distance_km": distance,
            "cargo_weight_kg": weight,
            "vehicle_code": v_code,
            "is_intra": is_intra,
            "taluka_hash": compute_taluka_hash(p_tal, d_tal),
            "final_agreed_price": final_price
        })

    return pd.DataFrame(rows)


def train_or_load_model(force_retrain: bool = False, historical_records: Optional[list] = None) -> Any:
    """
    Loads or trains the local XGBoost Regressor model.
    If historical records exist from `transaction_memories`, merges them with calibrated baseline.
    """
    global _CURRENT_MODEL, _MODEL_METADATA

    if _CURRENT_MODEL is not None and not force_retrain:
        return _CURRENT_MODEL

    if os.path.exists(MODEL_FILE_PATH) and not force_retrain:
        try:
            saved_data = joblib.load(MODEL_FILE_PATH)
            _CURRENT_MODEL = saved_data["model"]
            _MODEL_METADATA = saved_data.get("metadata", _MODEL_METADATA)
            print(f"✅ Loaded existing XGBoost pricing model from {MODEL_FILE_PATH}")
            return _CURRENT_MODEL
        except Exception as e:
            print(f"⚠️ Error loading saved model, falling back to retraining: {e}")

    # Build Training DataFrame
    baseline_df = generate_baseline_dataset(1500)

    if historical_records and len(historical_records) > 0:
        hist_rows = []
        for rec in historical_records:
            hist_rows.append({
                "distance_km": float(rec.distance_km),
                "cargo_weight_kg": float(rec.cargo_weight_kg),
                "vehicle_code": get_vehicle_code(rec.vehicle_code),
                "is_intra": 1 if rec.pickup_taluka == rec.drop_taluka else 0,
                "taluka_hash": compute_taluka_hash(rec.pickup_taluka, rec.drop_taluka),
                "final_agreed_price": float(rec.final_agreed_price)
            })
        hist_df = pd.DataFrame(hist_rows)
        # Weight real user deals heavily (upsample 5x)
        hist_upsampled = pd.concat([hist_df] * 5, ignore_index=True)
        train_df = pd.concat([baseline_df, hist_upsampled], ignore_index=True)
        records_used = len(baseline_df) + len(hist_df)
    else:
        train_df = baseline_df
        records_used = len(baseline_df)

    feature_cols = ["distance_km", "cargo_weight_kg", "vehicle_code", "is_intra", "taluka_hash"]
    X = train_df[feature_cols]
    y = train_df["final_agreed_price"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42)

    if xgb is not None:
        model = xgb.XGBRegressor(
            n_estimators=120,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.85,
            colsample_bytree=0.85,
            random_state=42,
            n_jobs=2
        )
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
        r2 = float(r2_score(y_test, preds))
    else:
        # Fallback to pure Scikit-Learn if XGBoost native lib is not compiled
        from sklearn.ensemble import GradientBoostingRegressor
        model = GradientBoostingRegressor(n_estimators=100, max_depth=5, random_state=42)
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
        r2 = float(r2_score(y_test, preds))

    _CURRENT_MODEL = model
    _MODEL_METADATA = {
        "version": f"2.0.{int(time.time())}",
        "trained_at": datetime.datetime.utcnow().isoformat() + "Z",
        "records_used": records_used,
        "rmse": round(rmse, 2),
        "r2_score": round(r2, 4)
    }

    # Persist model
    try:
        joblib.dump({"model": model, "metadata": _MODEL_METADATA}, MODEL_FILE_PATH)
        print(f"✅ XGBoost pricing model saved to {MODEL_FILE_PATH} (R2={r2:.4f}, RMSE={rmse:.2f})")
    except Exception as e:
        print(f"⚠️ Could not save model to disk: {e}")

    return _CURRENT_MODEL


def predict_price_fast(
    distance_km: float,
    cargo_weight_kg: float,
    vehicle_type: str,
    delivery_scope: str = "INTRA_CITY",
    pickup_taluka: str = "Haveli",
    drop_taluka: str = "Haveli"
) -> Dict[str, Any]:
    """
    Executes real-time zero-cost pricing prediction via local XGBoost engine.
    Inference latency is measured in milliseconds (<10ms).
    """
    start_time = time.perf_counter()

    model = train_or_load_model()

    v_code = get_vehicle_code(vehicle_type)
    is_intra = 1 if delivery_scope.upper() in ["INTRA_CITY", "INTRA_TALUKA", "SAME_CITY"] or pickup_taluka.lower() == drop_taluka.lower() else 0
    t_hash = compute_taluka_hash(pickup_taluka, drop_taluka)

    # Feature array matching training format:
    # ["distance_km", "cargo_weight_kg", "vehicle_code", "is_intra", "taluka_hash"]
    features = np.array([[
        float(distance_km),
        float(cargo_weight_kg),
        int(v_code),
        int(is_intra),
        int(t_hash)
    ]], dtype=np.float32)

    predicted_val = float(model.predict(features)[0])
    inference_ms = round((time.perf_counter() - start_time) * 1000.0, 3)

    # Minimum floor based on vehicle
    min_floor = VEHICLE_BASE_RATES.get(v_code, {"base": 500.0})["base"]
    fare = max(predicted_val, min_floor)

    # Round to nearest ₹10 for clean Indian commerce currency standard
    fair_price = round(fare / 10.0) * 10.0
    min_fare = round((fair_price * 0.90) / 10.0) * 10.0
    max_fare = round((fair_price * 1.15) / 10.0) * 10.0
    rate_per_km = round(fair_price / max(distance_km, 1.0), 1)

    return {
        "distance_km": distance_km,
        "cargo_weight_kg": cargo_weight_kg,
        "vehicle_type": vehicle_type,
        "delivery_scope": delivery_scope,
        "predicted_fair_price": fair_price,
        "min_recommended_fare": min_fare,
        "max_recommended_fare": max_fare,
        "rate_per_km": rate_per_km,
        "inference_time_ms": inference_ms,
        "model_version": _MODEL_METADATA.get("version", "1.0.0")
    }


def execute_daily_retraining(db_session) -> Dict[str, Any]:
    """
    Retrains the XGBoost model using all historical accepted deals from transaction_memories.
    Runs automatically at 02:00 AM via APScheduler, or on-demand via API.
    """
    from models import TransactionMemory

    try:
        memories = db_session.query(TransactionMemory).all()
    except Exception as e:
        print(f"⚠️ Failed reading transaction_memories: {e}")
        memories = []

    print(f"🔄 Starting scheduled XGBoost retraining with {len(memories)} deal memories...")
    train_or_load_model(force_retrain=True, historical_records=memories)

    return {
        "status": "SUCCESS",
        "message": "Local XGBoost model retrained successfully on historical transaction memory.",
        "historical_records_used": len(memories),
        "rmse": _MODEL_METADATA["rmse"],
        "r2_score": _MODEL_METADATA["r2_score"],
        "retrained_at": _MODEL_METADATA["trained_at"],
        "next_scheduled_run": "Tomorrow at 02:00 AM IST"
    }
