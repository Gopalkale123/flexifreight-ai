"""
Orchestrator / Coordinator Agent
Team Lead Agent:
- Receives user freight intent and coordinates specialized sub-agents:
  1. Cargo Parsing Agent (Vernacular NLP / LangGraph)
  2. Distance & Geocoding Agent (Google Maps API / Indian Geodesic Road Engine)
  3. Vehicle Recommendation Agent (Capacity, Volume & Fragility Matcher)
  4. Pricing & Cost Estimation Agent (XGBoost Fare & Tariff Calculator)
- Assembles comprehensive multi-agent response with audit trail.
"""

from typing import Dict, Any, Optional
from agent.graph import parse_cargo_description
from agent.distance_agent import calculate_distance_and_transit
from agent.vehicle_agent import recommend_vehicle
from agent.pricing_agent import estimate_freight_pricing


def coordinate_freight_workflow(
    raw_goods_description: str,
    pickup_state: str = "Maharashtra",
    pickup_district: str = "Pune",
    pickup_taluka: str = "Haveli",
    pickup_village: Optional[str] = None,
    pickup_lat: Optional[float] = None,
    pickup_lng: Optional[float] = None,
    drop_state: Optional[str] = None,
    drop_district: Optional[str] = None,
    drop_taluka: Optional[str] = None,
    drop_village: Optional[str] = None,
    drop_lat: Optional[float] = None,
    drop_lng: Optional[float] = None,
    user_distance_km: Optional[float] = None,
    user_vehicle_preference: Optional[str] = None,
    delivery_scope: str = "INTRA_CITY",
    api_key_override: Optional[str] = None
) -> Dict[str, Any]:
    """
    Orchestrates the specialized multi-agent pipeline.
    """
    trace = []

    # 1. Cargo Parsing Agent
    cargo_res = parse_cargo_description(raw_goods_description or "General Freight Cargo")
    weight = float(cargo_res.get("parsed_cargo_weight_kg", 500.0))
    goods_type = str(cargo_res.get("parsed_goods_type", "General Goods"))
    handling_notes = str(cargo_res.get("handling_notes", "Standard cargo tie-downs"))
    trace.append({
        "agent": "Cargo Parsing Agent",
        "action": f"Extracted {weight} kg ({goods_type}) from user text",
        "engine": cargo_res.get("engine_used", "Vernacular NLP")
    })

    # 2. Distance & Geocoding Agent
    distance_res = calculate_distance_and_transit(
        pickup_state=pickup_state,
        pickup_district=pickup_district,
        pickup_taluka=pickup_taluka,
        pickup_village=pickup_village,
        pickup_lat=pickup_lat,
        pickup_lng=pickup_lng,
        drop_state=drop_state,
        drop_district=drop_district,
        drop_taluka=drop_taluka,
        drop_village=drop_village,
        drop_lat=drop_lat,
        drop_lng=drop_lng,
        user_distance_km=user_distance_km,
        delivery_scope=delivery_scope,
        api_key_override=api_key_override
    )
    dist_km = distance_res["distance_km"]
    trace.append({
        "agent": "Distance & Geocoding Agent",
        "action": f"Determined road distance: {dist_km} km ({distance_res['duration_text']})",
        "method": distance_res["calculation_method"]
    })

    # 3. Vehicle Recommendation Agent
    vehicle_rec = recommend_vehicle(
        cargo_weight_kg=weight,
        goods_type=goods_type,
        handling_notes=handling_notes,
        distance_km=dist_km,
        delivery_scope=delivery_scope,
        raw_goods_description=raw_goods_description
    )
    recommended_v = vehicle_rec["recommended_vehicle"]
    trace.append({
        "agent": "Vehicle Recommendation Agent",
        "action": f"Recommended {recommended_v} ({vehicle_rec['display_name']})",
        "reason": vehicle_rec["suitability_reason"]
    })

    # 4. Pricing & Cost Estimation Agent
    # User's vehicle preference takes precedence if provided, otherwise recommended vehicle
    effective_vehicle = user_vehicle_preference if user_vehicle_preference else recommended_v
    
    pricing_res = estimate_freight_pricing(
        distance_km=dist_km,
        vehicle_type=effective_vehicle,
        cargo_weight_kg=weight,
        delivery_scope=delivery_scope,
        pickup_taluka=pickup_taluka,
        drop_taluka=drop_taluka or pickup_taluka
    )
    trace.append({
        "agent": "Pricing & Cost Estimation Agent",
        "action": f"Calculated fair price: ₹{pricing_res['predicted_fair_price']} for {effective_vehicle} over {dist_km} km",
        "model": pricing_res["model_version"]
    })

    return {
        "orchestrator_summary": f"Coordinated 4 specialized agents. Distance: {dist_km} km • Vehicle: {effective_vehicle} • Fair Fare: ₹{pricing_res['predicted_fair_price']}",
        "cargo": cargo_res,
        "distance": distance_res,
        "vehicle_recommendation": vehicle_rec,
        "effective_vehicle": effective_vehicle,
        "is_user_override_vehicle": bool(user_vehicle_preference and user_vehicle_preference != recommended_v),
        "pricing": pricing_res,
        "agent_trace": trace
    }
