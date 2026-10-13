import os
import re
import json
from typing import Dict, Any, TypedDict, List
from dotenv import load_dotenv

load_dotenv()

# LangGraph imports
try:
    from langgraph.graph import StateGraph, END
    from langchain_core.messages import SystemMessage, HumanMessage
    from langchain_openai import ChatOpenAI
    HAS_LANGGRAPH = True
except ImportError:
    HAS_LANGGRAPH = False


class CargoState(TypedDict):
    raw_text: str
    cleaned_text: str
    parsed_goods_type: str
    parsed_cargo_weight_kg: float
    handling_notes: str
    urgency_level: str
    confidence_score: float
    engine_used: str


# ===================== VERNACULAR & PHONETIC NLP HEURISTICS =====================

VERNACULAR_WEIGHT_MULTIPLIERS = {
    "bag": 50.0,
    "bags": 50.0,
    "bori": 50.0,
    "boriya": 50.0,
    "katta": 50.0,
    "katte": 50.0,
    "poti": 50.0,
    "sack": 50.0,
    "sacks": 50.0,
    "box": 15.0,
    "boxes": 15.0,
    "crate": 20.0,
    "crates": 20.0,
    "peti": 20.0,
    "petiya": 20.0,
    "drum": 200.0,
    "drums": 200.0,
    "barrel": 200.0,
    "quintal": 100.0,
    "kintal": 100.0,
    "ton": 1000.0,
    "tons": 1000.0,
    "tonne": 1000.0,
    "tonnes": 1000.0,
    "kg": 1.0,
    "kilo": 1.0,
    "kgs": 1.0
}

COMMODITY_CATEGORIES = {
    "Agricultural Produce": ["wheat", "gehu", "rice", "chawal", "onion", "kanda", "pyaz", "potato", "aloo", "batata", "soybean", "cotton", "kapas", "sugar", "cane", "grain", "seeds", "corn", "makka", "fruits", "vegetables", "tamatar", "tomato"],
    "Construction Materials": ["cement", "sand", "reta", "bajri", "bricks", "eent", "steel", "tmt", "pipes", "tiles", "gravel", "stone", "marble", "iron"],
    "Industrial & Hardware": ["machinery", "motor", "pump", "generator", "spare", "drums", "chemical", "paint", "valves", "cables", "batteries"],
    "FMCG & Groceries": ["oil", "dal", "groceries", "packaged", "soap", "detergent", "atta", "spices", "cartons", "biscuits"],
    "Household & Furniture": ["furniture", "sofa", "bed", "almirah", "household", "luggage", "shifting", "fridge", "tv", "cooler"]
}


def heuristic_parse_cargo(text: str) -> Dict[str, Any]:
    """
    High-precision fallback heuristic parser for Indian freight terminology.
    Extracts weights, packaging units (bori, bags, quintals, tons), and classification.
    """
    clean_text = text.lower()

    # 1. Detect Category
    detected_category = "General Cargo / Miscellaneous"
    for category, keywords in COMMODITY_CATEGORIES.items():
        if any(kw in clean_text for kw in keywords):
            detected_category = category
            break

    # 2. Extract Numbers & Multipliers (e.g., '15 bags', '50 quintal', '3 ton', '500 kg')
    total_weight_kg = 0.0
    matched = False

    # Check patterns like "15 bags", "20 bori", "5 tons"
    unit_pattern = r'(\d+(?:\.\d+)?)\s*(bag|bags|bori|boriya|katta|katte|poti|sack|sacks|box|boxes|crate|crates|peti|petiya|drum|drums|quintal|kintal|ton|tons|tonne|tonnes|kg|kgs|kilo)'
    matches = re.findall(unit_pattern, clean_text)

    if matches:
        for num_str, unit in matches:
            val = float(num_str)
            mult = VERNACULAR_WEIGHT_MULTIPLIERS.get(unit, 1.0)
            total_weight_kg += val * mult
            matched = True

    # Check standalone numbers (e.g. "500 wheat" or just numeric with kg implied)
    if not matched:
        standalone_num = re.search(r'\b(\d{2,6})\b', clean_text)
        if standalone_num:
            val = float(standalone_num.group(1))
            total_weight_kg = val if val > 20 else val * 50.0  # assume bags if small number
        else:
            total_weight_kg = 500.0  # sensible default

    # 3. Handling Notes
    handling = []
    if any(k in clean_text for k in ["fragile", "glass", "kaanch", "delicate", "careful"]):
        handling.append("Fragile: Handle with care")
    if any(k in clean_text for k in ["perishable", "tamatar", "tomato", "vegetables", "milk", "fruits"]):
        handling.append("Perishable Goods: Avoid high heat / ensure fast transit")
    if any(k in clean_text for k in ["cement", "wheat", "rice", "flour", "atta", "sugar"]):
        handling.append("Moisture Sensitive: Cover with tarpaulin / Tirpal mandatory")
    if any(k in clean_text for k in ["drum", "chemical", "oil", "liquid"]):
        handling.append("Liquid Drums: Keep upright & tightly strapped")

    if not handling:
        handling.append("Standard Freight Cargo: Secure straps required")

    return {
        "parsed_goods_type": detected_category,
        "parsed_cargo_weight_kg": round(total_weight_kg, 1),
        "handling_notes": " • ".join(handling),
        "urgency_level": "High" if "urgent" in clean_text or "fast" in clean_text else "Standard",
        "confidence_score": 0.88 if matched else 0.72,
        "engine_used": "Heuristic Vernacular NLP Engine"
    }


