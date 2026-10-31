"""
Seed script for FoodSave hybrid app.
Adds test users (admin, donors, NGOs) and realistic food listings.
Run once before testing: python scripts/seed_db.py
"""
import sqlite3
import random
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "foodsave.db"

# Reuse the app's schema initializer so seeding also works on a brand-new
# database (fresh clone, CI, or a cold deploy) instead of assuming the
# tables already exist.
sys.path.insert(0, str(BASE_DIR))
from app import init_db  # noqa: E402

# (username, password, role, is_verified, is_banned, city)
TEST_USERS = [
    ("admin",   "pass123", "ADMIN",  1, 0, "Bhubaneswar"),
    ("donor1",  "pass123", "DONOR",  1, 0, "Cuttack"),
    ("donor2",  "pass123", "DONOR",  1, 0, "Puri"),
    ("donor3",  "pass123", "DONOR",  1, 0, "Rourkela"),
    ("ngo1",    "pass123", "NGO",    1, 0, "Bhubaneswar"),
    ("ngo2",    "pass123", "NGO",    1, 0, "Sambalpur"),
    ("ngo3",    "pass123", "NGO",    1, 0, "Berhampur"),
]

# City coordinates (subset matching seed users)
SEED_CITY_COORDS = {
    "Bhubaneswar": (20.2961, 85.8245),
    "Cuttack":     (20.4625, 85.8830),
    "Puri":        (19.8135, 85.8312),
    "Rourkela":    (22.2604, 84.8536),
    "Sambalpur":   (21.4669, 83.9757),
    "Berhampur":   (19.3149, 84.7941),
}

FOOD_LISTINGS = [
    # (donor_name, food_name, qty, temp, hours_ago, food_category, storage_type, packaging)
    ("donor1", "Cooked Rice",           20.0,  25.0, 1.5,  "Cooked",  "Room Temp", "Container"),
    ("donor1", "Vegetable Biryani",     15.0,  28.0, 2.0,  "Cooked",  "Room Temp", "Container"),
    ("donor1", "Chapati Bundle",        50.0,  24.0, 1.0,  "Cooked",  "Room Temp", "Wrapped"),
    ("donor1", "Paneer Curry",          10.0,  30.0, 3.0,  "Cooked",  "Room Temp", "Container"),
    ("donor1", "Dal Tadka",             18.0,  26.0, 2.5,  "Cooked",  "Room Temp", "Container"),
    ("donor1", "Fresh Salad Mix",        5.0,   8.0, 0.5,  "Raw",     "Refrigerated", "Bag"),
    ("donor1", "Mixed Fruit Bowl",       8.0,   6.0, 1.0,  "Raw",     "Refrigerated", "Container"),
    ("donor2", "Idli Sambar",           30.0,  27.0, 1.5,  "Cooked",  "Room Temp", "Container"),
    ("donor2", "Poha Breakfast",        25.0,  25.0, 0.5,  "Cooked",  "Room Temp", "Container"),
    ("donor2", "Samosa (50 pcs)",       50.0,  35.0, 2.0,  "Fried",   "Room Temp", "Box"),
    ("donor2", "Chole Bhature",         20.0,  29.0, 3.5,  "Cooked",  "Room Temp", "Container"),
    ("donor2", "Pav Bhaji",             22.0,  31.0, 2.0,  "Cooked",  "Room Temp", "Container"),
    ("donor2", "Whole Wheat Bread",     10.0,  22.0, 4.0,  "Baked",   "Room Temp", "Bag"),
    ("donor2", "Pasteurised Milk",      12.0,   4.0, 0.5,  "Dairy",   "Refrigerated", "Carton"),
    ("donor2", "Yogurt Cups",            8.0,   5.0, 1.0,  "Dairy",   "Refrigerated", "Container"),
    ("donor3", "Lemon Rice",            18.0,  24.0, 1.0,  "Cooked",  "Room Temp", "Container"),
    ("donor3", "Fried Rice",            20.0,  26.0, 2.5,  "Cooked",  "Room Temp", "Container"),
    ("donor3", "South Indian Thali",    15.0,  28.0, 1.5,  "Cooked",  "Room Temp", "Tray"),
    ("donor3", "Gulab Jamun",           60.0,  30.0, 3.0,  "Sweet",   "Room Temp", "Container"),
    ("donor3", "Halwa",                 12.0,  29.0, 2.0,  "Sweet",   "Room Temp", "Container"),
    ("donor3", "Masala Dosa",           20.0,  27.0, 1.0,  "Cooked",  "Room Temp", "Wrapped"),
    ("donor3", "Upma",                  16.0,  25.0, 0.5,  "Cooked",  "Room Temp", "Container"),
    ("donor3", "Tomatoes (fresh)",       6.0,  10.0, 2.0,  "Raw",     "Refrigerated", "Bag"),
    ("donor3", "Spinach Bunch",          4.0,   8.0, 3.0,  "Raw",     "Refrigerated", "Bag"),
    ("donor1", "Boiled Eggs (12)",      12.0,   7.0, 2.0,  "Cooked",  "Refrigerated", "Container"),
    ("donor1", "Chicken Curry",         14.0,  29.0, 2.0,  "Cooked",  "Room Temp", "Container"),
    ("donor2", "Fish Fry",              10.0,  32.0, 1.5,  "Fried",   "Room Temp", "Container"),
    ("donor2", "Mixed Pickle",           2.0,  25.0, 8.0,  "Preserved","Room Temp", "Jar"),
    ("donor3", "Carrot Halwa",          10.0,  28.0, 4.0,  "Sweet",   "Room Temp", "Container"),
    ("donor1", "Rajma Chawal",          25.0,  27.0, 1.5,  "Cooked",  "Room Temp", "Container"),
    ("donor2", "Veg Sandwich",          20.0,  23.0, 1.0,  "Cooked",  "Room Temp", "Wrapped"),
    ("donor3", "Mango Lassi",           15.0,   6.0, 2.0,  "Dairy",   "Refrigerated", "Container"),
    ("donor1", "Butter Chicken",        12.0,  30.0, 2.5,  "Cooked",  "Room Temp", "Container"),
    ("donor2", "Naan Bread",            30.0,  25.0, 1.0,  "Baked",   "Room Temp", "Wrapped"),
    ("donor3", "Kheer",                 18.0,  28.0, 3.0,  "Sweet",   "Room Temp", "Container"),
    ("donor1", "Banana Bunch",           8.0,  25.0, 0.5,  "Raw",     "Room Temp", "Loose"),
    ("donor2", "Apple Crates",          10.0,  12.0, 1.0,  "Raw",     "Refrigerated", "Box"),
    ("donor3", "Coconut Chutney",        5.0,  24.0, 2.0,  "Cooked",  "Room Temp", "Container"),
    ("donor1", "Puri Aloo",             18.0,  27.0, 2.0,  "Cooked",  "Room Temp", "Container"),
    ("donor2", "Motichoor Ladoo",       40.0,  26.0, 5.0,  "Sweet",   "Room Temp", "Box"),
]

