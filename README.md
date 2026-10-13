# 🚚 FlexiFreight AI
> **Universal Freight Transport & Dynamic Agentic AI Negotiation Platform**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agentic%20NLP-blue.svg)](https://langchain-ai.github.io/langgraph/)
[![XGBoost](https://img.shields.io/badge/XGBoost-Self--Learning%20Pricing-red.svg)](https://xgboost.readthedocs.io/)
[![PostGIS](https://img.shields.io/badge/PostGIS-Geospatial%20Geofencing-336791.svg?logo=postgresql)](https://postgis.net/)
[![React](https://img.shields.io/badge/React-18.3%20Vite-61DAFB.svg?logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)

---

## 🌟 Executive Summary & Architectural Overview

**FlexiFreight AI** is a full-stack, enterprise-grade logistics and freight mobility platform tailored for emerging freight markets and rural-urban transport corridors (e.g., India's Taluka & Mandi networks). 

The platform bridges agricultural producers, small and medium enterprises (MSMEs), and freight dispatchers with local commercial transporters through:
1. **Agentic NLP Cargo Parsing**: Unstructured free-text cargo input (multilingual English, Hindi, and Marathi terms like *"35 bori gehu and 5 drums fertilizer"*) parsed into structured weight, category, and safety instructions using LangGraph and LangChain.
2. **Zero-Cost Hybrid Local Pricing Engine**: Real-time (<10ms) market-calibrated fare calculation in ₹ (INR) powered by a local **XGBoost Regressor**, with an **APScheduler** background service retraining the model daily at **02:00 AM IST** over accepted transaction memories.
3. **Dual Scope & Cascading Geofencing**: Intra-taluka local deliveries (with auto-locked destination hierarchy) versus inter-city transit corridors with backhaul/return trip load discovery.
4. **Government Data Driver KYC**: Simulated real-time Parivahan Sarathi & VAHAN National Register verification checking Driving License, Aadhaar, Commercial RC, Active Insurance, and Fitness certificates.
5. **Real-Time Dynamic Negotiation Room**: Counter-offers with text and voice-to-text dictation notes via the Web Speech API. Upon mutual agreement, direct contact numbers and WhatsApp click-to-chat links are instantly revealed.
6. **Multi-Language Vernacular UX**: Instant dynamic switching between English (EN), Hindi (HI), and Marathi (MR).

---

## 📐 System Architecture

```mermaid
graph TD
    User([Shipper / Customer / Transporter]) -->|HTTP / Web Speech API| Frontend[React + Vite + Tailwind]
    
    subgraph Frontend Layer
        Frontend --> CustomerPortal[Customer Portal & Scope Lock]
        Frontend --> DriverFeed[Driver Feed & Geofence / Corridor Search]
        Frontend --> NegotiationRoom[Negotiation Room & Contact Exchanger]
        Frontend --> KycModal[Parivahan / VAHAN KYC Modal]
        Frontend --> MapPicker[Interactive Map Pin Picker]
    end

    Frontend -->|REST API Requests| Backend[FastAPI Uvicorn Backend :8000]

    subgraph Backend Micro-Services
        Backend --> AgenticParser[LangChain + LangGraph Cargo Parser]
        Backend --> LocalXGBoost[Local XGBoost Pricing Engine (<10ms)]
        Backend --> KycService[Government Parivahan / VAHAN Simulator]
        Backend --> BackgroundRetrainer[APScheduler Daily Retraining (02:00 AM)]
    end

    Backend --> PostGIS[(PostgreSQL with PostGIS Extension :5432)]

    subgraph Persistent Storage
        PostGIS --> DriversTable[(drivers)]
        PostGIS --> PostsTable[(freight_posts)]
        PostGIS --> OffersTable[(negotiation_offers)]
        PostGIS --> MemoriesTable[(transaction_memories)]
    end

    MemoriesTable -.->|Daily Re-training Data| BackgroundRetrainer
    BackgroundRetrainer -.->|Updates Saved Weights| LocalXGBoost
```

---

## 📁 Repository File Structure

```text
flexifreight-ai/
├── .env                              # Environment configuration (API keys, DB credentials)
├── docker-compose.yml                # Multi-container orchestration (PostGIS, Backend, Frontend)
├── README.md                         # Comprehensive architecture and runbook documentation
├── backend/
│   ├── Dockerfile                    # Python 3.11-slim container definition
│   ├── requirements.txt              # FastAPI, XGBoost, LangGraph, GeoAlchemy2 dependencies
│   ├── database.py                   # PostGIS connection pool, session, and table initializer
│   ├── models.py                     # SQLAlchemy models (Driver, FreightPost, Negotiation, Memory)
│   ├── schemas.py                    # Pydantic v2 schemas for requests & responses
│   ├── main.py                       # FastAPI application, routing, and APScheduler lifecycle
│   ├── services/
│   │   ├── __init__.py
│   │   ├── trainer.py                # XGBoost pricing model, inference, and retrain pipeline
│   │   └── kyc.py                    # Simulated MoRTH Parivahan / VAHAN validator
│   └── agent/
│       ├── __init__.py
│       └── graph.py                  # LangGraph state workflow for vernacular cargo extraction
└── frontend/
    ├── Dockerfile                    # Node 20-alpine container definition
    ├── package.json                  # Vite, React 18, Tailwind, Lucide Icons dependencies
    ├── vite.config.js                # Vite build and proxy configuration
    ├── tailwind.config.js            # Tailwind color schemes and typography extensions
    ├── postcss.config.js             # PostCSS Tailwind plugins
    ├── index.html                    # HTML5 shell with Google Outfit & Plus Jakarta fonts
    └── src/
        ├── main.jsx                  # React DOM mount
        ├── index.css                 # Custom glassmorphism, fonts, and scrollbars
        ├── App.jsx                   # Multilingual header, role navigation, and status bar
        ├── i18n/
        │   └── translations.js       # Complete EN, HI, MR vernacular translations
        └── components/
            ├── CustomerPortal.jsx    # Dual scope location form, free-text cargo & XGBoost estimator
            ├── DriverFeed.jsx        # Geofenced load board & Return Trip corridor search
            ├── NegotiationRoom.jsx   # Live counter-offers, Web Speech notes, and contact exchange
            ├── KycModal.jsx          # MoRTH Parivahan / VAHAN transporter KYC verification
            └── MapPickerModal.jsx    # Interactive map pin dropper with coordinate geocoding
```

---

## ⚡ Key Features & Implementation Mechanics

### 1. Dual Location Mode (Intra-City vs. Inter-City)
- **Scope Toggle**: Switch between **Same City / Intra-Taluka Delivery** and **Inter-City / Inter-Taluka Delivery**.
- **Auto-Locking Mechanism**: When `INTRA_CITY` is active, the Dropoff State, District, and Taluka form fields automatically lock and mirror the pickup location.
- **Cascading Dropdowns**: Dynamic Master hierarchy: `State` $\rightarrow$ `District / City` $\rightarrow$ `Taluka / Tehsil`.
- **Local Address Details**: Free-text village/area name, street name, and nearby famous landmark (e.g., temple, APMC gate, famous shop).
- **Interactive Map Pin & Voice Dictation**: Drop custom pins on the map canvas or dictate landmarks using the Web Speech API.

### 2. Free-Text Goods Input & Agentic Parsing (LangGraph + Dual Fallback)
- **No Restrictive Dropdowns**: Users can type or speak colloquial freight descriptions in any language (e.g., *"35 bori gehu aur 5 drum fertilizer"* or *"150 crates tamatar"*).
- **LangGraph State Workflow**:
  - `clean_and_normalize_node`: Cleans formatting and vernacular terms.
  - `llm_extraction_node`: Uses `ChatOpenAI(gpt-4o-mini)` when `OPENAI_API_KEY` is present.
  - **Graceful Fallback**: Automatically invokes a high-accuracy vernacular regex & heuristic NLP engine if running offline or without an API key.
  - `validation_and_safety_node`: Clamps payload to physical road boundaries and attaches handling advisories (moisture-sensitive tarpaulin, upright liquid drums, fragile cargo).

### 3. Local XGBoost Pricing Engine (<10ms Inference & APScheduler Retraining)
- **Zero API Cost**: Fare calculation is performed locally using an optimized **XGBoost Regressor** (`xgboost.XGBRegressor`).
- **Feature Set**: Distance ($km$), Cargo Weight ($kg$), Vehicle Code, Intra-Taluka Scope Flag ($0/1$), and Taluka Pair Hash.
- **Ultra-Fast**: Sub-10 millisecond inference latency.
- **APScheduler Background Retrainer**:
  - Runs automatically daily at **02:00 AM IST**.
  - Reads finalized records from `transaction_memories`.
  - Merges memories with calibrated baseline benchmarks and updates model weights.
  - Can also be manually tested on-demand via `POST /api/v1/retrain`.

### 4. Parivahan / VAHAN Government Transporter KYC
- Transporters verify credentials via `POST /api/v1/verify-driver-kyc`.
- Validates Indian Driving License (DL), 12-digit Aadhaar, and Commercial Vehicle Registration (RC).
- Simulates checking active commercial motor insurance (policy provider, valid dates), fitness certificates, and PUC.
- Issues an official verified transporter badge and certificate ID.

### 5. Negotiation Room & Contact Exchanger
- Real-time counter-offer thread between shippers and drivers.
- Supports both text messages and **Web Speech API voice note transcription**.
- When an offer is accepted:
  - The load is marked as `AGREED`.
  - The transaction details are logged into `transaction_memories` for continuous self-learning.
  - Direct telephone numbers and 1-click **WhatsApp Chat Links** (`https://wa.me/...`) are revealed to both parties.

---

## 🚀 Running the Project

### Option A: Using Docker & Docker Compose (Recommended)

1. Clone or navigate to the project directory:
   ```bash
   cd flexifreight-ai
   ```
2. Configure `.env` (optional, default values already set):
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=password
   POSTGRES_DB=flexifreight
   ```
3. Start the entire multi-service stack:
   ```bash
   docker-compose up --build
   ```
4. Access the applications:
   - **Frontend UI**: [http://localhost:3000](http://localhost:3000)
   - **FastAPI Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **PostGIS Database**: `localhost:5432`

---

### Option B: Running Locally (Without Docker)

#### 1. Backend Setup:
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup:
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🧪 Interactive API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check & uptime status |
| `GET` | `/api/v1/locations/hierarchy` | State $\rightarrow$ District $\rightarrow$ Taluka master data |
| `POST` | `/api/v1/parse-cargo` | LangGraph agentic cargo description extraction |
| `POST` | `/api/v1/predict-price` | Ultra-fast (<10ms) XGBoost fare estimation |
| `POST` | `/api/v1/verify-driver-kyc` | Simulated Parivahan/VAHAN Transporter KYC |
| `POST` | `/api/v1/posts` | Create new freight load posting |
| `GET` | `/api/v1/posts` | List loads (with Geofencing or Return Corridor query) |
| `GET` | `/api/v1/posts/{id}` | Single load details with negotiation offers |
| `POST` | `/api/v1/posts/{id}/negotiate` | Submit counter-offer (text or voice note) |
| `POST` | `/api/v1/negotiations/{offer_id}/accept` | Mutually finalize deal & unlock direct phone/WhatsApp |
| `POST` | `/api/v1/retrain` | On-demand trigger for XGBoost continuous retraining |

---

## 🔒 Security & Privacy Notice
- Customer phone numbers are strictly **masked** (e.g. `982XXXX789`) on the public load board until a driver's offer is mutually finalized.
- Upon agreement, telephone and WhatsApp links are safely exchanged.