# ===================== LANGGRAPH WORKFLOW NODES =====================

def clean_and_normalize_node(state: CargoState) -> Dict[str, Any]:
    raw = state.get("raw_text", "")
    # Normalize extra whitespaces and standardize commas
    cleaned = re.sub(r'\s+', ' ', raw).strip()
    return {"cleaned_text": cleaned}


def llm_extraction_node(state: CargoState) -> Dict[str, Any]:
    text = state.get("cleaned_text", state.get("raw_text", ""))
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    # If valid OpenAI API key is present and LangChain/LangGraph is available
    if HAS_LANGGRAPH and openai_key and not openai_key.startswith("your_openai"):
        try:
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=openai_key, request_timeout=2.5)
            system_prompt = (
                "You are an expert Indian freight transport AI parser. "
                "Analyze the user's free-text cargo description (which may contain English, Hindi, or Marathi freight terms like '15 bori gehu', '3 tons steel', '50 crates tamatar'). "
                "Extract:\n"
                "1. parsed_goods_type: Category (e.g. Agricultural Produce, Construction Materials, etc.)\n"
                "2. parsed_cargo_weight_kg: Total estimated weight in kilograms (convert bags/bori to 50kg, quintal to 100kg, tons to 1000kg, crates to 20kg if needed)\n"
                "3. handling_notes: Crucial loading/protection advice (e.g., Tarpaulin needed for rain, Keep drums upright, Perishable)\n"
                "4. urgency_level: 'Urgent' or 'Standard'\n"
                "5. confidence_score: Float between 0.0 and 1.0\n"
                "Respond ONLY with valid JSON with keys: parsed_goods_type, parsed_cargo_weight_kg, handling_notes, urgency_level, confidence_score."
            )

            response = llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"Cargo Description: '{text}'")
            ])

            content = response.content.strip()
            # Clean markdown codeblocks if returned
            if content.startswith("```"):
                content = re.sub(r'^```(?:json)?\n', '', content)
                content = re.sub(r'\n```$', '', content)

            data = json.loads(content)
            return {
                "parsed_goods_type": str(data.get("parsed_goods_type", "General Goods")),
                "parsed_cargo_weight_kg": float(data.get("parsed_cargo_weight_kg", 500.0)),
                "handling_notes": str(data.get("handling_notes", "Standard cargo tie-downs")),
                "urgency_level": str(data.get("urgency_level", "Standard")),
                "confidence_score": float(data.get("confidence_score", 0.95)),
                "engine_used": "LangChain + LangGraph (GPT-4o-mini)"
            }
        except Exception as e:
            print(f"⚠️ OpenAI LLM call failed or timed out: {e}. Switching to Heuristic Vernacular NLP Engine.")

    # Graceful fallback: Vernacular Heuristic NLP
    return heuristic_parse_cargo(text)


def validation_and_safety_node(state: CargoState) -> Dict[str, Any]:
    weight = state.get("parsed_cargo_weight_kg", 500.0)
    # Clamp to realistic road transport physical boundaries
    if weight < 10.0:
        weight = 50.0
    elif weight > 45000.0:
        weight = 40000.0

    return {
        "parsed_cargo_weight_kg": round(weight, 1),
        "confidence_score": min(max(state.get("confidence_score", 0.85), 0.5), 1.0)
    }


# ===================== GRAPH COMPILATION =====================

def build_cargo_agent():
    if not HAS_LANGGRAPH:
        return None

    workflow = StateGraph(CargoState)
    workflow.add_node("cleaner", clean_and_normalize_node)
    workflow.add_node("extractor", llm_extraction_node)
    workflow.add_node("validator", validation_and_safety_node)

    workflow.set_entry_point("cleaner")
    workflow.add_edge("cleaner", "extractor")
    workflow.add_edge("extractor", "validator")
    workflow.add_edge("validator", END)

    return workflow.compile()


_COMPILED_AGENT = None


def parse_cargo_description(raw_text: str) -> Dict[str, Any]:
    """
    Main entry point for parsing free-text goods input using LangGraph workflow.
    Guaranteed zero downtime with dual-layer fallback.
    """
    global _COMPILED_AGENT
    if _COMPILED_AGENT is None and HAS_LANGGRAPH:
        try:
            _COMPILED_AGENT = build_cargo_agent()
        except Exception as e:
            print(f"⚠️ Could not compile LangGraph: {e}")

    if _COMPILED_AGENT is not None:
        initial_state = {
            "raw_text": raw_text,
            "cleaned_text": "",
            "parsed_goods_type": "",
            "parsed_cargo_weight_kg": 0.0,
            "handling_notes": "",
            "urgency_level": "Standard",
            "confidence_score": 0.0,
            "engine_used": ""
        }
        try:
            result = _COMPILED_AGENT.invoke(initial_state)
            return {
                "raw_text": raw_text,
                "parsed_goods_type": result.get("parsed_goods_type", "General Goods"),
                "parsed_cargo_weight_kg": result.get("parsed_cargo_weight_kg", 500.0),
                "handling_notes": result.get("handling_notes", "Standard cargo tie-downs"),
                "urgency_level": result.get("urgency_level", "Standard"),
                "confidence_score": result.get("confidence_score", 0.9),
                "engine_used": result.get("engine_used", "LangGraph Agent")
            }
        except Exception as e:
            print(f"⚠️ Error executing LangGraph agent: {e}")

    # Direct heuristic fallback
    parsed = heuristic_parse_cargo(raw_text)
    parsed["raw_text"] = raw_text
    return parsed
