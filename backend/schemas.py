from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import datetime


# ===================== KYC SCHEMAS =====================

class KycVerificationRequest(BaseModel):
    full_name: str = Field(..., description="Full Name as per Aadhaar/DL")
    phone: Optional[str] = Field("9876543210", description="10-digit mobile number")
    driving_license_no: str = Field(..., description="Indian Driving License Number e.g. MH1220180012345")
    aadhaar_no: str = Field(..., description="12-digit Aadhaar Number")
    vehicle_rc_no: str = Field(..., description="Vehicle Registration Number e.g. MH12AB1234")
    vehicle_type: str = Field(..., description="Commercial vehicle category")
    registered_state: Optional[str] = "Maharashtra"
    registered_district: Optional[str] = "Pune"
    registered_taluka: Optional[str] = "Haveli"


class KycVerificationResponse(BaseModel):
    success: bool
    kyc_verified: bool
    certificate_id: str
    driver_id: Optional[int] = None
    full_name: str
    message: str
    parivahan_status: str
    vahan_status: str
    vehicle_rc_no: Optional[str] = None
    rto_office: Optional[str] = None
    driving_license_no: Optional[str] = None
    identity_match: Optional[str] = None
    insurance_valid_till: Optional[str] = "N/A"
    fitness_valid_till: Optional[str] = "N/A"
    puc_valid_till: Optional[str] = "N/A"
    badge_title: str


# ===================== DRIVER SCHEMAS =====================

class DriverCreate(BaseModel):
    full_name: str
    phone: str
    driving_license_no: str
    aadhaar_no: str
    vehicle_rc_no: str
    vehicle_type: str
    registered_state: str = "Maharashtra"
    registered_district: str = "Pune"
    registered_taluka: str = "Haveli"


class DriverResponse(BaseModel):
    id: int
    full_name: str
    phone: str
    driving_license_no: str
    vehicle_rc_no: str
    vehicle_type: str
    registered_state: str
    registered_district: str
    registered_taluka: str
    kyc_verified: bool
    kyc_verified_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# ===================== AI PARSING SCHEMAS =====================

class CargoParseRequest(BaseModel):
    raw_text: str = Field(..., description="Free text goods description e.g. '15 bags seed wheat and 2 fertilizer drums'")


class CargoParseResponse(BaseModel):
    raw_text: str
    parsed_goods_type: str
    parsed_cargo_weight_kg: float
    handling_notes: str
    urgency_level: str
    confidence_score: float
    engine_used: str  # "LangGraph + GPT" or "Heuristic NLP Extractor"


# ===================== MULTI-AGENT ARCHITECTURE SCHEMAS =====================

class DistanceCalculateRequest(BaseModel):
    pickup_state: str
    pickup_district: str
    pickup_taluka: str
    pickup_village: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    drop_state: Optional[str] = None
    drop_district: Optional[str] = None
    drop_taluka: Optional[str] = None
    drop_village: Optional[str] = None
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    user_distance_km: Optional[float] = None
    delivery_scope: Optional[str] = "INTRA_CITY"
    google_maps_api_key: Optional[str] = None
    is_custom_pickup_pin: bool = False
    is_custom_drop_pin: bool = False


class DistanceCalculateResponse(BaseModel):
    distance_km: float
    duration_mins: int
    duration_text: str
    calculation_method: str
    google_maps_configured: bool
    origin: str
    destination: str
    origin_coords: Dict[str, float]
    destination_coords: Dict[str, float]
    route_polyline: Optional[List[List[float]]] = None
    is_intra_city: bool
    api_key_instruction: str


class GeocodeRequest(BaseModel):
    state: Optional[str] = "Maharashtra"
    district: Optional[str] = "Pune"
    taluka: Optional[str] = "Haveli"
    village: Optional[str] = None
    pincode: Optional[str] = None
    google_maps_api_key: Optional[str] = None


class GeocodeResponse(BaseModel):
    lat: float
    lng: float
    display_name: str
    source: Optional[str] = None


class VehicleAlternative(BaseModel):
    vehicle_name: str
    display_name: str
    capacity_kg: float
    status: str
    is_viable: bool


