"""
Vehicle Recommendation Agent
Specialized agent for analyzing:
- Package weight & volume (bags, bori, crates, drums, quintals, tons)
- Cargo category & fragility (agricultural, construction, industrial, liquids, perishables)
- Route distance & terrain constraints
- Fleet capacity constraints (Mahindra Bolero, 3-Wheeler Auto, Tata Ace, Intra/Dost, Tractor, Eicher, Container, 2-Wheeler)
Prioritizes India's most used and available commercial vehicles first.
"""

from typing import Dict, Any, List, Optional


FLEET_CATALOG = [
    {
        "name": "Mahindra Bolero Pickup",
        "display_name": "Mahindra Bolero Pickup (1.5 - 2.0 Ton)",
        "capacity_kg": 1750.0,
        "max_volumetric_units": 35,  # ~35 bags of 50kg
        "best_for": "India's #1 most used rural & mandi workhorse. Heavy farm produce (wheat, onions, sugarcane, vegetables), fertilizer drums, high payload clearance.",
        "icon": "pickup",
        "body_type": "Heavy Duty Pickup"
    },
    {
        "name": "3-Wheeler Auto",
        "display_name": "3-Wheeler Auto / Ape (500 kg)",
        "capacity_kg": 500.0,
        "max_volumetric_units": 10,  # ~10 bags/boxes
        "best_for": "Top choice for local bazaar deliveries, congested city lanes, lightweight farm crates, and small express parcels.",
        "icon": "auto",
        "body_type": "Compact 3-Wheeler"
    },
    {
        "name": "Tata Ace / Chhota Hathi",
        "display_name": "Tata Ace / Chhota Hathi (Mini Truck 750 - 850 kg)",
        "capacity_kg": 850.0,
        "max_volumetric_units": 18,  # ~17 bags of 50kg
        "best_for": "Universal 4-wheeler mini truck. 10-18 bori grain/produce, wholesale FMCG, electronics, agile all-round village and city transit.",
        "icon": "mini_truck",
        "body_type": "4-Wheeler Mini Truck"
    },
    {
        "name": "Tata Intra / Ashok Leyland Dost",
        "display_name": "Tata Intra / Ashok Leyland Dost (1.2 - 1.5 Ton)",
        "capacity_kg": 1350.0,
        "max_volumetric_units": 26,
        "best_for": "Modern high-deck mini truck for wholesale crates, mid-weight farm harvests, FMCG distribution with smooth highway cruising.",
        "icon": "pickup",
        "body_type": "Commercial Mid-Pickup"
    },
    {
        "name": "Open Tractor & Trolley",
        "display_name": "Open Tractor & Trolley (Agri / Construction 3-5 Ton)",
        "capacity_kg": 4000.0,
        "max_volumetric_units": 80,
        "best_for": "Direct farm-field harvest loading, raw sugarcane, sand, bricks, gravel, cement, and unpaved rough rural tracks.",
        "icon": "tractor",
        "body_type": "Agri Tractor Trolley"
    },
    {
        "name": "14ft Eicher",
        "display_name": "14ft Eicher (Light Truck 4-5 Ton)",
        "capacity_kg": 5000.0,
        "max_volumetric_units": 100,
        "best_for": "Inter-district mandi wholesale, 50-100 bags, industrial spares, timber, covered inter-city transport.",
        "icon": "medium_truck",
        "body_type": "14ft Intermediate Commercial Vehicle"
    },
    {
        "name": "17ft / 19ft Eicher",
        "display_name": "17ft / 19ft Eicher (Medium Truck 7-10 Ton)",
        "capacity_kg": 8500.0,
        "max_volumetric_units": 180,
        "best_for": "Inter-state wholesale distribution, grain mandis, construction materials, heavy machinery spares.",
        "icon": "medium_truck",
        "body_type": "Medium Commercial Vehicle"
    },
    {
        "name": "Tata / Ashok Leyland 6/10-Wheeler",
        "display_name": "Tata / Ashok Leyland 6/10-Wheeler (Heavy Truck 10-16 Ton)",
        "capacity_kg": 14000.0,
        "max_volumetric_units": 280,
        "best_for": "Heavy bulk freight, industrial steel, raw grain wholesale, national highway cargo corridors.",
        "icon": "heavy_truck",
        "body_type": "Heavy Commercial Vehicle"
    },
    {
        "name": "Container Truck",
        "display_name": "Container Truck (Multi-Axle Heavy 20-32 Ton)",
        "capacity_kg": 25000.0,
        "max_volumetric_units": 450,
        "best_for": "High-tonnage industrial freight, weather-sealed palletized cargo, long-distance interstate logistics corridors.",
        "icon": "heavy_truck",
        "body_type": "Multi-Axle Enclosed Container"
    },
    {
        "name": "2-Wheeler / Bike Cargo",
        "display_name": "2-Wheeler / Bike Cargo (Delivery up to 25 kg)",
        "capacity_kg": 25.0,
        "max_volumetric_units": 2,
        "best_for": "Hyperlocal rapid courier, urgent medical supplies, documents, small seeds or sample packs.",
        "icon": "bike",
        "body_type": "Two-Wheeler Cargo"
    }
]


