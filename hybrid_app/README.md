# FoodSave AI - Hybrid Flask + React CDN Architecture

## 🎯 What's This?

A **zero-build** production-grade food rescue system using:
- **Backend**: Python Flask + SQLite + scikit-learn
- **Frontend**: React 18 + Tailwind CSS + Spline 3D (all via CDN)
- **No Node.js, no npm, no webpack**

## 🚀 Quick Start

### 1. Install Python Dependencies

```powershell
cd hybrid_app
pip install -r requirements.txt
```

### 2. Seed the Database

```powershell
python seed_db.py
```

This creates test users:
- **Donor**: `donor1` / `pass123`
- **NGO**: `ngo1` / `pass123`

### 3. Run the App

```powershell
python app.py
```

### 4. Open Your Browser

Navigate to: **http://127.0.0.1:5000**

## 📦 Dependency Checklist

### Python dependencies (installed by `pip`)

Declared in [requirements.txt](requirements.txt):
- flask
- pandas
- numpy
- scikit-learn
- plotly

### Frontend/CDN dependencies (loaded in browser)

Declared in [templates/index.html](templates/index.html):
- React 18 (`react`, `react-dom`)
- Babel Standalone
- Tailwind CSS CDN
- Bootstrap 5 + Bootstrap Icons
- Font Awesome 5.15.4
- Chart.js 4.4.2
- Tabulator 6.2.1 (CSS + JS)
- Plotly.js 2.27.0
- html2canvas 1.4.1
- liquidGL
- animate.css
- OwlCarousel2 CSS

Note: CDN libraries are intentionally not installed via `pip`, so they are documented in HTML/README instead of Python requirements.

## ▶ How To Run (Windows PowerShell)

From the repository root:

```powershell
cd hybrid_app
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed_db.py
python app.py
```

Open: **http://127.0.0.1:5000**

## ▶ Optional: Run The Streamlit App

If you also want to run the separate Streamlit app:

```powershell
cd python_app
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
streamlit run app.py
```

## ✨ Features Implemented

### Phase 1: Backend Foundation
- Flask API server
- SQLite database with users and food_listings tables
- AI model (RandomForestRegressor) for spoilage prediction

### Phase 2: REST API Routes
- `POST /api/login` - User authentication
- `POST /api/predict_and_add` - AI prediction + food listing creation
- `GET /api/food` - Fetch unclaimed food listings
- `POST /api/claim` - NGO claim food listings

### Phase 3: Frontend Shell
- React 18 via CDN (no build tools)
- Tailwind CSS for styling
- Spline 3D interactive background
- Glassmorphism UI design
- Navbar with role-based navigation
- Login/Hero section

### Phase 4: Dashboards
- **Donor Dashboard**: AI Safety Wizard with interactive sliders, real-time prediction, and listing creation
- **NGO Dashboard**: Live food feed with claim functionality and auto-refresh

## 🏗️ Architecture Highlights

**The "CDN Bypass" Strategy:**
- React, Babel, and Tailwind loaded via `<script>` tags from unpkg.com
- All React code written inside `<script type="text/babel">` in a single HTML file
- Zero package.json, zero node_modules
- Pure Python backend serves the entire app

**File Structure:**
```
hybrid_app/
├── app.py                  # Flask backend + API + AI
├── templates/
│   └── index.html         # Complete React SPA (CDN-based)
├── requirements.txt       # Python dependencies
├── seed_db.py            # Database seeding script
├── foodsave.db           # SQLite database (auto-created)
└── food_model.pkl        # AI model (auto-created)
```

## 🎨 UI/UX Features

- **3D Interactive Background**: Drag/rotate Spline scene
- **Glassmorphism Cards**: Frosted-glass effect on all panels
- **Real-time Sliders**: Live temperature and time inputs
- **AI Visual Feedback**: Green (safe) / Red (unsafe) result cards
- **Responsive Grid**: Works on mobile, tablet, and desktop

## 🧠 How It Works

1. **Login**: React calls `/api/login`, receives user object and role
2. **Donor Flow**: 
   - Enters food details + environmental conditions
   - React calls `/api/predict_and_add`
   - Flask runs ML model, saves to DB if safe
   - Returns prediction + listing ID
3. **NGO Flow**:
   - Fetches unclaimed listings via `/api/food`
   - Displays cards with donor info and safety hours
   - Claims listing via `/api/claim`
   - Database updated, listing removed from feed

## 🔐 Security Notes

This is a **demonstration architecture**. For production:
- Hash passwords (use bcrypt or werkzeug.security)
- Add JWT or session-based auth
- Implement CORS policies
- Add input validation and rate limiting

## 📊 Next Steps (Optional Enhancements)

- Add real-time notifications (WebSockets)
- Implement pickup pass generation with QR codes
- Add map visualization with Mapbox/Leaflet
- Deploy to cloud (PythonAnywhere, Heroku, Render)

---

**Built with ❤️ using the CDN Bypass Strategy**
