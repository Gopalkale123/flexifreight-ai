"""
Pricing & Cost Estimation Agent
Specialized agent for applying tariff models, XGBoost ML pricing,
regional toll models, and corridor negotiation boundaries.
Takes inputs from Distance Agent (distance_km) and Vehicle Agent / User Selection (vehicle_type).
"""

from typing import Dict, Any, Optional
from services.trainer import predict_price_fast, VEHICLE_BASE_RATES, get_vehicle_code


def estimate_freight_pricing(
    distance_km: float,
    vehicle_type: str,
    cargo_weight_kg: float = 500.0,
    delivery_scope: str = "INTRA_CITY",
    pickup_taluka: str = "Haveli",
    drop_taluka: str = "Haveli"
) -> Dict[str, Any]:
    """
    Computes fair freight tariff breakdown combining local XGBoost Regressor
    and Indian transport tariff structures.
    """
    dist = max(float(distance_km or 10.0), 1.0)
    weight = max(float(cargo_weight_kg or 500.0), 10.0)
    v_code = get_vehicle_code(vehicle_type)
    rates = VEHICLE_BASE_RATES.get(v_code, {"base": 500.0, "per_km": 28.0, "weight_coeff": 0.25})

    # Run ML prediction (<2ms)
    ml_res = predict_price_fast(
        distance_km=dist,
        cargo_weight_kg=weight,
        vehicle_type=vehicle_type,
        delivery_scope=delivery_scope,
        pickup_taluka=pickup_taluka,
        drop_taluka=drop_taluka
    )

    fair_price = ml_res["predicted_fair_price"]

    # Component breakdown for transparency
    base_flagdown = rates["base"]
    distance_cost = round(dist * rates["per_km"], 0)
    weight_surcharge = round((weight / 100.0) * rates["weight_coeff"] * 10.0, 0)
    
    # Toll estimation: approx ₹100-200 per 100km on inter-city toll national highways
    estimated_toll = 0.0
    if delivery_scope.upper() == "INTER_CITY" and dist > 50.0:
        estimated_toll = round((dist / 65.0) * 110.0, 0)

    return {
        "distance_km": round(dist, 1),
        "cargo_weight_kg": round(weight, 1),
        "vehicle_type": vehicle_type,
        "delivery_scope": delivery_scope,
        "predicted_fair_price": fair_price,
        "min_recommended_fare": ml_res["min_recommended_fare"],
        "max_recommended_fare": ml_res["max_recommended_fare"],
        "rate_per_km": ml_res["rate_per_km"],
        "inference_time_ms": ml_res["inference_time_ms"],
        "model_version": ml_res["model_version"],
        "breakdown": {
            "base_flagdown_fee": base_flagdown,
            "distance_charge": distance_cost,
            "weight_surcharge": weight_surcharge,
            "estimated_toll_factor": estimated_toll
        },
        "tariff_model": f"Parivahan Freight Tariff Standard for {vehicle_type} (Base: ₹{base_flagdown} + ₹{rates['per_km']}/km)"
    }