def recommend_vehicle(
    cargo_weight_kg: float,
    goods_type: str = "General Cargo",
    handling_notes: str = "",
    distance_km: float = 25.0,
    delivery_scope: str = "INTRA_CITY",
    raw_goods_description: str = ""
) -> Dict[str, Any]:
    """
    Expert vehicle fleet selector evaluating weight bounds, volume, fragility, and route type.
    Prioritizes India's most available workhorses: Mahindra Bolero, 3-Wheeler Auto, and Tata Ace.
    """
    weight = max(float(cargo_weight_kg or 500.0), 5.0)
    desc_lower = (raw_goods_description or "").lower()
    handling_lower = (handling_notes or "").lower()
    goods_lower = (goods_type or "").lower()
    is_construction = any(k in desc_lower or k in goods_lower for k in ["sand", "reta", "bajri", "brick", "eent", "gravel", "stone", "trolley", "tractor"])
    is_perishable = any(k in desc_lower or k in handling_lower for k in ["perishable", "tamatar", "tomato", "vegetable", "milk", "fruits"])
    is_liquid_drums = any(k in desc_lower for k in ["drum", "liquid", "barrel", "chemical"])
    is_document_sample = any(k in desc_lower for k in ["sample", "document", "packet", "courier", "envelope", "letter"])

    recommended = "Mahindra Bolero Pickup"
    reason = ""
    confidence = 0.90

    # 0. Micro parcel ( <= 25 kg )
    if weight <= 25.0 and is_document_sample and distance_km < 35.0:
        recommended = "2-Wheeler / Bike Cargo"
        reason = (
            f"Cargo payload ({weight:,.0f} kg) is ideal for a 2-Wheeler Cargo / Bike delivery. "
            f"Provides fastest delivery through traffic with minimal courier transit cost."
        )
        confidence = 0.95

    # 1. Very heavy industrial / bulk ( > 14,000 kg )
    elif weight > 14000.0:
        recommended = "Container Truck"
        reason = (
            f"Cargo payload ({weight:,.0f} kg) requires a Multi-Axle Container Truck (20-32 Ton). "
            f"Ensures legal axle load limits, weatherproof transit, and high-volume deck space."
        )
        confidence = 0.96

    # 2. Heavy industrial / bulk ( 8,500 kg < weight <= 14,000 kg )
    elif weight > 8500.0:
        recommended = "Tata / Ashok Leyland 6/10-Wheeler"
        reason = (
            f"Payload ({weight:,.0f} kg) fits a 6/10-Wheeler Heavy Commercial Vehicle (14-ton payload). "
            f"Equipped for heavy commercial freight and long-distance inter-city transit."
        )
        confidence = 0.95

    # 3. Medium freight ( 5,000 kg < weight <= 8,500 kg )
    elif weight > 5000.0:
        recommended = "17ft / 19ft Eicher"
        reason = (
            f"Payload of {weight:,.0f} kg fits a 17ft/19ft Medium Truck (8.5-ton capacity). "
            f"Ideal for large wholesale mandi batches, timber, and voluminous manufacturing goods."
        )
        confidence = 0.94

    # 4. Light-to-medium freight ( 1,850 kg < weight <= 5,000 kg )
    elif weight > 1850.0:
        if is_construction and distance_km < 40.0:
            recommended = "Open Tractor & Trolley"
            reason = (
                f"Cargo ({weight:,.0f} kg of {goods_type}) on a {distance_km} km route is ideal for an "
                f"Open Tractor & Trolley. Offers rugged unpaved field mobility and hydraulic tipping."
            )
            confidence = 0.92
        else:
            recommended = "14ft Eicher"
            reason = (
                f"Payload of {weight:,.0f} kg exceeds pickup capacity. 14ft Eicher provides "
                f"5-ton legal payload with 14ft covered deck, ideal for safe inter-mandi transit."
            )
            confidence = 0.94

    # 5. Rural & Mandi Workhorse ( 1,350 kg < weight <= 1,850 kg )
    elif weight > 1350.0:
        recommended = "Mahindra Bolero Pickup"
        reason = (
            f"Cargo payload ({weight:,.0f} kg) is tailor-made for a Mahindra Bolero Pickup (1.75T limit). "
            f"India's #1 rural workhorse with rugged leaf-spring suspension and maximum mandi availability."
        )
        confidence = 0.96

    # 6. Modern Mid-Pickup ( 850 kg < weight <= 1,350 kg )
    elif weight > 850.0:
        # Both Bolero and Intra/Dost fit, Bolero is top used
        recommended = "Mahindra Bolero Pickup"
        reason = (
            f"Cargo payload ({weight:,.0f} kg) exceeds Tata Ace (850 kg limit). "
            f"Mahindra Bolero Pickup offers high safety reserve, rugged ground clearance, and instant driver availability."
        )
        confidence = 0.95

    # 7. Small-to-mid commercial ( 500 kg < weight <= 850 kg )
    elif weight > 480.0:
        recommended = "Tata Ace / Chhota Hathi"
        reason = (
            f"Payload ({weight:,.0f} kg) fits Tata Ace / Chhota Hathi (850 kg max capacity) with "
            f"{round(((850 - weight)/850)*100)}% safety reserve. Highly economical fuel mileage for local mandi transit."
        )
        confidence = 0.95

    # 8. Lightweight / Small parcel ( <= 500 kg )
    else:
        if distance_km > 60.0 or is_liquid_drums:
            recommended = "Tata Ace / Chhota Hathi"
            reason = (
                f"For {weight:,.0f} kg over {distance_km} km highway distance, Tata Ace 4-wheeler mini-truck "
                f"provides superior stability and highway cruising over a 3-wheeler auto."
            )
            confidence = 0.91
        else:
            recommended = "3-Wheeler Auto"
            reason = (
                f"Cargo weight ({weight:,.0f} kg) is well within the 500 kg capacity of a 3-Wheeler Auto / Ape. "
                f"Most economical option for tight bazaar streets and short-haul deliveries."
            )
            confidence = 0.94

    # Find recommended vehicle specs
    rec_spec = next((f for f in FLEET_CATALOG if f["name"] == recommended), FLEET_CATALOG[0])
    cap_kg = rec_spec["capacity_kg"]
    utilization_pct = min(round((weight / cap_kg) * 100.0, 1), 100.0)

    # Build comparative alternatives
    alternatives = []
    for f in FLEET_CATALOG:
        if f["name"] != recommended:
            fit_status = "Suitable Alternative"
            if weight > f["capacity_kg"]:
                fit_status = f"Overloaded (Exceeds {f['capacity_kg']:,.0f} kg)"
            elif weight < f["capacity_kg"] * 0.30:
                fit_status = "Excess Capacity (Higher Cost)"
            alternatives.append({
                "vehicle_name": f["name"],
                "display_name": f["display_name"],
                "capacity_kg": f["capacity_kg"],
                "status": fit_status,
                "is_viable": weight <= f["capacity_kg"] * 1.10
            })

    # Handling protection addendum
    special_advice = []
    if "fragile" in handling_lower:
        special_advice.append("Fragile goods: Ensure cushioned base & avoid rough bypass roads")
    if "perishable" in handling_lower or is_perishable:
        special_advice.append("Perishable produce: Direct express route recommended to prevent spoilage")
    if any(k in handling_lower for k in ["moisture", "tarpaulin", "tirpal"]):
        special_advice.append("Moisture sensitive: Tarpaulin (Tirpal) tie-downs mandatory")
    if is_liquid_drums:
        special_advice.append("Liquid drums: Upright strapping required")

    return {
        "recommended_vehicle": recommended,
        "display_name": rec_spec["display_name"],
        "capacity_kg": cap_kg,
        "vehicle_capacity_kg": cap_kg,
        "cargo_weight_kg": weight,
        "payload_utilization_pct": utilization_pct,
        "suitability_reason": reason,
        "recommendation_reason": reason,
        "confidence_score": confidence,
        "special_advice": " • ".join(special_advice) if special_advice else "Standard freight strapping recommended",
        "alternatives": alternatives
    }
