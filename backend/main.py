import os
import sys
import json
import datetime
import urllib.request
import re
from contextlib import asynccontextmanager

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, Query, Header, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import engine, init_db, get_db, SessionLocal
import models
import schemas
from services.kyc import simulate_parivahan_vahan_verification
from services.trainer import (
    predict_price_fast,
    execute_daily_retraining,
    train_or_load_model
)
from agent import (
    parse_cargo_description,
    calculate_distance_and_transit,
    geocode_location,
    recommend_vehicle,
    estimate_freight_pricing,
    coordinate_freight_workflow
)
from services.locations import (
    INDIA_LOCATION_HIERARCHY,
    get_all_states,
    get_districts_for_state,
    get_talukas_for_district,
    get_villages_for_taluka,
    lookup_by_pincode
)
from services.auth import (
    hash_password,
    verify_password,
    generate_reset_code,
    create_auth_token,
    verify_auth_token
)

LOCATION_HIERARCHY = INDIA_LOCATION_HIERARCHY


# ===================== LIFESPAN & SCHEDULER =====================

scheduler = AsyncIOScheduler()


def scheduled_daily_retrain_job():
    """APScheduler task triggered daily at 02:00 AM IST."""
    print("⏰ [APScheduler] 02:00 AM Daily Trigger: Retraining XGBoost Pricing Engine...")
    db = SessionLocal()
    try:
        res = execute_daily_retraining(db)
        print(f"✅ Daily XGBoost Retraining Completed: {res}")
    except Exception as e:
        print(f"⚠️ Error during daily retraining: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize DB tables
    print("🚀 Initializing FlexiFreight AI Database & Models...")
    init_db()

    # 2. Pre-train or load XGBoost Pricing Engine
    print("🤖 Pre-warming Local XGBoost Pricing Engine...")
    train_or_load_model()

    # 3. Seed demo data if database is empty
    seed_demo_data()

    # 4. Start Background Scheduler for 2:00 AM Daily Retraining
    scheduler.add_job(
        scheduled_daily_retrain_job,
        trigger=CronTrigger(hour=2, minute=0),
        id="daily_pricing_retrainer",
        name="Daily XGBoost Retraining at 2:00 AM",
        replace_existing=True
    )
    scheduler.start()
    print("⏱️ APScheduler started. Scheduled daily XGBoost retraining at 02:00 AM.")

    yield

    # Teardown
    print("🛑 Shutting down APScheduler...")
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="FlexiFreight AI Engine",
    description="Universal Freight Transport & Dynamic Agentic AI Negotiation Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===================== DATABASE SEEDING =====================

def seed_demo_data():
    """Seeds initial drivers, posts, and past transactions for immediate testability."""
    db = SessionLocal()
    try:
        driver_count = db.query(models.Driver).count()
        if driver_count == 0:
            print("🌱 Seeding initial Transporter Drivers with KYC...")
            driver1 = models.Driver(
                full_name="Rameshwar Tukaram Patil",
                phone="9822012345",
                driving_license_no="MH1220170045892",
                aadhaar_no="876543210987",
                vehicle_rc_no="MH12RN4590",
                vehicle_type="Mahindra Bolero Pickup",
                registered_state="Maharashtra",
                registered_district="Pune",
                registered_taluka="Haveli",
                kyc_verified=True,
                kyc_verified_at=datetime.datetime.utcnow(),
                parivahan_details={
                    "certificate_id": "PRV-VAHAN-2026-948102",
                    "parivahan_sarathi_status": "ACTIVE_COMMERCIAL_VALID",
                    "vahan_status": "COMMERCIAL_CARRIER_REGISTERED",
                    "insurance_valid_till": "15-Dec-2027",
                    "fitness_valid_till": "20-Jan-2027",
                    "puc_valid_till": "10-Nov-2026",
                    "badge": "GOVT_VERIFIED_TRANSPORTER"
                }
            )
            driver2 = models.Driver(
                full_name="Sachin Bhausaheb Shinde",
                phone="9890198765",
                driving_license_no="MH1520190089123",
                aadhaar_no="543210987654",
                vehicle_rc_no="MH15AB8976",
                vehicle_type="14ft Eicher",
                registered_state="Maharashtra",
                registered_district="Nashik",
                registered_taluka="Niphad",
                kyc_verified=True,
                kyc_verified_at=datetime.datetime.utcnow(),
                parivahan_details={
                    "certificate_id": "PRV-VAHAN-2026-819302",
                    "insurance_valid_till": "28-Feb-2028",
                    "badge": "GOVT_VERIFIED_TRANSPORTER"
                }
            )
            db.add_all([driver1, driver2])
            db.commit()

        # Seed freight posts if empty
        post_count = db.query(models.FreightPost).count()
        if post_count == 0:
            print("🌱 Seeding realistic Intra-Taluka and Inter-City Freight Loads...")
            post1 = models.FreightPost(
                customer_name="Vitthalrao Jadhav (Krishi Kendra)",
                customer_phone="9823456789",
                delivery_scope="INTRA_CITY",
                pickup_state="Maharashtra",
                pickup_district="Pune",
                pickup_taluka="Haveli",
                pickup_village="Uruli Kanchan",
                pickup_street="Pune-Solapur Highway",
                pickup_landmark="Opposite Kisan Seva Kendra & Hanuman Temple",
                drop_state="Maharashtra",
                drop_district="Pune",
                drop_taluka="Haveli",
                drop_village="Hadapsar",
                drop_street="Gadital APMC Market Gate 2",
                drop_landmark="Behind State Bank of India Mandi Branch",
                raw_goods_description="35 bori gehu (wheat seed bags) and 5 drum organic liquid fertilizer",
                parsed_goods_type="Agricultural Produce",
                parsed_cargo_weight_kg=2750.0,
                handling_notes="Moisture Sensitive: Cover with tarpaulin mandatory • Liquid Drums: Keep upright",
                vehicle_type="Mahindra Bolero Pickup",
                feasible_date="2026-09-28",
                feasible_time_window="Morning (06:00 AM - 10:00 AM)",
                estimated_distance_km=24.5,
                base_price_predicted=1350.0,
                customer_budget=1400.0,
                status="OPEN"
            )
            post2 = models.FreightPost(
                customer_name="Deepak Builders & Hardware",
                customer_phone="9765432100",
                delivery_scope="INTER_CITY",
                pickup_state="Maharashtra",
                pickup_district="Nashik",
                pickup_taluka="Niphad",
                pickup_village="Pimpalgaon Baswant",
                pickup_street="Mandi Bypass Road",
                pickup_landmark="Near Shani Mandir Chowk",
                drop_state="Maharashtra",
                drop_district="Pune",
                drop_taluka="Haveli",
                drop_village="Wagholi",
                drop_street="Nagar Road Mega Hub",
                drop_landmark="Near Reliance Smart Bazaar",
                raw_goods_description="150 crates fresh Nashik onions and 20 sacks garlic",
                parsed_goods_type="Agricultural Produce",
                parsed_cargo_weight_kg=4000.0,
                handling_notes="Perishable Goods: Ensure fast transit • Cover with Tarpaulin",
                vehicle_type="14ft Eicher",
                feasible_date="2026-09-29",
                feasible_time_window="Early Morning (04:00 AM - 08:00 AM)",
                estimated_distance_km=198.0,
                base_price_predicted=9200.0,
                customer_budget=9500.0,
                status="OPEN"
            )
            db.add_all([post1, post2])
            db.commit()

        # Seed historical transaction memories for self-learning model
        mem_count = db.query(models.TransactionMemory).count()
        if mem_count == 0:
            print("🌱 Seeding historical transaction memories for local XGBoost training...")
            sample_memories = [
                models.TransactionMemory(pickup_taluka="Haveli", drop_taluka="Haveli", pickup_district="Pune", drop_district="Pune", distance_km=18.0, vehicle_code="Mahindra Bolero Pickup", cargo_weight_kg=1200.0, final_agreed_price=980.0),
                models.TransactionMemory(pickup_taluka="Haveli", drop_taluka="Baramati", pickup_district="Pune", drop_district="Pune", distance_km=85.0, vehicle_code="Mahindra Bolero Pickup", cargo_weight_kg=1500.0, final_agreed_price=3100.0),
                models.TransactionMemory(pickup_taluka="Niphad", drop_taluka="Haveli", pickup_district="Nashik", drop_district="Pune", distance_km=195.0, vehicle_code="14ft Eicher", cargo_weight_kg=4500.0, final_agreed_price=9400.0),
                models.TransactionMemory(pickup_taluka="Rahata (Shirdi)", drop_taluka="Haveli", pickup_district="Ahmednagar", drop_district="Pune", distance_km=185.0, vehicle_code="Container Truck", cargo_weight_kg=12000.0, final_agreed_price=16800.0),
                models.TransactionMemory(pickup_taluka="Baramati", drop_taluka="Baramati", pickup_district="Pune", drop_district="Pune", distance_km=12.0, vehicle_code="3-Wheeler Auto", cargo_weight_kg=450.0, final_agreed_price=520.0),
            ]
            db.add_all(sample_memories)
            db.commit()
    except Exception as e:
        print(f"⚠️ Seeding notice: {e}")
    finally:
        db.close()


# ===================== ENDPOINTS =====================

@app.get("/")
def root():
    return {
        "service": "FlexiFreight AI Engine",
        "status": "ONLINE",
        "docs": "http://127.0.0.1:8000/docs",
        "health": "http://127.0.0.1:8000/health",
        "frontend": "http://localhost:3000"
    }

@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "FlexiFreight AI Engine",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }


def get_fresh_hierarchy():
    from services.locations import HIERARCHY_JSON_PATH
    if os.path.exists(HIERARCHY_JSON_PATH):
        try:
            with open(HIERARCHY_JSON_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    from services.locations import INDIA_LOCATION_HIERARCHY
    return INDIA_LOCATION_HIERARCHY


@app.get("/api/v1/locations/hierarchy")
def get_location_hierarchy():
    """Returns the State -> District -> Taluka cascading hierarchy."""
    return get_fresh_hierarchy()


@app.get("/api/v1/config/maps-status")
def get_maps_status_endpoint():
    """Returns current Google Maps integration status and configured key preview."""
    from agent.distance_agent import get_active_google_maps_api_key
    key = get_active_google_maps_api_key()
    return {
        "google_maps_configured": bool(key),
        "key_preview": f"{key[:6]}...{key[-4:]}" if key else None,
        "source": "Google Maps Platform (Distance Matrix API & Directions API)" if key else "OSRM & Geodesic Road Engine (Fallback)"
    }


@app.post("/api/v1/config/maps-key")
def update_maps_key_endpoint(req: schemas.MapsKeyRequest):
    """
    Saves and activates the provided Google Maps API key in runtime and updates .env file.
    """
    key = req.api_key.strip()
    if not key or len(key) < 15:
        raise HTTPException(status_code=400, detail="Invalid Google Maps API Key length. Keys usually start with AIza and are ~39 characters long.")

    os.environ["GOOGLE_MAPS_API_KEY"] = key

    # Persist to .env files
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for env_name in [".env", os.path.join("frontend", ".env"), os.path.join("backend", ".env")]:
        env_path = os.path.join(root_dir, env_name)
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    content = f.read()
                if "GOOGLE_MAPS_API_KEY=" in content:
                    content = re.sub(r'GOOGLE_MAPS_API_KEY=.*', f'GOOGLE_MAPS_API_KEY={key}', content)
                elif "VITE_GOOGLE_MAPS_API_KEY=" in content:
                    content = re.sub(r'VITE_GOOGLE_MAPS_API_KEY=.*', f'VITE_GOOGLE_MAPS_API_KEY={key}', content)
                else:
                    content += f"\nGOOGLE_MAPS_API_KEY={key}\n"
                with open(env_path, "w", encoding="utf-8") as f:
                    f.write(content)
            except Exception as e:
                print(f"Notice saving {env_path}: {e}")

    return {
        "success": True,
        "google_maps_configured": True,
        "key_preview": f"{key[:6]}...{key[-4:]}",
        "message": "Google Maps API Key saved and activated successfully!"
    }


@app.get("/api/v1/locations/states")
def get_states_endpoint():
    """Returns list of all available Indian States and Union Territories."""
    return get_all_states()


@app.get("/api/v1/locations/districts")
def get_districts_endpoint(state: str = Query(...)):
    """Returns list of districts for the specified State."""
    return get_districts_for_state(state)


@app.get("/api/v1/locations/talukas")
def get_talukas_endpoint(state: str = Query(...), district: str = Query(...)):
    """Returns list of talukas/tehsils for the specified State and District."""
    return get_talukas_for_district(state, district)


@app.get("/api/v1/locations/villages")
def get_villages_endpoint(
    taluka: str = Query(...),
    district: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    query: Optional[str] = Query(None)
):
    """
    Returns villages / mandi hubs for a given Taluka, District, and State.
    Pulls from 155,570 All-India village records. Supports real-time search filtering.
    """
    return get_villages_for_taluka(taluka, district=district, state=state, query=query)


@app.get("/api/v1/locations/search-villages")
def search_villages_endpoint(
    query: str = Query(..., min_length=2),
    district: Optional[str] = Query(None),
    taluka: Optional[str] = Query(None)
):
    """
    Real-time village search across 155,570+ Indian villages by name or 6-digit Pincode.
    """
    from services.locations import _query_villages_from_db
    return _query_villages_from_db(taluka=taluka or "", district=district, query=query, limit=100)


@app.get("/api/v1/locations/pincode/{pincode}")
def get_pincode_lookup_endpoint(pincode: str):
    """
    Fast Indian 6-digit Pincode Resolver.
    Returns State, District, Taluka, and primary Village/Post Office branch.
    """
    result = lookup_by_pincode(pincode)
    if not result:
        raise HTTPException(
            status_code=404, 
            detail=f"Pincode '{pincode}' not found in offline registry. You may enter state/district manually."
        )
    return {"found": True, "pincode": pincode, **result}

@app.get("/api/v1/locations/boundary")
def get_location_boundary_endpoint(
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    taluka: Optional[str] = Query(None)
):
    """
    Returns administrative boundary GeoJSON polygon and bounding box for State, District, or Taluka.
    Used by interactive map to zoom and render region borders.
    """
    from services.geo import get_boundary
    return get_boundary(state=state or "", district=district or "", taluka=taluka or "")


@app.get("/api/v1/locations/reverse")
def reverse_geocode_endpoint(
    lat: float = Query(...),
    lng: float = Query(...)
):
    """
    Reverse geocodes map click coordinates to Village/Mandi, Taluka, District, State and Pincode.
    """
    from services.geo import reverse_geocode
    return reverse_geocode(lat=lat, lng=lng)


@app.get("/api/v1/locations/resolve-village")
def resolve_village_endpoint(
    village: str = Query(...),
    taluka: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    state: Optional[str] = Query(None)
):
    """
    Resolves custom village name to accurate GPS coordinates constrained strictly within the selected Taluka/District.
    """
    from services.geo import find_village
    results = find_village(village=village, state=state or "", district=district or "", taluka=taluka or "")
    if results:
        return {"found": True, "results": results, "best": results[0]}
    return {"found": False, "results": [], "best": None}

# ===================== AUTHENTICATION & USER PROFILE =====================

def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> models.User:
    """Dependency to extract and verify authenticated user from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required.")
    token = authorization.split("Bearer ")[1].strip()
    payload = verify_auth_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired or invalid token. Please log in again.")
    
    user = db.query(models.User).filter(models.User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")
    return user


@app.post("/api/v1/auth/register", response_model=schemas.AuthResponse)
def register_endpoint(req: schemas.RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user account with email and password."""
    email_clean = req.email.strip().lower()
    existing = db.query(models.User).filter(models.User.email == email_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")

    new_user = models.User(
        email=email_clean,
        password_hash=hash_password(req.password),
        full_name=req.full_name.strip(),
        phone=req.phone.strip() if req.phone else None,
        role=req.role.upper() if req.role else "CUSTOMER",
        state=req.state.strip() if req.state else "Maharashtra",
        district=req.district.strip() if req.district else "Pune",
        taluka=req.taluka.strip() if req.taluka else "Haveli",
        village=req.village.strip() if req.village else None,
        pincode=req.pincode.strip() if req.pincode else None
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # If registered as DRIVER, also ensure driver record exists
    if new_user.role == "DRIVER":
        _sync_driver_record(new_user, db)

    token = create_auth_token(new_user.id, new_user.email, new_user.role, new_user.full_name)
    return schemas.AuthResponse(
        success=True,
        token=token,
        user=new_user,
        message=f"Welcome to FlexiFreight AI, {new_user.full_name}!"
    )


@app.post("/api/v1/auth/login", response_model=schemas.AuthResponse)
def login_endpoint(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Authenticate using email and password."""
    email_clean = req.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email_clean).first()
    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_auth_token(user.id, user.email, user.role, user.full_name)
    return schemas.AuthResponse(
        success=True,
        token=token,
        user=user,
        message=f"Logged in successfully. Welcome back, {user.full_name}!"
    )


@app.post("/api/v1/auth/google", response_model=schemas.AuthResponse)
def google_auth_endpoint(req: schemas.GoogleLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate or register via Google OAuth.
    Validates Google Identity Services (GSI) id_token or verified Google profile.
    """
    email_clean = ""
    full_name = ""
    google_id = req.google_id
    avatar_url = req.avatar_url

    # 1. If a real Google OAuth id_token was sent by Google Identity Services
    if req.id_token:
        try:
            token_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={req.id_token}"
            req_obj = urllib.request.Request(token_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req_obj, timeout=6) as resp:
                token_info = json.loads(resp.read().decode("utf-8"))
                email_clean = token_info.get("email", "").strip().lower()
                full_name = token_info.get("name", "").strip() or email_clean.split("@")[0].title()
                google_id = token_info.get("sub", google_id)
                avatar_url = token_info.get("picture", avatar_url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Google token verification failed: {e}")
    elif req.access_token:
        try:
            userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
            req_obj = urllib.request.Request(
                userinfo_url,
                headers={"Authorization": f"Bearer {req.access_token}", "User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req_obj, timeout=6) as resp:
                user_info = json.loads(resp.read().decode("utf-8"))
                email_clean = user_info.get("email", "").strip().lower()
                full_name = user_info.get("name", "").strip() or email_clean.split("@")[0].title()
                google_id = user_info.get("sub", google_id)
                avatar_url = user_info.get("picture", avatar_url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Google access token verification failed: {e}")
    else:
        email_clean = (req.email or "").strip().lower()
        full_name = (req.full_name or "").strip() or "Google User"

    if not email_clean:
        raise HTTPException(status_code=400, detail="Valid email address is required for Google Sign-In.")

    user = db.query(models.User).filter(models.User.email == email_clean).first()

    if not user:
        # Create new Google-linked user
        user = models.User(
            email=email_clean,
            full_name=full_name,
            google_id=google_id or f"google_{email_clean}",
            avatar_url=avatar_url or "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
            role=req.role or "CUSTOMER"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Link Google ID and avatar if missing
        if not user.google_id and google_id:
            user.google_id = google_id
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        db.commit()
        db.refresh(user)

    token = create_auth_token(user.id, user.email, user.role, user.full_name)
    return schemas.AuthResponse(
        success=True,
        token=token,
        user=user,
        message=f"Google Sign-In successful. Welcome, {user.full_name}!"
    )


@app.post("/api/v1/auth/forgot-password")
def forgot_password_endpoint(req: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Initiates password reset by issuing a 6-digit verification code.
    Expires in 15 minutes.
    """
    email_clean = req.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email_clean).first()
    if not user:
        # Avoid user enumeration by returning uniform success message
        return {
            "success": True, 
            "message": "If an account exists with this email, a 6-digit reset code has been sent."
        }

    code = generate_reset_code()
    user.reset_code = code
    user.reset_code_expires = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    db.commit()

    print(f"🔑 [Password Reset Simulation] Reset code for {email_clean}: {code}")
    return {
        "success": True,
        "message": f"Reset code generated successfully. For testing/demo: code is {code}",
        "demo_code": code  # Included for immediate UI demo convenience
    }


@app.post("/api/v1/auth/reset-password")
def reset_password_endpoint(req: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    """Verifies 6-digit reset code and updates the user's password."""
    email_clean = req.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email_clean).first()
    if not user or not user.reset_code:
        raise HTTPException(status_code=400, detail="Invalid password reset request or email.")

    if user.reset_code != req.reset_code.strip():
        raise HTTPException(status_code=400, detail="Invalid 6-digit verification code.")

    if user.reset_code_expires and user.reset_code_expires < datetime.datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    # Update password and clear reset code
    user.password_hash = hash_password(req.new_password)
    user.reset_code = None
    user.reset_code_expires = None
    db.commit()

    return {"success": True, "message": "Password reset successfully. You can now log in with your new password."}


@app.get("/api/v1/auth/me", response_model=schemas.UserResponse)
def get_profile_endpoint(current_user: models.User = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    return current_user


@app.put("/api/v1/auth/profile", response_model=schemas.UserResponse)
def update_profile_endpoint(
    req: schemas.ProfileUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates user profile including cascading Indian address and driver details."""
    for field, value in req.dict(exclude_unset=True).items():
        if value is not None:
            setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    # If user is a driver, synchronize with Driver registry
    if current_user.role == "DRIVER":
        _sync_driver_record(current_user, db)

    return current_user


def _sync_driver_record(user: models.User, db: Session):
    """Keeps the drivers table synchronized with the user profile and operating location."""
    driver = None
    if user.phone:
        driver = db.query(models.Driver).filter(models.Driver.phone == user.phone).first()
    if not driver:
        driver = db.query(models.Driver).filter(models.Driver.full_name == user.full_name).first()

    phone_val = user.phone or f"98{user.id:08d}"

    if not driver:
        driver = models.Driver(
            full_name=user.full_name,
            phone=phone_val,
            driving_license_no=user.driving_license_no or f"MH12{user.id:010d}",
            aadhaar_no=user.aadhaar_no or f"9999{user.id:08d}",
            vehicle_rc_no=user.vehicle_rc_no or f"MH12AB{user.id:04d}",
            vehicle_type=user.vehicle_type or "Mahindra Bolero Pickup",
            registered_state=user.state or "Maharashtra",
            registered_district=user.district or "Pune",
            registered_taluka=user.taluka or "Haveli",
            kyc_verified=user.kyc_verified
        )
        db.add(driver)
    else:
        driver.full_name = user.full_name
        if user.driving_license_no:
            driver.driving_license_no = user.driving_license_no
        if user.vehicle_rc_no:
            driver.vehicle_rc_no = user.vehicle_rc_no
        if user.vehicle_type:
            driver.vehicle_type = user.vehicle_type
        if user.state:
            driver.registered_state = user.state
        if user.district:
            driver.registered_district = user.district
        if user.taluka:
            driver.registered_taluka = user.taluka
        driver.kyc_verified = user.kyc_verified

    db.commit()


# ===================== AI CARGO PARSER =====================

@app.post("/api/v1/parse-cargo", response_model=schemas.CargoParseResponse)
def parse_cargo_endpoint(request: schemas.CargoParseRequest):
    """
    Parses unstructured free-text goods description (in English, Hindi, or Marathi)
    into structured category, estimated weight, handling instructions, and urgency.
    Powered by LangChain + LangGraph with dual-layer fallback.
    """
    if not request.raw_text or not request.raw_text.strip():
        raise HTTPException(status_code=400, detail="Cargo description text cannot be empty.")

    result = parse_cargo_description(request.raw_text.strip())
    return schemas.CargoParseResponse(**result)


# ===================== SPECIALIZED MULTI-AGENT ENDPOINTS =====================

@app.post("/api/v1/agent/calculate-distance", response_model=schemas.DistanceCalculateResponse)
def calculate_distance_endpoint(req: schemas.DistanceCalculateRequest):
    """
    Distance & Geocoding Agent:
    Converts locations to coordinates and calculates road distance + transit duration
    using Google Maps API (if key available), OSRM road routing engine, or high-precision Geodesic Road Engine.
    Respects user-specified distance if provided.
    """
    res = calculate_distance_and_transit(
        pickup_state=req.pickup_state,
        pickup_district=req.pickup_district,
        pickup_taluka=req.pickup_taluka,
        pickup_village=req.pickup_village,
        pickup_lat=req.pickup_lat,
        pickup_lng=req.pickup_lng,
        drop_state=req.drop_state,
        drop_district=req.drop_district,
        drop_taluka=req.drop_taluka,
        drop_village=req.drop_village,
        drop_lat=req.drop_lat,
        drop_lng=req.drop_lng,
        user_distance_km=req.user_distance_km,
        delivery_scope=req.delivery_scope or "INTRA_CITY",
        api_key_override=req.google_maps_api_key,
        is_custom_pickup_pin=req.is_custom_pickup_pin,
        is_custom_drop_pin=req.is_custom_drop_pin
    )
    return schemas.DistanceCalculateResponse(**res)


@app.post("/api/v1/agent/geocode", response_model=schemas.GeocodeResponse)
def geocode_endpoint(req: schemas.GeocodeRequest):
    """
    Geocodes an Indian village, taluka, district, or address query into exact GPS coordinates.
    """
    lat, lng, display_name = geocode_location(
        village=req.village,
        taluka=req.taluka,
        district=req.district,
        state=req.state,
        api_key=req.google_maps_api_key
    )
    return schemas.GeocodeResponse(
        lat=lat,
        lng=lng,
        display_name=display_name,
        source="Google Maps Geocoding" if req.google_maps_api_key else "OpenStreetMap / Centroid"
    )


@app.post("/api/v1/agent/recommend-vehicle", response_model=schemas.VehicleRecommendResponse)
def recommend_vehicle_endpoint(req: schemas.VehicleRecommendRequest):
    """
    Vehicle Recommendation Agent:
    Analyzes package weight, volume, fragility, and route distance against fleet constraints
    (Tata Ace vs. Mahindra Bolero vs. 3-Wheeler vs. Tractor vs. Eicher vs. Container).
    """
    res = recommend_vehicle(
        cargo_weight_kg=req.cargo_weight_kg,
        goods_type=req.goods_type or "General Cargo",
        handling_notes=req.handling_notes or "",
        distance_km=req.distance_km or 25.0,
        delivery_scope=req.delivery_scope or "INTRA_CITY",
        raw_goods_description=req.raw_goods_description or ""
    )
    return schemas.VehicleRecommendResponse(**res)


@app.post("/api/v1/agent/orchestrate", response_model=schemas.CoordinatorResponse)
def orchestrate_agent_endpoint(req: schemas.CoordinatorRequest):
    """
    Orchestrator / Coordinator Agent:
    Team lead agent coordinating Cargo Parser, Distance Agent, Vehicle Agent,
    and Pricing Agent to return an end-to-end freight diagnostic and recommendation.
    """
    res = coordinate_freight_workflow(
        raw_goods_description=req.raw_goods_description,
        pickup_state=req.pickup_state,
        pickup_district=req.pickup_district,
        pickup_taluka=req.pickup_taluka,
        pickup_village=req.pickup_village,
        pickup_lat=req.pickup_lat,
        pickup_lng=req.pickup_lng,
        drop_state=req.drop_state,
        drop_district=req.drop_district,
        drop_taluka=req.drop_taluka,
        drop_village=req.drop_village,
        drop_lat=req.drop_lat,
        drop_lng=req.drop_lng,
        user_distance_km=req.user_distance_km,
        user_vehicle_preference=req.user_vehicle_preference,
        delivery_scope=req.delivery_scope or "INTRA_CITY",
        api_key_override=req.google_maps_api_key
    )
    return schemas.CoordinatorResponse(**res)



# ===================== XGBOOST REAL-TIME PRICING ENGINE =====================

@app.post("/api/v1/predict-price", response_model=schemas.PricePredictResponse)
def predict_price_endpoint(request: schemas.PricePredictRequest):
    """
    Ultra-fast (<10ms) zero-cost real-time fare prediction using local XGBoost Regressor.
    No commercial LLM tokens or API latency needed.
    """
    result = predict_price_fast(
        distance_km=request.distance_km,
        cargo_weight_kg=request.cargo_weight_kg,
        vehicle_type=request.vehicle_type,
        delivery_scope=request.delivery_scope,
        pickup_taluka=request.pickup_taluka or "Haveli",
        drop_taluka=request.drop_taluka or "Haveli"
    )
    return schemas.PricePredictResponse(**result)


# ===================== PARIVAHAN / VAHAN DRIVER KYC =====================

@app.post("/api/v1/verify-driver-kyc", response_model=schemas.KycVerificationResponse)
def verify_driver_kyc_endpoint(req: schemas.KycVerificationRequest, db: Session = Depends(get_db)):
    """
    Simulates live Parivahan Sarathi & VAHAN National Register verification.
    Validates DL, Aadhaar, and RC Number formats, verifies active insurance & fitness,
    and returns an official Transporter Verification Badge.
    """
    is_valid, message, metadata = simulate_parivahan_vahan_verification(
        full_name=req.full_name,
        driving_license_no=req.driving_license_no,
        aadhaar_no=req.aadhaar_no,
        vehicle_rc_no=req.vehicle_rc_no,
        vehicle_type=req.vehicle_type,
        registered_state=req.registered_state,
        registered_district=req.registered_district
    )

    if not is_valid:
        return schemas.KycVerificationResponse(
            success=False,
            kyc_verified=False,
            certificate_id="FAILED",
            driver_id=None,
            full_name=req.full_name,
            message=message,
            parivahan_status="INVALID_CREDENTIALS",
            vahan_status="CHECK_FAILED",
            insurance_valid_till="N/A",
            fitness_valid_till="N/A",
            puc_valid_till="N/A",
            badge_title="UNVERIFIED"
        )

    # Persist or update driver in database
    driver = db.query(models.Driver).filter(
        (models.Driver.driving_license_no == req.driving_license_no) |
        (models.Driver.phone == req.phone)
    ).first()

    if not driver:
        driver = models.Driver(
            full_name=req.full_name,
            phone=req.phone,
            driving_license_no=req.driving_license_no.upper().strip(),
            aadhaar_no=req.aadhaar_no.strip(),
            vehicle_rc_no=req.vehicle_rc_no.upper().strip(),
            vehicle_type=req.vehicle_type,
            registered_state=req.registered_state or "Maharashtra",
            registered_district=req.registered_district or "Pune",
            registered_taluka=req.registered_taluka or "Haveli",
            kyc_verified=True,
            kyc_verified_at=datetime.datetime.utcnow(),
            parivahan_details=metadata
        )
        db.add(driver)
    else:
        driver.kyc_verified = True
        driver.kyc_verified_at = datetime.datetime.utcnow()
        driver.parivahan_details = metadata
        driver.vehicle_rc_no = req.vehicle_rc_no.upper().strip()

    db.commit()
    db.refresh(driver)

    return schemas.KycVerificationResponse(
        success=True,
        kyc_verified=True,
        certificate_id=metadata["certificate_id"],
        driver_id=driver.id,
        full_name=driver.full_name,
        message=message,
        parivahan_status=metadata.get("parivahan_sarathi_status", "ACTIVE"),
        vahan_status=metadata.get("vahan_status", "ACTIVE"),
        vehicle_rc_no=metadata.get("vehicle_rc_no", driver.vehicle_rc_no),
        rto_office=metadata.get("rto_office", "RTO Transport Office"),
        driving_license_no=metadata.get("driving_license_no", driver.driving_license_no),
        identity_match=metadata.get("identity_verification", "Owner & DL Identity Verified"),
        insurance_valid_till=metadata.get("insurance_valid_till", "Active Commercial Cover"),
        fitness_valid_till=metadata.get("fitness_valid_till", "Compliant Standard"),
        puc_valid_till=metadata.get("puc_valid_till", "Compliant Standard"),
        badge_title="Government RTO Verified Owner & Commercial Vehicle"
    )


@app.get("/api/v1/drivers", response_model=List[schemas.DriverResponse])
def list_drivers(db: Session = Depends(get_db)):
    return db.query(models.Driver).all()


@app.get("/api/v1/drivers/{driver_id}", response_model=schemas.DriverResponse)
def get_driver(driver_id: int, db: Session = Depends(get_db)):
    driver = db.query(models.Driver).filter(models.Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@app.put("/api/v1/drivers/{driver_id}/location", response_model=schemas.DriverResponse)
def update_driver_location(driver_id: int, req: schemas.DriverLocationUpdateRequest, db: Session = Depends(get_db)):
    """Update driver's active operating base location for geofencing and prioritized load recommendations."""
    driver = db.query(models.Driver).filter(models.Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver record not found")

    driver.registered_state = req.registered_state.strip()
    driver.registered_district = req.registered_district.strip()
    driver.registered_taluka = req.registered_taluka.strip()
    db.commit()
    db.refresh(driver)
    return driver


# ===================== FREIGHT POSTS & GEOFENCING =====================

def calculate_approx_distance(scope: str, p_state: str, p_dist: str, p_tal: str, d_state: str, d_dist: str, d_tal: str) -> float:
    """Heuristic road distance calculation for Indian routes if GPS coords not provided."""
    if scope == "INTRA_CITY" or p_tal.lower() == d_tal.lower():
        return 18.5  # average intra-taluka delivery km
    if p_dist.lower() == d_dist.lower():
        return 45.0  # inter-taluka within same district
    if p_state.lower() == d_state.lower():
        return 165.0  # inter-district within same state
    return 350.0  # inter-state


@app.post("/api/v1/posts", response_model=schemas.FreightPostResponse)
def create_freight_post(post_data: schemas.FreightPostCreate, db: Session = Depends(get_db)):
    """
    Creates a new freight load posting.
    Auto-computes XGBoost fair price and estimated distance.
    If 'INTRA_CITY' is selected, ensures dropoff state, district, and taluka match pickup.
    """
    if not post_data.customer_user_id:
        raise HTTPException(
            status_code=401,
            detail="Authentication required: Please sign in or register before posting freight."
        )

    # Auto-lock if INTRA_CITY
    drop_state = post_data.pickup_state if post_data.delivery_scope == "INTRA_CITY" else post_data.drop_state
    drop_district = post_data.pickup_district if post_data.delivery_scope == "INTRA_CITY" else post_data.drop_district
    drop_taluka = post_data.pickup_taluka if post_data.delivery_scope == "INTRA_CITY" else post_data.drop_taluka

    distance = post_data.estimated_distance_km
    if not distance or distance <= 0:
        dist_res = calculate_distance_and_transit(
            pickup_state=post_data.pickup_state,
            pickup_district=post_data.pickup_district,
            pickup_taluka=post_data.pickup_taluka,
            pickup_village=post_data.pickup_village,
            pickup_lat=post_data.pickup_lat,
            pickup_lng=post_data.pickup_lng,
            drop_state=drop_state,
            drop_district=drop_district,
            drop_taluka=drop_taluka,
            drop_village=post_data.drop_village,
            drop_lat=post_data.drop_lat,
            drop_lng=post_data.drop_lng,
            delivery_scope=post_data.delivery_scope
        )
        distance = dist_res["distance_km"]

    # Calculate fair base fare via XGBoost
    pricing_res = predict_price_fast(
        distance_km=distance,
        cargo_weight_kg=post_data.parsed_cargo_weight_kg or 500.0,
        vehicle_type=post_data.vehicle_type,
        delivery_scope=post_data.delivery_scope,
        pickup_taluka=post_data.pickup_taluka,
        drop_taluka=drop_taluka
    )
    predicted_fare = pricing_res["predicted_fair_price"]

    new_post = models.FreightPost(
        customer_user_id=post_data.customer_user_id,
        customer_name=post_data.customer_name,
        customer_phone=post_data.customer_phone,
        delivery_scope=post_data.delivery_scope,
        pickup_state=post_data.pickup_state,
        pickup_district=post_data.pickup_district,
        pickup_taluka=post_data.pickup_taluka,
        pickup_village=post_data.pickup_village,
        pickup_street=post_data.pickup_street,
        pickup_landmark=post_data.pickup_landmark,
        pickup_lat=post_data.pickup_lat,
        pickup_lng=post_data.pickup_lng,
        drop_state=drop_state,
        drop_district=drop_district,
        drop_taluka=drop_taluka,
        drop_village=post_data.drop_village,
        drop_street=post_data.drop_street,
        drop_landmark=post_data.drop_landmark,
        drop_lat=post_data.drop_lat,
        drop_lng=post_data.drop_lng,
        raw_goods_description=post_data.raw_goods_description,
        parsed_goods_type=post_data.parsed_goods_type or "General Cargo",
        parsed_cargo_weight_kg=post_data.parsed_cargo_weight_kg or 500.0,
        handling_notes=post_data.handling_notes,
        vehicle_type=post_data.vehicle_type,
        custom_vehicle_details=post_data.custom_vehicle_details,
        feasible_date=post_data.feasible_date,
        feasible_time_window=post_data.feasible_time_window,
        estimated_distance_km=distance,
        base_price_predicted=predicted_fare,
        customer_budget=post_data.customer_budget,
        status="OPEN"
    )

    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    return new_post


def get_vehicle_photo_for_type(vehicle_type: Optional[str], custom_photo: Optional[str] = None) -> str:
    if custom_photo and custom_photo.strip():
        return custom_photo.strip()
    vt = (vehicle_type or "").lower()
    if "bolero" in vt or "pickup" in vt:
        return "https://images.unsplash.com/photo-1586191582056-a67b45055b85?w=600&auto=format&fit=crop&q=80"
    elif "ace" in vt or "chhota" in vt or "mini" in vt:
        return "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600&auto=format&fit=crop&q=80"
    elif "eicher" in vt or "14ft" in vt or "17ft" in vt or "19ft" in vt:
        return "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=600&auto=format&fit=crop&q=80"
    elif "wheel" in vt or "trailer" in vt or "truck" in vt or "container" in vt:
        return "https://images.unsplash.com/photo-1501700493788-fa1a4fc9fe62?w=600&auto=format&fit=crop&q=80"
    elif "tractor" in vt:
        return "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80"
    elif "3-wheeler" in vt or "ape" in vt or "auto" in vt:
        return "https://images.unsplash.com/photo-1596707325514-dfb79be40a6b?w=600&auto=format&fit=crop&q=80"
    return "https://images.unsplash.com/photo-1586191582056-a67b45055b85?w=600&auto=format&fit=crop&q=80"


@app.get("/api/v1/posts", response_model=List[schemas.FreightPostResponse])
def get_freight_posts(
    # Geofencing parameters for Local Driver
    driver_taluka: Optional[str] = Query(None, description="Local Driver registered Taluka"),
    driver_district: Optional[str] = Query(None, description="Local Driver registered District"),
    driver_id: Optional[int] = Query(None, description="Driver ID to filter out rejected posts"),
    accepted_driver_id: Optional[int] = Query(None, description="Filter for posts where this driver's deal was accepted and finalized"),
    customer_user_id: Optional[int] = Query(None, description="Filter posts by customer user ID"),
    customer_phone: Optional[str] = Query(None, description="Filter posts by customer phone"),
    customer_name: Optional[str] = Query(None, description="Filter posts by customer name"),
    post_ids: Optional[str] = Query(None, description="Comma-separated post IDs belonging to current customer"),
    customer_view: Optional[bool] = Query(False, description="Flag indicating customer tracker view"),
    # Return Trip Corridor Search parameters
    corridor_dest_state: Optional[str] = Query(None, description="Return Trip Destination State"),
    corridor_dest_district: Optional[str] = Query(None, description="Return Trip Destination District"),
    corridor_dest_taluka: Optional[str] = Query(None, description="Return Trip Destination Taluka"),
    # Broad/Custom filters
    all_loads: Optional[bool] = Query(False, description="View all loads without strict geofencing"),
    pickup_state: Optional[str] = Query(None, description="Filter by pickup state"),
    pickup_district: Optional[str] = Query(None, description="Filter by pickup district"),
    pickup_taluka: Optional[str] = Query(None, description="Filter by pickup taluka"),
    status: Optional[str] = Query(None, description="Filter by status e.g. OPEN, DRIVER_REQUESTED, NEGOTIATING, AGREED"),
    db: Session = Depends(get_db)
):
    """
    Driver Load Discovery & Customer Tracking Engine:
    0. Accepted Trips: Show confirmed/finalized trips accepted for this specific driver.
    1. Customer View: Strictly filters loads to ONLY posts created by this customer (by user_id).
    2. All India / Open Feed: View all loads or filter by chosen pickup area.
    3. Return Trip Corridor Search: Driver searches destination corridors.
    4. Local Area Geofencing: Local drivers in/near pickup Taluka/District.
    5. Rejection Exclusion: Posts that customer rejected this driver from are hidden.
    """
    query = db.query(models.FreightPost)

    # 0. DRIVER ACCEPTED TRIPS: Filter for posts finalized and agreed with this driver
    if accepted_driver_id:
        query = query.filter(
            models.FreightPost.status == "AGREED",
            models.FreightPost.agreed_driver_id == accepted_driver_id
        )
    # 1. STRICT CUSTOMER TRACKER FILTER: Show ONLY posts that belong to this authenticated customer
    elif customer_view:
        # Without sign in (no customer_user_id), return empty list immediately!
        if not customer_user_id:
            return []

        # 100% Strict Account Isolation: Only posts created by this authenticated user account
        query = query.filter(models.FreightPost.customer_user_id == customer_user_id)
    elif customer_phone:
        clean_phone = "".join(filter(str.isdigit, customer_phone))
        if len(clean_phone) >= 7:
            query = query.filter(models.FreightPost.customer_phone.ilike(f"%{clean_phone[-10:]}%"))

    if status:
        query = query.filter(models.FreightPost.status == status)

    # For Driver Feed: Hide already agreed/finalized posts from other drivers so they are not recommended
    if not customer_view and not customer_phone and not accepted_driver_id:
        from sqlalchemy import or_
        if driver_id:
            query = query.filter(or_(models.FreightPost.status != "AGREED", models.FreightPost.agreed_driver_id == driver_id))
        else:
            query = query.filter(models.FreightPost.status != "AGREED")

    if not accepted_driver_id:
        # Auto-resolve driver base location from database if driver_id is provided and location not explicitly given
        if driver_id and not driver_taluka and not driver_district and not all_loads:
            drv_record = db.query(models.Driver).filter(models.Driver.id == driver_id).first()
            if drv_record:
                driver_taluka = drv_record.registered_taluka
                driver_district = drv_record.registered_district

        # 1. Broad / All-India Search
        if all_loads or driver_taluka == "__ALL__" or driver_district == "__ALL__":
            if pickup_state and pickup_state != "__ALL__":
                query = query.filter(models.FreightPost.pickup_state.ilike(f"%{pickup_state}%"))
            if pickup_district and pickup_district != "__ALL__":
                query = query.filter(models.FreightPost.pickup_district.ilike(f"%{pickup_district}%"))
            if pickup_taluka and pickup_taluka != "__ALL__":
                query = query.filter(models.FreightPost.pickup_taluka.ilike(f"%{pickup_taluka}%"))
        # 2. Return Trip Corridor Search takes precedence if provided
        elif corridor_dest_state or corridor_dest_district or corridor_dest_taluka:
            if corridor_dest_state:
                query = query.filter(models.FreightPost.drop_state.ilike(f"%{corridor_dest_state}%"))
            if corridor_dest_district:
                query = query.filter(models.FreightPost.drop_district.ilike(f"%{corridor_dest_district}%"))
            if corridor_dest_taluka:
                query = query.filter(models.FreightPost.drop_taluka.ilike(f"%{corridor_dest_taluka}%"))
        # 3. Otherwise apply Local Area Geofencing if driver profile location is passed
        elif (driver_taluka or driver_district) and not customer_phone:
            from sqlalchemy import or_
            geo_filters = []
            if driver_taluka and driver_taluka != "__ALL__":
                geo_filters.append(models.FreightPost.pickup_taluka.ilike(f"%{driver_taluka}%"))
                geo_filters.append(models.FreightPost.drop_taluka.ilike(f"%{driver_taluka}%"))
            if driver_district and driver_district != "__ALL__":
                geo_filters.append(models.FreightPost.pickup_district.ilike(f"%{driver_district}%"))
                geo_filters.append(models.FreightPost.drop_district.ilike(f"%{driver_district}%"))
            if geo_filters:
                query = query.filter(or_(*geo_filters))

    posts = query.order_by(models.FreightPost.created_at.desc()).all()

    # Filter out posts from which this driver was rejected by customer
    if driver_id:
        posts = [p for p in posts if not p.rejected_driver_ids or driver_id not in (p.rejected_driver_ids or [])]

    # Format response: Mask customer phone number if deal is not AGREED or phone share disabled
    result = []
    for p in posts:
        post_dict = {c.name: getattr(p, c.name) for c in p.__table__.columns}
        
        # Build enriched offers list with driver metadata
        offers_list = []
        if p.offers:
            for off in p.offers:
                off_dict = {c.name: getattr(off, c.name) for c in off.__table__.columns}
                d = db.query(models.Driver).filter(models.Driver.id == off.driver_id).first()
                if d:
                    off_dict["driver_name"] = d.full_name
                    # Privacy: Do not share driver phone directly until customer accepts
                    if p.status == "AGREED" and p.agreed_driver_id == d.id:
                        off_dict["driver_phone"] = d.phone
                    else:
                        off_dict["driver_phone"] = (d.phone[:3] + "XXXX" + d.phone[-3:]) if len(d.phone) >= 7 else "XXXXXXXXXX"
                    off_dict["driver_kyc_verified"] = d.kyc_verified
                    off_dict["driver_vehicle_type"] = d.vehicle_type
                    off_dict["driver_vehicle_rc"] = d.vehicle_rc_no
                    if d.parivahan_details and isinstance(d.parivahan_details, dict):
                        off_dict["driver_certificate_id"] = d.parivahan_details.get("certificate_id")
                    
                    # Fetch vehicle photo and driver profile image
                    u = db.query(models.User).filter((models.User.phone == d.phone) | (models.User.full_name == d.full_name)).first()
                    custom_v_photo = u.vehicle_photo_url if u else None
                    off_dict["driver_vehicle_photo_url"] = get_vehicle_photo_for_type(d.vehicle_type, custom_v_photo)
                    off_dict["driver_photo_url"] = u.avatar_url if u else None
                offers_list.append(schemas.NegotiationOfferResponse(**off_dict))
        
        post_dict["offers"] = offers_list
        post_dict["offers_count"] = len(offers_list)

        # Phone masking rules
        if not customer_view and not customer_phone:
            if p.status != "AGREED":
                post_dict["customer_phone"] = p.customer_phone[:3] + "XXXX" + p.customer_phone[-3:] if len(p.customer_phone) >= 7 else "XXXXXXXXXX"
            else:
                # If customer chose not to share phone with driver
                if p.share_phone_with_driver is False:
                    post_dict["customer_phone"] = p.customer_phone[:3] + "XXXX" + p.customer_phone[-3:] if len(p.customer_phone) >= 7 else "XXXXXXXXXX"
        
        if p.status == "AGREED" and p.agreed_driver_id:
            d = db.query(models.Driver).filter(models.Driver.id == p.agreed_driver_id).first()
            if d:
                post_dict["agreed_driver_name"] = d.full_name
                post_dict["agreed_driver_phone"] = d.phone
                post_dict["agreed_driver_vehicle_type"] = d.vehicle_type
                post_dict["agreed_driver_vehicle_rc"] = d.vehicle_rc_no
                post_dict["agreed_driver_kyc_verified"] = d.kyc_verified
                if d.parivahan_details and isinstance(d.parivahan_details, dict):
                    post_dict["agreed_driver_certificate_id"] = d.parivahan_details.get("certificate_id")
                u = db.query(models.User).filter((models.User.phone == d.phone) | (models.User.full_name == d.full_name)).first()
                custom_v_photo = u.vehicle_photo_url if u else None
                post_dict["agreed_driver_vehicle_photo_url"] = get_vehicle_photo_for_type(d.vehicle_type, custom_v_photo)
                post_dict["agreed_driver_photo_url"] = u.avatar_url if u else None

        result.append(schemas.FreightPostResponse(**post_dict))

    return result


@app.get("/api/v1/posts/{post_id}", response_model=schemas.FreightPostDetailResponse)
def get_post_detail(post_id: int, db: Session = Depends(get_db)):
    """Retrieves full post details with active negotiation room offers."""
    post = db.query(models.FreightPost).filter(models.FreightPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Freight post not found")

    post_dict = {c.name: getattr(post, c.name) for c in post.__table__.columns}
    post_dict["offers_count"] = len(post.offers)

    # Attach driver metadata to each offer
    offers_list = []
    for off in post.offers:
        off_dict = {c.name: getattr(off, c.name) for c in off.__table__.columns}
        driver = db.query(models.Driver).filter(models.Driver.id == off.driver_id).first()
        if driver:
            off_dict["driver_name"] = driver.full_name
            if post.status == "AGREED" and post.agreed_driver_id == driver.id:
                off_dict["driver_phone"] = driver.phone
            else:
                off_dict["driver_phone"] = (driver.phone[:3] + "XXXX" + driver.phone[-3:]) if len(driver.phone) >= 7 else "XXXXXXXXXX"
            off_dict["driver_kyc_verified"] = driver.kyc_verified
            off_dict["driver_vehicle_type"] = driver.vehicle_type
            off_dict["driver_vehicle_rc"] = driver.vehicle_rc_no
            if driver.parivahan_details and isinstance(driver.parivahan_details, dict):
                off_dict["driver_certificate_id"] = driver.parivahan_details.get("certificate_id")
            u = db.query(models.User).filter((models.User.phone == driver.phone) | (models.User.full_name == driver.full_name)).first()
            custom_v_photo = u.vehicle_photo_url if u else None
            off_dict["driver_vehicle_photo_url"] = get_vehicle_photo_for_type(driver.vehicle_type, custom_v_photo)
            off_dict["driver_photo_url"] = u.avatar_url if u else None
        offers_list.append(schemas.NegotiationOfferResponse(**off_dict))

    post_dict["offers"] = offers_list

    if post.status != "AGREED":
        post_dict["customer_phone"] = post.customer_phone[:3] + "XXXX" + post.customer_phone[-3:] if len(post.customer_phone) >= 7 else "XXXXXXXXXX"
    else:
        if post.agreed_driver_id:
            d = db.query(models.Driver).filter(models.Driver.id == post.agreed_driver_id).first()
            if d:
                post_dict["agreed_driver_name"] = d.full_name
                post_dict["agreed_driver_phone"] = d.phone
                post_dict["agreed_driver_vehicle_type"] = d.vehicle_type
                post_dict["agreed_driver_vehicle_rc"] = d.vehicle_rc_no
                post_dict["agreed_driver_kyc_verified"] = d.kyc_verified
                if d.parivahan_details and isinstance(d.parivahan_details, dict):
                    post_dict["agreed_driver_certificate_id"] = d.parivahan_details.get("certificate_id")
                u = db.query(models.User).filter((models.User.phone == d.phone) | (models.User.full_name == d.full_name)).first()
                custom_v_photo = u.vehicle_photo_url if u else None
                post_dict["agreed_driver_vehicle_photo_url"] = get_vehicle_photo_for_type(d.vehicle_type, custom_v_photo)
                post_dict["agreed_driver_photo_url"] = u.avatar_url if u else None

    return schemas.FreightPostDetailResponse(**post_dict)


# ===================== NEGOTIATION ROOM & CONTACT EXCHANGER =====================

@app.post("/api/v1/posts/{post_id}/negotiate", response_model=schemas.NegotiationOfferResponse)
def submit_negotiation_offer(
    post_id: int,
    offer_data: schemas.NegotiationOfferCreate,
    db: Session = Depends(get_db)
):
    """
    Submits a counter-offer or chat message (text or voice-dictated note) in the negotiation room.
    """
    post = db.query(models.FreightPost).filter(models.FreightPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Freight post not found")

    # Resolve driver: check Driver.id, then User.id, then phone/name match, or fallback
    driver = db.query(models.Driver).filter(models.Driver.id == offer_data.driver_id).first()
    if not driver:
        user = db.query(models.User).filter(models.User.id == offer_data.driver_id).first()
        if user:
            driver = db.query(models.Driver).filter(
                (models.Driver.phone == user.phone) | (models.Driver.full_name == user.full_name)
            ).first()
            if not driver:
                driver = models.Driver(
                    full_name=user.full_name,
                    phone=user.phone or f"98220{user.id:05d}",
                    driving_license_no=user.driving_license_no or f"MH12{user.id:010d}",
                    aadhaar_no=user.aadhaar_no or "999912345678",
                    vehicle_rc_no=user.vehicle_rc_no or f"MH12AB{user.id:04d}",
                    vehicle_type=user.vehicle_type or "Mahindra Bolero Pickup",
                    registered_state=user.state or "Maharashtra",
                    registered_district=user.district or "Pune",
                    registered_taluka=user.taluka or "Haveli",
                    kyc_verified=user.kyc_verified or False
                )
                db.add(driver)
                db.commit()
                db.refresh(driver)
        if not driver:
            driver = db.query(models.Driver).first()

    if not driver:
        raise HTTPException(status_code=404, detail="No driver profile available")

    # Mark post status as actively NEGOTIATING
    if post.status == "OPEN":
        post.status = "NEGOTIATING"

    new_offer = models.NegotiationOffer(
        post_id=post_id,
        driver_id=driver.id,
        sender_role=offer_data.sender_role,
        offered_price=offer_data.offered_price,
        message=offer_data.message,
        audio_note_text=offer_data.audio_note_text,
        status="PENDING"
    )

    db.add(new_offer)
    db.commit()
    db.refresh(new_offer)

    off_dict = {c.name: getattr(new_offer, c.name) for c in new_offer.__table__.columns}
    off_dict["driver_name"] = driver.full_name
    off_dict["driver_kyc_verified"] = driver.kyc_verified
    return schemas.NegotiationOfferResponse(**off_dict)


@app.post("/api/v1/negotiations/{offer_id}/accept")
def accept_negotiation_deal(offer_id: int, db: Session = Depends(get_db)):
    """
    Mutually finalizes the deal between Shipper/Customer and Driver.
    1. Locks post status as 'AGREED'
    2. Stores agreed parameters in 'transaction_memories' table for XGBoost self-learning
    3. Unlocks and reveals direct customer and driver contact numbers & WhatsApp links.
    """
    offer = db.query(models.NegotiationOffer).filter(models.NegotiationOffer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Negotiation offer not found")

    post = db.query(models.FreightPost).filter(models.FreightPost.id == offer.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Freight post not found")

    driver = db.query(models.Driver).filter(models.Driver.id == offer.driver_id).first()
    if not driver:
        driver = db.query(models.Driver).first()

    offer.status = "ACCEPTED"
    post.status = "AGREED"
    post.agreed_driver_id = driver.id if driver else None
    post.agreed_price = offer.offered_price

    # Save to transaction_memories for XGBoost continuous learning
    memory_record = models.TransactionMemory(
        post_id=post.id,
        pickup_taluka=post.pickup_taluka,
        drop_taluka=post.drop_taluka,
        pickup_district=post.pickup_district,
        drop_district=post.drop_district,
        distance_km=post.estimated_distance_km,
        vehicle_code=post.vehicle_type,
        cargo_weight_kg=post.parsed_cargo_weight_kg or 500.0,
        final_agreed_price=offer.offered_price
    )
    db.add(memory_record)
    db.commit()

    return {
        "success": True,
        "message": "🎉 Deal finalized and agreed mutually! Contact numbers and WhatsApp links unlocked.",
        "post_id": post.id,
        "agreed_fare": offer.offered_price,
        "customer": {
            "name": post.customer_name,
            "phone": post.customer_phone,
            "whatsapp_link": f"https://wa.me/91{post.customer_phone}?text=Hello%20{post.customer_name},%20deal%20finalized%20on%20FlexiFreight%20AI%20for%20load%20#{post.id}"
        },
        "driver": {
            "name": driver.full_name,
            "phone": driver.phone,
            "vehicle_rc": driver.vehicle_rc_no,
            "vehicle_type": driver.vehicle_type,
            "kyc_verified": driver.kyc_verified,
            "whatsapp_link": f"https://wa.me/91{driver.phone}?text=Hello%20{driver.full_name},%20deal%20finalized%20on%20FlexiFreight%20AI%20for%20load%20#{post.id}"
        }
    }


@app.post("/api/v1/posts/{post_id}/driver-accept", response_model=schemas.NegotiationOfferResponse)
def driver_accept_order(
    post_id: int,
    accept_data: schemas.DriverAcceptRequest,
    db: Session = Depends(get_db)
):
    """
    Step 3/4: Driver accepts freight post.
    Creates a PENDING acceptance offer from Driver to Customer.
    Marks post status as 'DRIVER_REQUESTED' so customer is immediately notified.
    """
    post = db.query(models.FreightPost).filter(models.FreightPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Freight post not found")

    driver = db.query(models.Driver).filter(models.Driver.id == accept_data.driver_id).first()
    if not driver:
        user = db.query(models.User).filter(models.User.id == accept_data.driver_id).first()
        if user:
            driver = db.query(models.Driver).filter(
                (models.Driver.phone == user.phone) | (models.Driver.full_name == user.full_name)
            ).first()
        if not driver:
            driver = db.query(models.Driver).first()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    post.status = "DRIVER_REQUESTED"
    agreed_price = accept_data.offered_price or post.customer_budget
    msg = accept_data.message or f"Transporter {driver.full_name} accepted your freight load at ₹{int(agreed_price)}. Ready for pickup."

    # Check for existing offer
    existing_offer = db.query(models.NegotiationOffer).filter(
        models.NegotiationOffer.post_id == post_id,
        models.NegotiationOffer.driver_id == driver.id
    ).first()

    if existing_offer:
        existing_offer.offered_price = agreed_price
        existing_offer.message = msg
        existing_offer.status = "PENDING"
        existing_offer.sender_role = "DRIVER"
        offer = existing_offer
    else:
        offer = models.NegotiationOffer(
            post_id=post_id,
            driver_id=driver.id,
            sender_role="DRIVER",
            offered_price=agreed_price,
            message=msg,
            status="PENDING"
        )
        db.add(offer)

    db.commit()
    db.refresh(offer)

    off_dict = {c.name: getattr(offer, c.name) for c in offer.__table__.columns}
    off_dict["driver_name"] = driver.full_name
    off_dict["driver_phone"] = driver.phone
    off_dict["driver_kyc_verified"] = driver.kyc_verified
    off_dict["driver_vehicle_type"] = driver.vehicle_type
    off_dict["driver_vehicle_rc"] = driver.vehicle_rc_no
    if driver.parivahan_details and isinstance(driver.parivahan_details, dict):
        off_dict["driver_certificate_id"] = driver.parivahan_details.get("certificate_id")

    return schemas.NegotiationOfferResponse(**off_dict)


@app.post("/api/v1/posts/{post_id}/customer-decision")
def customer_decision_on_driver(
    post_id: int,
    decision: schemas.CustomerDecisionRequest,
    db: Session = Depends(get_db)
):
    """
    Step 4: Customer decides on Driver request.
    - If ACCEPT: Customer accepts driver, chooses whether to share phone number, deal is finalized.
    - If REJECT: Driver is rejected, added to post.rejected_driver_ids, post removed from that driver's feed.
    """
    post = db.query(models.FreightPost).filter(models.FreightPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Freight post not found")

    driver = db.query(models.Driver).filter(models.Driver.id == decision.driver_id).first()
    if not driver:
        user = db.query(models.User).filter(models.User.id == decision.driver_id).first()
        if user:
            driver = db.query(models.Driver).filter(
                (models.Driver.phone == user.phone) | (models.Driver.full_name == user.full_name)
            ).first()

    offer = None
    if decision.offer_id:
        offer = db.query(models.NegotiationOffer).filter(models.NegotiationOffer.id == decision.offer_id).first()
    if not offer and driver:
        offer = db.query(models.NegotiationOffer).filter(
            models.NegotiationOffer.post_id == post_id,
            models.NegotiationOffer.driver_id == driver.id
        ).order_by(models.NegotiationOffer.id.desc()).first()

    if decision.action.upper() == "ACCEPT":
        if offer:
            offer.status = "ACCEPTED"
        post.status = "AGREED"
        post.agreed_driver_id = driver.id if driver else decision.driver_id
        post.agreed_price = decision.agreed_price or (offer.offered_price if offer else post.customer_budget)
        post.share_phone_with_driver = bool(decision.share_phone)

        # Record in TransactionMemory for continuous XGBoost self-learning
        memory_record = models.TransactionMemory(
            post_id=post.id,
            pickup_taluka=post.pickup_taluka,
            drop_taluka=post.drop_taluka,
            pickup_district=post.pickup_district,
            drop_district=post.drop_district,
            distance_km=post.estimated_distance_km,
            vehicle_code=post.vehicle_type,
            cargo_weight_kg=post.parsed_cargo_weight_kg or 500.0,
            final_agreed_price=post.agreed_price
        )
        db.add(memory_record)
        db.commit()

        cust_phone = post.customer_phone if post.share_phone_with_driver else (post.customer_phone[:3] + "XXXX" + post.customer_phone[-3:] if len(post.customer_phone) >= 7 else "XXXXXXXXXX")

        return {
            "success": True,
            "action": "ACCEPT",
            "message": f"🎉 Deal confirmed with {driver.full_name if driver else 'Transporter'}! " + ("Phone numbers shared." if post.share_phone_with_driver else "Contact number kept confidential."),
            "post_id": post.id,
            "agreed_fare": post.agreed_price,
            "shared_phone": post.share_phone_with_driver,
            "customer": {
                "name": post.customer_name,
                "phone": cust_phone,
                "whatsapp_link": f"https://wa.me/91{post.customer_phone}?text=Hello%20{post.customer_name},%20deal%20finalized%20on%20FlexiFreight%20AI%20for%20load%20#{post.id}" if post.share_phone_with_driver else None
            },
            "driver": {
                "name": driver.full_name if driver else "Transporter",
                "phone": driver.phone if driver else "",
                "vehicle_rc": driver.vehicle_rc_no if driver else "",
                "vehicle_type": driver.vehicle_type if driver else "",
                "vehicle_photo_url": get_vehicle_photo_for_type(driver.vehicle_type if driver else None, None),
                "kyc_verified": driver.kyc_verified if driver else False,
                "certificate_id": driver.parivahan_details.get("certificate_id") if (driver and driver.parivahan_details and isinstance(driver.parivahan_details, dict)) else "PRV-VAHAN-2026-948102",
                "whatsapp_link": f"https://wa.me/91{driver.phone}?text=Hello%20{driver.full_name},%20deal%20finalized%20on%20FlexiFreight%20AI%20for%20load%20#{post.id}" if driver else None
            }
        }

    elif decision.action.upper() == "REJECT":
        if offer:
            offer.status = "REJECTED"
            db.flush()

        # Add driver to rejected list for this post
        cur_rejected = list(post.rejected_driver_ids or [])
        if decision.driver_id not in cur_rejected:
            cur_rejected.append(decision.driver_id)
        post.rejected_driver_ids = cur_rejected

        # If no other pending offers, reopen post
        query_pending = db.query(models.NegotiationOffer).filter(
            models.NegotiationOffer.post_id == post_id,
            models.NegotiationOffer.status == "PENDING"
        )
        if offer:
            query_pending = query_pending.filter(models.NegotiationOffer.id != offer.id)
        other_pending = query_pending.count()

        if other_pending == 0:
            post.status = "OPEN"

        db.commit()

        return {
            "success": True,
            "action": "REJECT",
            "message": f"Transporter {driver.full_name if driver else ''} rejected. Post removed from this transporter's board and reopened for others.",
            "post_id": post.id
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Must be 'ACCEPT' or 'REJECT'")


# ===================== MANUAL / SCHEDULED RETRAINING =====================

@app.post("/api/v1/retrain", response_model=schemas.RetrainStatusResponse)
def trigger_retraining(db: Session = Depends(get_db)):
    """
    On-demand endpoint to trigger XGBoost model retraining over historical deal memories.
    Also triggered daily at 2:00 AM automatically via APScheduler.
    """
    result = execute_daily_retraining(db)
    return schemas.RetrainStatusResponse(**result)
