"""
Comprehensive Automated Test Suite for FlexiFreight AI
Tests:
1. Server Health & Database Connectivity
2. All-India Location Hierarchy (States, Districts, Talukas, Villages, PIN Code lookup)
3. Auth Flow: User Registration
4. Auth Flow: User Login (JWT token issue & PBKDF2 hash verification)
5. Auth Flow: Google Sign-In Simulation
6. Auth Flow: 2-Step Password Reset (Forgot Password 6-digit Code & Reset Password)
7. User Profile Management: Update Personal Details, 4-Tier Address, Driver & Commercial Vehicle KYC (RC, License, Capacity, Vehicle Photo)
8. Authenticated User Profile Retrieval (/api/v1/auth/me)
"""

import urllib.request
import urllib.parse
import json
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://127.0.0.1:8000"

def make_request(method, path, data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data else None
    
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            return status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = {"error": content}
        return e.code, parsed
    except Exception as e:
        return 500, {"error": str(e)}

def run_tests():
    stats = {"total": 0, "passed": 0}

    def assert_test(condition, test_name, details=""):
        stats["total"] += 1
        if condition:
            stats["passed"] += 1
            print(f"[PASS] {test_name} {details}")
        else:
            print(f"[FAIL] {test_name} {details}")

    print("=" * 60)
    print("RUNNING FLEXIFREIGHT AI AUTOMATED VERIFICATION SUITE")
    print("=" * 60)

    # 1. Health Check
    status, res = make_request("GET", "/health")
    assert_test(status == 200 and res.get("status") == "HEALTHY", "1. System Health Check", f"Status: {res.get('status')}")

    # 2. Location API - States
    status, states = make_request("GET", "/api/v1/locations/states")
    assert_test(status == 200 and len(states) >= 28 and "Maharashtra" in states and "Gujarat" in states, 
                "2. Location API: All-India States", f"Total states returned: {len(states)}")

    # 3. Location API - Districts of Maharashtra
    status, districts = make_request("GET", "/api/v1/locations/districts?state=Maharashtra")
    assert_test(status == 200 and "Pune" in districts and "Mumbai City" in districts and "Nagpur" in districts,
                "3. Location API: Maharashtra Districts", f"Districts count: {len(districts)}")

    # 4. Location API - Talukas of Pune District
    status, talukas = make_request("GET", "/api/v1/locations/talukas?state=Maharashtra&district=Pune")
    has_khed = any("khed" in t.lower() for t in talukas)
    assert_test(status == 200 and "Haveli" in talukas and "Baramati" in talukas and has_khed,
                "4. Location API: Pune Talukas", f"Talukas: {', '.join(talukas[:5])}...")

    # 5. Location API - Villages of Haveli Taluka
    status, villages = make_request("GET", "/api/v1/locations/villages?taluka=Haveli")
    assert_test(status == 200 and len(villages) > 0 and "Hadapsar" in villages,
                "5. Location API: Haveli Villages", f"Villages: {', '.join(villages[:4])}...")

    # 6. Location API - 6-Digit PIN Code Lookup
    status, pin_info = make_request("GET", "/api/v1/locations/pincode/411001")
    assert_test(status == 200 and pin_info.get("state") == "Maharashtra" and pin_info.get("district") == "Pune",
                "6. Location API: PIN Code 411001 Lookup", f"Resolved: {pin_info.get('district')}, {pin_info.get('state')}")

    # 7. Auth: Registration
    ts = int(time.time())
    test_email = f"driver_test_{ts}@flexifreight.ai"
    reg_payload = {
        "email": test_email,
        "password": "SecurePassword123!",
        "full_name": "Ramesh Patil",
        "phone": "+91 9876543210",
        "role": "DRIVER"
    }
    status, reg_res = make_request("POST", "/api/v1/auth/register", reg_payload)
    user_id = reg_res.get("user", {}).get("id")
    token = reg_res.get("token")
    assert_test(status in [200, 201] and user_id is not None and token is not None,
                "7. Auth API: User Registration", f"Registered User ID: {user_id}")

    # 8. Auth: Login with password
    login_payload = {
        "email": test_email,
        "password": "SecurePassword123!"
    }
    status, login_res = make_request("POST", "/api/v1/auth/login", login_payload)
    token = login_res.get("token")
    assert_test(status == 200 and token is not None and login_res.get("user", {}).get("email") == test_email,
                "8. Auth API: Password Login & JWT Token Issue", f"Token: {token[:20]}...")

    # 9. Auth: Google Sign-in Simulation
    google_payload = {
        "email": f"google_driver_{ts}@gmail.com",
        "full_name": "Vikram Rathore",
        "google_id": f"google_oauth_{ts}",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
        "role": "DRIVER"
    }
    status, google_res = make_request("POST", "/api/v1/auth/google", google_payload)
    google_user_id = google_res.get("user", {}).get("id")
    assert_test(status == 200 and google_user_id is not None and google_res.get("token") is not None,
                "9. Auth API: Google OAuth Sign-In", f"Google User: {google_res.get('user', {}).get('full_name')}")

    # 10. Auth: Forgot Password (6-digit code generation)
    forgot_payload = {"email": test_email}
    status, forgot_res = make_request("POST", "/api/v1/auth/forgot-password", forgot_payload)
    reset_code = forgot_res.get("demo_code")
    assert_test(status == 200 and reset_code and len(reset_code) == 6,
                "10. Auth API: Forgot Password 6-Digit Code", f"Issued Reset Code: {reset_code}")

    # 11. Auth: Reset Password with Code
    reset_payload = {
        "email": test_email,
        "reset_code": reset_code,
        "new_password": "NewUpdatedPassword456!"
    }
    status, reset_res = make_request("POST", "/api/v1/auth/reset-password", reset_payload)
    assert_test(status == 200 and "successfully" in reset_res.get("message", "").lower(),
                "11. Auth API: Reset Password with 6-Digit Code", reset_res.get("message"))

    # 12. Auth: Login with New Password
    new_login_payload = {
        "email": test_email,
        "password": "NewUpdatedPassword456!"
    }
    status, new_login_res = make_request("POST", "/api/v1/auth/login", new_login_payload)
    new_token = new_login_res.get("token")
    assert_test(status == 200 and new_token is not None,
                "12. Auth API: Login with New Password", "Verified password change persistence")

    # 13. Profile Management: Update Profile with 4-Tier Address and Driver/Vehicle Details
    active_token = new_token or token
    profile_payload = {
        "full_name": "Ramesh B. Patil",
        "phone": "9822012345",
        "state": "Maharashtra",
        "district": "Pune",
        "taluka": "Haveli",
        "village": "Hadapsar",
        "street_address": "Shop No 4, Transport Nagar, Pune-Solapur Highway",
        "pincode": "411028",
        "role": "DRIVER",
        "vehicle_rc_no": "MH12PQ9988",
        "driving_license_no": "MH1220190087654",
        "aadhaar_no": "999888777666",
        "vehicle_type": "14ft Eicher",
        "vehicle_model": "Eicher Pro 2049 Multi-Axle",
        "vehicle_capacity_kg": 4500.0,
        "vehicle_photo_url": "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600&auto=format&fit=crop"
    }
    status, prof_res = make_request("PUT", "/api/v1/auth/profile", profile_payload, token=active_token)
    assert_test(status == 200 and prof_res.get("district") == "Pune" and prof_res.get("taluka") == "Haveli",
                "13. Profile API: 4-Tier Address Hierarchy Update", 
                f"Address: {prof_res.get('village')}, {prof_res.get('taluka')}, {prof_res.get('district')}, {prof_res.get('state')}")

    assert_test(prof_res.get("vehicle_rc_no") == "MH12PQ9988" and prof_res.get("vehicle_capacity_kg") == 4500.0,
                "14. Profile API: Driver Vehicle KYC (RC, License, Capacity)",
                f"Vehicle: {prof_res.get('vehicle_rc_no')} | Type: {prof_res.get('vehicle_type')}")

    # 15. Profile API: GET Authenticated User Profile Verification
    status, get_prof_res = make_request("GET", "/api/v1/auth/me", token=active_token)
    assert_test(status == 200 and get_prof_res.get("full_name") == "Ramesh B. Patil" and get_prof_res.get("vehicle_capacity_kg") == 4500.0,
                "15. Profile API: Database Fetch & Persistence (/api/v1/auth/me)",
                f"Name: {get_prof_res.get('full_name')} | Capacity: {get_prof_res.get('vehicle_capacity_kg')} kg")

    # 16. AI Cargo Parser (Natural Language Extraction)
    cargo_payload = {"raw_text": "30 bags of organic basmati rice and 4 drums mustard oil urgent delivery"}
    status, cargo_res = make_request("POST", "/api/v1/parse-cargo", cargo_payload)
    assert_test(status == 200 and cargo_res.get("parsed_cargo_weight_kg", 0) > 0,
                "16. AI Cargo Parser: Natural Language Goods Extraction",
                f"Type: {cargo_res.get('parsed_goods_type')} | Weight: {cargo_res.get('parsed_cargo_weight_kg')} kg")

    # 17. Real-Time Fare Prediction Engine
    price_payload = {
        "distance_km": 45.0,
        "cargo_weight_kg": 2500.0,
        "vehicle_type": "Mahindra Bolero Pickup",
        "delivery_scope": "INTRA_CITY",
        "pickup_taluka": "Haveli",
        "drop_taluka": "Shirur"
    }
    status, price_res = make_request("POST", "/api/v1/predict-price", price_payload)
    assert_test(status == 200 and price_res.get("predicted_fair_price", 0) > 0,
                "17. Pricing Engine: Real-Time Fair Fare Calculation",
                f"Predicted: ₹{price_res.get('predicted_fair_price')} (Min: ₹{price_res.get('min_recommended_fare')})")

    # 18. Parivahan / VAHAN National Register Driver KYC Verification
    kyc_payload = {
        "full_name": "Ramesh B. Patil",
        "phone": "9822012345",
        "driving_license_no": "MH1220180012345",
        "aadhaar_no": "999888777666",
        "vehicle_rc_no": "MH12PQ9988",
        "vehicle_type": "14ft Eicher",
        "registered_state": "Maharashtra",
        "registered_district": "Pune",
        "registered_taluka": "Haveli"
    }
    status, kyc_res = make_request("POST", "/api/v1/verify-driver-kyc", kyc_payload)
    assert_test(status == 200 and kyc_res.get("kyc_verified") is True,
                "18. KYC Engine: Parivahan Sarathi & VAHAN Verification",
                f"Badge: {kyc_res.get('badge_title')} | Certificate: {kyc_res.get('certificate_id')}")

    # 19. Freight Posts Feed (Database query)
    status, posts_res = make_request("GET", "/api/v1/posts")
    posts_list = posts_res if isinstance(posts_res, list) else posts_res.get("posts", [])
    assert_test(status == 200 and len(posts_list) > 0,
                "19. Freight Posts Feed: Active Loads Retrieval (/api/v1/posts)",
                f"Total active posts in database: {len(posts_list)}")

    # 20. Post New Freight Load with 4-Tier Cascading Location
    new_post_payload = {
        "customer_user_id": user_id,
        "customer_name": "Kisan Agro Logistics",
        "customer_phone": "9812345678",
        "delivery_scope": "INTRA_CITY",
        "pickup_state": "Maharashtra",
        "pickup_district": "Pune",
        "pickup_taluka": "Haveli",
        "pickup_village": "Uruli Kanchan",
        "pickup_street": "Station Road Market",
        "pickup_landmark": "Near APMC Sub-Yard",
        "drop_state": "Maharashtra",
        "drop_district": "Pune",
        "drop_taluka": "Haveli",
        "drop_village": "Hadapsar",
        "drop_street": "Pune Solapur Highway",
        "drop_landmark": "Near Gadital Depot",
        "raw_goods_description": "50 crates fresh tomatoes",
        "parsed_goods_type": "Perishable Produce",
        "parsed_cargo_weight_kg": 1500.0,
        "handling_notes": "Ventilated vehicle required",
        "vehicle_type": "Mahindra Bolero Pickup",
        "feasible_date": "2026-10-05",
        "feasible_time_window": "Morning (06:00 AM - 10:00 AM)",
        "estimated_distance_km": 22.0,
        "base_price_predicted": 1250.0,
        "customer_budget": 1300.0
    }
    status, create_post_res = make_request("POST", "/api/v1/posts", new_post_payload)
    created_post_id = create_post_res.get("id")
    assert_test(status == 200 and created_post_id is not None,
                "20. Customer Portal: Post Freight Demand with 4-Tier Cascading Dropdown",
                f"Created Post ID: {created_post_id} | Status: {create_post_res.get('status')}")

    # 21. Driver Feed: Submit AI Negotiation Offer
    offer_id = None
    if created_post_id:
        neg_payload = {
            "driver_id": 1,
            "sender_role": "DRIVER",
            "offered_price": 1350.0,
            "message": "Fuel hike and diesel premium for heavy morning traffic"
        }
        status, neg_res = make_request("POST", f"/api/v1/posts/{created_post_id}/negotiate", neg_payload)
        offer_id = neg_res.get("id")
        assert_test(status == 200 and neg_res.get("status") == "PENDING" and neg_res.get("offered_price") == 1350.0,
                    "21. AI Negotiation: Driver Counter-Offer Submission",
                    f"Offer ID: {offer_id} | Price: Rs. {neg_res.get('offered_price')} | Driver: {neg_res.get('driver_name')}")

    # 22. AI Negotiation: Customer Accepts Deal & Exchanging Contacts
    if offer_id:
        status, accept_res = make_request("POST", f"/api/v1/negotiations/{offer_id}/accept")
        driver_info = accept_res.get("driver", {})
        assert_test(status == 200 and accept_res.get("success") is True and accept_res.get("agreed_fare") == 1350.0,
                    "22. AI Negotiation: Deal Finalization & Contact Unmasking",
                    f"Agreed Fare: Rs. {accept_res.get('agreed_fare')} | Driver Contact: {driver_info.get('phone')} ({driver_info.get('name')})")

    total = stats["total"]
    passed = stats["passed"]
    rate = (passed / max(total, 1)) * 100
    print("=" * 60)
    print(f"RESULTS: {passed}/{total} Tests Passed ({rate:.1f}% Success Rate)")
    print("=" * 60)

    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
