# 🍎 FoodSave – AI-Based Food Wastage Reduction System

![Status](https://img.shields.io/badge/Status-Prototype-green)
![Stack](https://img.shields.io/badge/Stack-Full--Stack-blue)
![License](https://img.shields.io/badge/License-MIT-orange)

> **\"Bridging the gap between surplus food and hunger using Artificial Intelligence.\"**

## 📖 Project Overview
**FoodSave** is a full-stack web application designed to minimize food wastage in the hospitality sector. It connects food donors (Hotels, Restaurants) with charitable organizations (NGOs) in real-time.

Unlike standard donation platforms, **FoodSave integrates a Machine Learning model (Random Forest)** to predict the \"Safe Consumption Time\" (Shelf Life) of cooked food based on environmental factors like temperature and preparation time. This ensures that only safe, hygienic food is distributed to the needy.

---

## 🚀 Key Features

### 🏨 For Donors (Hotels/Restaurants)
*   **Easy Listing:** Post surplus food details (Type, Quantity, Cooked Time).
*   **AI Safety Check:** Automated calculation of expiry time. The system rejects entries predicted to spoil before pickup.
*   **Impact Dashboard:** Gamified tracking of \"Total KGs Saved\" and \"People Fed\".

### 🤝 For NGOs (Receivers)
*   **Real-Time Feed:** View available food listings sorted by proximity and expiry time.
*   **Safety Indicators:** Green/Red indicators based on AI spoilage prediction.
*   **One-Click Claim:** Reserve food instantly and generate digital pickup receipts.

### 🤖 The AI Engine
*   **Algorithm:** Random Forest Regressor (Scikit-Learn).
*   **Inputs:** Food Type, Temperature (°C), Time Since Preparation.
*   **Output:** Estimated remaining safe hours.

---

## 🛠️ Technology Stack (Industry Standard)

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E) | Component-based UI with fast build tooling. |
| **Styling** | ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white) | Utility-first CSS for rapid, responsive design. |
| **Backend** | ![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white) ![DRF](https://img.shields.io/badge/Django_REST-ff1709?style=for-the-badge&logo=django&logoColor=white) | Secure, high-performance API development. |
| **Database** | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white) | ACID-compliant relational database for data integrity. |
| **AI / ML** | ![Scikit-Learn](https://img.shields.io/badge/scikit_learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white) ![Pandas](https://img.shields.io/badge/pandas-150458?style=for-the-badge&logo=pandas&logoColor=white) | Random Forest implementation for spoilage prediction. |
| **Auth** | ![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=JSON%20web%20tokens&logoColor=white) | Stateless authentication using SimpleJWT. |
| **Deploy** | ![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white) ![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white) | CI/CD automated deployment pipeline. |

---

## ⚙️ Getting Started

### Prerequisites

- **Python** 3.10+
- **Node.js** 18+ & npm
- **PostgreSQL** 14+

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your PostgreSQL credentials and SECRET_KEY

# Apply migrations and start the server
python manage.py migrate
python manage.py runserver
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env to set VITE_API_BASE_URL to your Django server URL

# Start the development server
npm run dev
```

---

## 🤝 Contributing

Contributions are welcome! Please fork the repository, create a feature branch, and open a pull request.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## 🏗️ System Architecture

```mermaid
graph TD
    %% Styling
    classDef client fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef server fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef db fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;
    classDef ai fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,stroke-dasharray: 5 5;

    User(("👤 User
    (Donor / NGO)"))

    subgraph "💻 Client Side (React + Vite)"
        UI["UI Components
        (Pages/Forms)"]
        State["State Manager
        (Context API)"]
        Axios["Axios Interceptor
        (HTTP Client)"]
    end

    subgraph "⚙️ Server Side (Django REST Framework)"
        Gateway{"API Gateway
        (urls.py)"}
        Auth["🔐 JWT Middleware
        (Security)"]
        View["Views & Logic
        (views.py)"]
        Serializer["Data Serializer
        (serializers.py)"]
        
        subgraph "🧠 AI Module"
            ML["Spoilage Predictor
            (Random Forest .pkl)"]
        end
    end

    subgraph "💾 Data Layer"
        DB[("PostgreSQL
        (Relational Data)")]
    end

    %% Connections
    User ==>|Interacts| UI
    UI --> State
    State --> Axios
    Axios ==>|JSON Request| Gateway
    
    Gateway --> Auth
    Auth -->|Token Valid| View
    Auth -.->|Invalid| User
    
    View <--> Serializer
    View -->|Input: Temp/Time| ML
    ML -->|Output: Expiry Hours| View
    
    View ==>|CRUD Operations| DB

    %% Apply Classes
    class UI,State,Axios client;
    class Gateway,Auth,View,Serializer server;
    class DB db;
    class ML ai;

```

## 🔄 AI Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Donor as 🏨 Donor (User)
    participant FE as ⚛️ React Frontend
    participant API as 🐍 Django API
    participant AI as 🧠 AI Engine
    participant DB as 🐘 PostgreSQL

    Donor->>FE: Fills Food Details (Type, Temp, Time)
    FE->>API: POST /api/food/ (Bearer Token)
    
    Note over API: Middleware Validates Token
    
    API->>AI: Send: (Temp=35°C, Hours=2)
    activate AI
    Note right of AI: Loads .pkl model & predicts
    AI-->>API: Returns: (Safe_Life = 4.5 Hours)
    deactivate AI
    
    API->>API: Calculate Expiry Timestamp
    API->>DB: INSERT into FoodListing
    DB-->>API: Success (ID: 101)
    
    API-->>FE: 201 Created (with Expiry Date)
    FE-->>Donor: Show \"Food Listed Successfully\"

```