class VehicleRecommendRequest(BaseModel):
    cargo_weight_kg: float
    goods_type: Optional[str] = "General Cargo"
    handling_notes: Optional[str] = ""
    distance_km: Optional[float] = 25.0
    delivery_scope: Optional[str] = "INTRA_CITY"
    raw_goods_description: Optional[str] = ""


class VehicleRecommendResponse(BaseModel):
    recommended_vehicle: str
    display_name: str
    capacity_kg: float
    cargo_weight_kg: float
    payload_utilization_pct: float
    suitability_reason: str
    confidence_score: float
    special_advice: str
    alternatives: List[VehicleAlternative]


class CoordinatorRequest(BaseModel):
    raw_goods_description: str
    pickup_state: str
    pickup_district: str
    pickup_taluka: str
    pickup_village: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    drop_state: Optional[str] = None
    drop_district: Optional[str] = None
    drop_taluka: Optional[str] = None
    drop_village: Optional[str] = None
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    user_distance_km: Optional[float] = None
    user_vehicle_preference: Optional[str] = None
    delivery_scope: Optional[str] = "INTRA_CITY"
    google_maps_api_key: Optional[str] = None


class CoordinatorResponse(BaseModel):
    orchestrator_summary: str
    cargo: Dict[str, Any]
    distance: Dict[str, Any]
    vehicle_recommendation: Dict[str, Any]
    effective_vehicle: str
    is_user_override_vehicle: bool
    pricing: Dict[str, Any]
    agent_trace: List[Dict[str, Any]]



# ===================== PRICING ENGINE SCHEMAS =====================

class PricePredictRequest(BaseModel):
    distance_km: float = Field(..., gt=0, description="Trip distance in km")
    cargo_weight_kg: float = Field(..., gt=0, description="Estimated payload in kg")
    vehicle_type: str = Field(..., description="Vehicle code / model")
    delivery_scope: str = Field(default="INTRA_CITY", description="'INTRA_CITY' or 'INTER_CITY'")
    pickup_taluka: Optional[str] = "Haveli"
    drop_taluka: Optional[str] = "Haveli"


class PricePredictResponse(BaseModel):
    distance_km: float
    cargo_weight_kg: float
    vehicle_type: str
    delivery_scope: str
    predicted_fair_price: float
    min_recommended_fare: float
    max_recommended_fare: float
    rate_per_km: float
    inference_time_ms: float
    model_version: str


# ===================== FREIGHT POST SCHEMAS =====================

class FreightPostCreate(BaseModel):
    customer_user_id: Optional[int] = None
    customer_name: str
    customer_phone: str
    delivery_scope: str = "INTRA_CITY"  # "INTRA_CITY" or "INTER_CITY"

    # Pickup Location
    pickup_state: str
    pickup_district: str
    pickup_taluka: str
    pickup_village: Optional[str] = None
    pickup_street: Optional[str] = None
    pickup_landmark: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None

    # Dropoff Location
    drop_state: str
    drop_district: str
    drop_taluka: str
    drop_village: Optional[str] = None
    drop_street: Optional[str] = None
    drop_landmark: Optional[str] = None
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None

    # Cargo Details
    raw_goods_description: str
    parsed_goods_type: Optional[str] = None
    parsed_cargo_weight_kg: Optional[float] = None
    handling_notes: Optional[str] = None

    # Vehicle Preference
    vehicle_type: str
    custom_vehicle_details: Optional[str] = None

    # Timing
    feasible_date: str
    feasible_time_window: str

    # Pricing
    estimated_distance_km: Optional[float] = None
    customer_budget: float


class NegotiationOfferCreate(BaseModel):
    driver_id: int
    sender_role: str = "DRIVER"  # "DRIVER" or "CUSTOMER"
    offered_price: float
    message: Optional[str] = None
    audio_note_text: Optional[str] = None


class NegotiationOfferResponse(BaseModel):
    id: int
    post_id: int
    driver_id: int
    sender_role: str
    offered_price: float
    message: Optional[str] = None
    audio_note_text: Optional[str] = None
    status: str
    created_at: datetime.datetime
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_kyc_verified: Optional[bool] = None
    driver_vehicle_type: Optional[str] = None
    driver_vehicle_rc: Optional[str] = None
    driver_certificate_id: Optional[str] = None
    driver_photo_url: Optional[str] = None
    driver_vehicle_photo_url: Optional[str] = None

    class Config:
        from_attributes = True