# First 15 listings will be pre-claimed by NGOs for demo purposes
CLAIM_MAP = {
    0: "ngo1", 1: "ngo1", 2: "ngo1", 3: "ngo2", 4: "ngo2",
    5: "ngo2", 6: "ngo3", 7: "ngo3", 8: "ngo3", 9: "ngo1",
    10: "ngo1", 11: "ngo2", 12: "ngo2", 13: "ngo3", 14: "ngo3",
}


def seed_db():
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # ── Users ────────────────────────────────────────────────────────────────
    for username, password, role, is_verified, is_banned, city in TEST_USERS:
        location_text = f"{city}, Odisha"
        try:
            cur.execute(
                "INSERT INTO users (username, password, role, is_verified, is_banned, location_text) VALUES (?, ?, ?, ?, ?, ?)",
                (username, password, role, is_verified, is_banned, location_text),
            )
            print(f"✅  Added user : {username:10s}  role={role}  city={city}")
        except sqlite3.IntegrityError:
            print(f"⚠️   Skipped (exists): {username}")

    # ── User settings (location) ──────────────────────────────────────────────
    for username, _, _, _, _, city in TEST_USERS:
        lat, lng = SEED_CITY_COORDS.get(city, (20.2961, 85.8245))
        location_text = f"{city}, Odisha"
        try:
            cur.execute(
                """INSERT OR IGNORE INTO user_settings
                   (username, latitude, longitude, radius_km, location_text)
                   VALUES (?, ?, ?, ?, ?)""",
                (username, lat, lng, 25, location_text),
            )
            print(f"   📍 Settings   : {username:10s}  lat={lat}, lng={lng}")
        except Exception as exc:
            print(f"   ⚠️  Skipped settings '{username}': {exc}")

    # ── Food listings ─────────────────────────────────────────────────────────
    # Lat/Lng centred on Bhubaneswar, Odisha
    base_lat, base_lng = 20.2961, 85.8245
    for idx, (donor, name, qty, temp, hours_ago, *_) in enumerate(FOOD_LISTINGS):
        lat = round(base_lat + random.uniform(-0.08, 0.08), 6)
        lng = round(base_lng + random.uniform(-0.08, 0.08), 6)
        is_claimed = 1 if idx in CLAIM_MAP else 0
        claimed_by = CLAIM_MAP.get(idx)
        # safe_hours placeholder — the ML model will recompute on the next predict call
        safe_hours = round(max(0.5, 6.0 - hours_ago + random.uniform(-0.5, 0.5)), 1)
        try:
            cur.execute(
                """INSERT INTO food_listings
                   (donor_name, food_name, qty, temp, hours_ago, safe_hours,
                    donor_latitude, donor_longitude, is_claimed, claimed_by)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (donor, name, qty, temp, hours_ago, safe_hours,
                 lat, lng, is_claimed, claimed_by),
            )
            status = f"claimed by {claimed_by}" if is_claimed else "available"
            print(f"   🍱 {name:35s}  {status}")
        except Exception as exc:
            print(f"   ⚠️  Skipped listing '{name}': {exc}")

    conn.commit()
    conn.close()

    print("\n🎉  Seed complete!")
    print("\n  Test credentials (password = pass123 for all):")
    print("    ADMIN  : admin")
    print("    DONOR  : donor1 / donor2 / donor3")
    print("    NGO    : ngo1   / ngo2   / ngo3")


if __name__ == "__main__":
    seed_db()
