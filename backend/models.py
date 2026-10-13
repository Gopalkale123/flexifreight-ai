import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from database import Base, is_sqlite

# Try importing Geometry from geoalchemy2; fallback if not available
try:
    from geoalchemy2 import Geometry
    HAS_GEOALCHEMY = not is_sqlite
except ImportError:
    HAS_GEOALCHEMY = False


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    avatar_url = Column(Text, nullable=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True, index=True)
    role = Column(String(20), nullable=False, default="CUSTOMER")  # "CUSTOMER" or "DRIVER"

    # All-India Cascading Address
    state = Column(String(100), nullable=True, default="Maharashtra")
    district = Column(String(100), nullable=True, default="Pune")
    taluka = Column(String(100), nullable=True, default="Haveli")
    village = Column(String(255), nullable=True, default="Uruli Kanchan")
    street_address = Column(String(255), nullable=True)
    pincode = Column(String(10), nullable=True)

    # Transporter / Driver Profile Details (if role == "DRIVER")
    driving_license_no = Column(String(50), nullable=True, index=True)
    aadhaar_no = Column(String(20), nullable=True)
    vehicle_rc_no = Column(String(50), nullable=True, index=True)
    vehicle_type = Column(String(100), nullable=True, default="Mahindra Bolero Pickup")
    vehicle_model = Column(String(255), nullable=True)
    vehicle_capacity_kg = Column(Float, nullable=True, default=1500.0)
    vehicle_body_type = Column(String(100), nullable=True, default="Tarpaulin Cover")
    vehicle_photo_url = Column(Text, nullable=True)
    kyc_verified = Column(Boolean, default=False)
    kyc_verified_at = Column(DateTime, nullable=True)

    # Password Reset flow
    reset_code = Column(String(10), nullable=True)
    reset_code_expires = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False, unique=True, index=True)
    driving_license_no = Column(String(50), nullable=False, unique=True, index=True)
    aadhaar_no = Column(String(20), nullable=False)
    vehicle_rc_no = Column(String(50), nullable=False, index=True)
    vehicle_type = Column(String(100), nullable=False)

    # Local Taluka / District registration for Geofencing
    registered_state = Column(String(100), nullable=False, default="Maharashtra")
    registered_district = Column(String(100), nullable=False, default="Pune")
    registered_taluka = Column(String(100), nullable=False, default="Haveli")

    # Government Data KYC Status (Parivahan / VAHAN)
    kyc_verified = Column(Boolean, default=False)
    kyc_verified_at = Column(DateTime, nullable=True)
    parivahan_details = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    offers = relationship("NegotiationOffer", back_populates="driver")


class FreightPost(Base):
    __tablename__ = "freight_posts"

    id = Column(Integer, primary_key=True, index=True)
    customer_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    customer_name = Column(String(255), nullable=False)
    customer_phone = Column(String(20), nullable=False)

    # Delivery Scope: "INTRA_CITY" (Same City/Intra-Taluka) vs "INTER_CITY" (Inter-City/Inter-Taluka)
    delivery_scope = Column(String(50), nullable=False, default="INTRA_CITY")

    # Pickup Location Hierarchy & Local Landmarks
    pickup_state = Column(String(100), nullable=False)
    pickup_district = Column(String(100), nullable=False)
    pickup_taluka = Column(String(100), nullable=False)
    pickup_village = Column(String(255), nullable=True)
    pickup_street = Column(String(255), nullable=True)
    pickup_landmark = Column(String(255), nullable=True)
    pickup_lat = Column(Float, nullable=True)
    pickup_lng = Column(Float, nullable=True)

    # Dropoff Location Hierarchy & Local Landmarks
    drop_state = Column(String(100), nullable=False)
    drop_district = Column(String(100), nullable=False)
    drop_taluka = Column(String(100), nullable=False)
    drop_village = Column(String(255), nullable=True)
    drop_street = Column(String(255), nullable=True)
    drop_landmark = Column(String(255), nullable=True)
    drop_lat = Column(Float, nullable=True)
    drop_lng = Column(Float, nullable=True)

    # Cargo Details
    raw_goods_description = Column(Text, nullable=False)
    parsed_goods_type = Column(String(150), nullable=True)
    parsed_cargo_weight_kg = Column(Float, nullable=True, default=500.0)
    handling_notes = Column(Text, nullable=True)

    # Vehicle Preferences
    vehicle_type = Column(String(100), nullable=False)
    custom_vehicle_details = Column(String(255), nullable=True)

    # Timing
    feasible_date = Column(String(50), nullable=False)
    feasible_time_window = Column(String(100), nullable=False)

    # Pricing & Metrics
    estimated_distance_km = Column(Float, default=25.0)
    base_price_predicted = Column(Float, nullable=True)
    customer_budget = Column(Float, nullable=False)

    # Status: OPEN, NEGOTIATING, AGREED, CANCELLED
    status = Column(String(50), default="OPEN", index=True)

    # Closing details
    agreed_driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    agreed_price = Column(Float, nullable=True)
    share_phone_with_driver = Column(Boolean, default=True)
    rejected_driver_ids = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    offers = relationship("NegotiationOffer", back_populates="post", cascade="all, delete-orphan")


class NegotiationOffer(Base):
    __tablename__ = "negotiation_offers"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("freight_posts.id"), nullable=False, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, index=True)

    # Role of party sending the offer/counter: "DRIVER" or "CUSTOMER"
    sender_role = Column(String(20), nullable=False, default="DRIVER")
    offered_price = Column(Float, nullable=False)
    message = Column(Text, nullable=True)
    audio_note_text = Column(Text, nullable=True)

    # Status: PENDING, ACCEPTED, REJECTED, COUNTERED
    status = Column(String(50), default="PENDING")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    post = relationship("FreightPost", back_populates="offers")
    driver = relationship("Driver", back_populates="offers")


class TransactionMemory(Base):
    """
    Stores all finalized and accepted transactions.
    Used by the self-learning XGBoost pricing engine for daily scheduled retraining.
    """
    __tablename__ = "transaction_memories"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, nullable=True)
    pickup_taluka = Column(String(100), nullable=False, index=True)
    drop_taluka = Column(String(100), nullable=False, index=True)
    pickup_district = Column(String(100), nullable=False)
    drop_district = Column(String(100), nullable=False)
    distance_km = Column(Float, nullable=False)
    vehicle_code = Column(String(100), nullable=False)
    cargo_weight_kg = Column(Float, nullable=False)
    final_agreed_price = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