class CustomerDecisionRequest(BaseModel):
    action: str  # "ACCEPT" or "REJECT"
    driver_id: int
    offer_id: Optional[int] = None
    share_phone: bool = True
    agreed_price: Optional[float] = None


class DriverAcceptRequest(BaseModel):
    driver_id: int
    offered_price: Optional[float] = None
    message: Optional[str] = None


class FreightPostResponse(BaseModel):
    id: int
    customer_user_id: Optional[int] = None
    customer_name: str
    customer_phone: str  # Masked if not agreed or if phone sharing disabled
    delivery_scope: str

    pickup_state: str
    pickup_district: str
    pickup_taluka: str
    pickup_village: Optional[str] = None
    pickup_street: Optional[str] = None
    pickup_landmark: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None

    drop_state: str
    drop_district: str
    drop_taluka: str
    drop_village: Optional[str] = None
    drop_street: Optional[str] = None
    drop_landmark: Optional[str] = None
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None

    raw_goods_description: str
    parsed_goods_type: Optional[str] = None
    parsed_cargo_weight_kg: Optional[float] = None
    handling_notes: Optional[str] = None

    vehicle_type: str
    custom_vehicle_details: Optional[str] = None
    feasible_date: str
    feasible_time_window: str

    estimated_distance_km: float
    base_price_predicted: Optional[float] = None
    customer_budget: float
    status: str

    agreed_driver_id: Optional[int] = None
    agreed_price: Optional[float] = None
    share_phone_with_driver: Optional[bool] = True
    rejected_driver_ids: Optional[List[int]] = []
    created_at: datetime.datetime

    # Active negotiation counts & agreed contacts
    offers_count: Optional[int] = 0
    agreed_driver_name: Optional[str] = None
    agreed_driver_phone: Optional[str] = None
    agreed_driver_vehicle_type: Optional[str] = None
    agreed_driver_vehicle_rc: Optional[str] = None
    agreed_driver_kyc_verified: Optional[bool] = None
    agreed_driver_certificate_id: Optional[str] = None
    agreed_driver_photo_url: Optional[str] = None
    agreed_driver_vehicle_photo_url: Optional[str] = None
    offers: Optional[List[NegotiationOfferResponse]] = []

    class Config:
        from_attributes = True


class FreightPostDetailResponse(FreightPostResponse):
    offers: List[NegotiationOfferResponse] = []


class RetrainStatusResponse(BaseModel):
    status: str
    message: str
    historical_records_used: int
    rmse: float
    r2_score: float
    retrained_at: str
    next_scheduled_run: str


# ===================== AUTH & USER PROFILE SCHEMAS =====================

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "CUSTOMER"  # "CUSTOMER" or "DRIVER"
    phone: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    district: Optional[str] = "Pune"
    taluka: Optional[str] = "Haveli"
    village: Optional[str] = None
    pincode: Optional[str] = None


class DriverLocationUpdateRequest(BaseModel):
    registered_state: str
    registered_district: str
    registered_taluka: str
    registered_village: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    google_id: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = "CUSTOMER"
    id_token: Optional[str] = None
    access_token: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    reset_code: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    avatar_url: Optional[str] = None

    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    street_address: Optional[str] = None
    pincode: Optional[str] = None

    # Driver Specific Profile
    driving_license_no: Optional[str] = None
    aadhaar_no: Optional[str] = None
    vehicle_rc_no: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_capacity_kg: Optional[float] = None
    vehicle_body_type: Optional[str] = None
    vehicle_photo_url: Optional[str] = None
    kyc_verified: Optional[bool] = False
    kyc_verified_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    success: bool
    token: str
    user: UserResponse
    message: str


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None

    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    street_address: Optional[str] = None
    pincode: Optional[str] = None

    # Driver Details
    driving_license_no: Optional[str] = None
    aadhaar_no: Optional[str] = None
    vehicle_rc_no: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_capacity_kg: Optional[float] = None
    vehicle_body_type: Optional[str] = None
    vehicle_photo_url: Optional[str] = None


class MapsKeyRequest(BaseModel):
    api_key: str


class MapsStatusResponse(BaseModel):
    google_maps_configured: bool
    key_preview: Optional[str] = None
    source: Optional[str] = None
