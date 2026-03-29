import os
import pickle
import sqlite3
import json
import math
import secrets
from pathlib import Path
from datetime import datetime, timedelta, timezone

import pandas as pd
from flask import Flask, jsonify, render_template, request, send_from_directory, abort
from sklearn.ensemble import RandomForestRegressor


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "foodsave.db"
MODEL_PATH = BASE_DIR / "food_model_v2.pkl"  # v2: 5-feature model

# Encoding maps for categorical inputs
FOOD_CAT_MAP = {"protein": 0, "dairy": 1, "produce": 2, "grains": 3, "prepared": 4}
STORAGE_MAP = {"frozen": 0, "refrigerated": 1, "ambient": 2}
PACKAGING_MAP = {"sealed": 0, "bulk": 1, "open": 2}

# Odisha cities with approximate centre coordinates
ODISHA_CITIES: dict[str, tuple[float, float]] = {
    "Bhubaneswar": (20.2961, 85.8245),
    "Cuttack":     (20.4625, 85.8830),
    "Puri":        (19.8135, 85.8312),
    "Rourkela":    (22.2604, 84.8536),
    "Sambalpur":   (21.4669, 83.9757),
    "Berhampur":   (19.3149, 84.7941),
    "Balasore":    (21.4924, 86.9194),
    "Bhadrak":     (21.0543, 86.5154),
    "Kendrapara":  (20.4935, 86.4230),
    "Jeypore":     (18.8539, 82.5718),
}
_ODISHA_COORDS = list(ODISHA_CITIES.values())

app = Flask(__name__, template_folder="templates")
app.json.ensure_ascii = False


@app.after_request
def ensure_utf8_response(response):
    ctype = response.headers.get("Content-Type", "")
    if ctype.startswith("application/json") and "charset=" not in ctype:
        response.headers["Content-Type"] = "application/json; charset=utf-8"
    elif ctype.startswith("text/html") and "charset=" not in ctype:
        response.headers["Content-Type"] = "text/html; charset=utf-8"
    return response


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def normalize_username(value: str) -> str:
    return str(value or "").strip().lower()


def get_user(username: str) -> sqlite3.Row | None:
    normalized_username = normalize_username(username)
    if not normalized_username:
        return None

    with get_conn() as conn:
        return conn.execute(
            "SELECT id, username, role, is_verified, is_banned FROM users WHERE username = ?",
            (normalized_username,),
        ).fetchone()


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('DONOR','NGO','ADMIN')),
                is_verified INTEGER NOT NULL DEFAULT 1,
                is_banned INTEGER NOT NULL DEFAULT 0,
                location_text TEXT DEFAULT 'Bhubaneswar, Odisha'
            );

            CREATE TABLE IF NOT EXISTS food_listings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                donor_name TEXT NOT NULL,
                food_name TEXT NOT NULL,
                qty REAL NOT NULL,
                temp REAL NOT NULL,
                hours_ago REAL NOT NULL,
                safe_hours REAL NOT NULL,
                donor_latitude REAL,
                donor_longitude REAL,
                is_claimed INTEGER NOT NULL DEFAULT 0,
                claimed_by TEXT
            );

            CREATE TABLE IF NOT EXISTS pickup_passes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                food_id INTEGER NOT NULL,
                donor_name TEXT NOT NULL,
                claimed_by TEXT NOT NULL,
                pass_code TEXT NOT NULL UNIQUE,
                verify_token TEXT NOT NULL,
                qr_payload TEXT,
                expires_at TEXT NOT NULL,
                is_verified INTEGER NOT NULL DEFAULT 0,
                verified_at TEXT,
                verified_by TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(food_id) REFERENCES food_listings(id)
            );

            CREATE TABLE IF NOT EXISTS user_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                org_name TEXT,
                phone TEXT,
                avatar TEXT,
                timezone TEXT,
                latitude REAL,
                longitude REAL,
                radius_km REAL DEFAULT 15,
                alert_email INTEGER NOT NULL DEFAULT 1,
                alert_sms INTEGER NOT NULL DEFAULT 0,
                alert_critical INTEGER NOT NULL DEFAULT 1,
                risk_threshold INTEGER NOT NULL DEFAULT 2,
                location_text TEXT DEFAULT 'Bhubaneswar, Odisha'
            );

            CREATE TABLE IF NOT EXISTS support_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT,
                message TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS career_applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_name TEXT,
                applicant_email TEXT,
                applicant_name TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_username TEXT,
                target_role TEXT,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'info',
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actor TEXT,
                actor_role TEXT,
                action TEXT NOT NULL,
                entity TEXT,
                entity_id TEXT,
                meta TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS claim_chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                food_id INTEGER NOT NULL,
                donor_name TEXT NOT NULL,
                ngo_name TEXT NOT NULL,
                sender TEXT NOT NULL,
                message TEXT NOT NULL,
                client_nonce TEXT,
                delivered_at TEXT,
                read_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(food_id) REFERENCES food_listings(id)
            );
            """
        )
        conn.commit()

    # Migrate old users table constraint (DONOR/NGO only) to include ADMIN.
    with get_conn() as conn:
        table_sql = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'"
        ).fetchone()
        sql_text = (table_sql["sql"] if table_sql else "") or ""
        legacy_constraint = "CHECK(role IN ('DONOR','NGO'))"
        if legacy_constraint in sql_text:
            conn.executescript(
                """
                ALTER TABLE users RENAME TO users_old;

                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('DONOR','NGO','ADMIN')),
                    is_verified INTEGER NOT NULL DEFAULT 1,
                    is_banned INTEGER NOT NULL DEFAULT 0
                );

                INSERT INTO users (id, username, password, role, is_verified, is_banned)
                SELECT id, username, password, role, 1, 0
                FROM users_old;

                DROP TABLE users_old;
                """
            )
            conn.commit()

    # Ensure new user status columns exist for old databases.
    with get_conn() as conn:
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
        if "is_verified" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 1")
        if "is_banned" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0")
        conn.commit()

    # Migrate food_listings to add category / storage / packaging columns.
    with get_conn() as conn:
        fl_cols = {r["name"] for r in conn.execute("PRAGMA table_info(food_listings)").fetchall()}
        if "food_category" not in fl_cols:
            conn.execute("ALTER TABLE food_listings ADD COLUMN food_category TEXT DEFAULT 'prepared'")
        if "storage_conditions" not in fl_cols:
            conn.execute("ALTER TABLE food_listings ADD COLUMN storage_conditions TEXT DEFAULT 'ambient'")
        if "packaging" not in fl_cols:
            conn.execute("ALTER TABLE food_listings ADD COLUMN packaging TEXT DEFAULT 'open'")
        if "donor_latitude" not in fl_cols:
            conn.execute("ALTER TABLE food_listings ADD COLUMN donor_latitude REAL")
        if "donor_longitude" not in fl_cols:
            conn.execute("ALTER TABLE food_listings ADD COLUMN donor_longitude REAL")

        pp_cols = {r["name"] for r in conn.execute("PRAGMA table_info(pickup_passes)").fetchall()}
        if "is_active" not in pp_cols and pp_cols:
            conn.execute("ALTER TABLE pickup_passes ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
        conn.commit()

    with get_conn() as conn:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_food_claimed ON food_listings(is_claimed)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_food_claimed_by ON food_listings(claimed_by)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pass_food_active ON pickup_passes(food_id, is_active)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pass_code ON pickup_passes(pass_code)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token)")
        chat_cols = {r["name"] for r in conn.execute("PRAGMA table_info(claim_chats)").fetchall()}
        if "client_nonce" not in chat_cols:
            conn.execute("ALTER TABLE claim_chats ADD COLUMN client_nonce TEXT")
        if "delivered_at" not in chat_cols:
            conn.execute("ALTER TABLE claim_chats ADD COLUMN delivered_at TEXT")
        if "read_at" not in chat_cols:
            conn.execute("ALTER TABLE claim_chats ADD COLUMN read_at TEXT")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_claim_chat_food_created ON claim_chats(food_id, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_claim_chat_sender ON claim_chats(sender)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_claim_chat_read_state ON claim_chats(food_id, sender, read_at)")
        conn.commit()

    # ── location_text on users ─────────────────────────────────────────────
    import random as _rand
    with get_conn() as conn:
        user_cols = {r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
        if "location_text" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN location_text TEXT DEFAULT 'Bhubaneswar, Odisha'")
        conn.execute("UPDATE users SET location_text = 'Bhubaneswar, Odisha' WHERE location_text IS NULL")
        conn.commit()

    # ── location_text on user_settings ────────────────────────────────────
    with get_conn() as conn:
        us_cols = {r["name"] for r in conn.execute("PRAGMA table_info(user_settings)").fetchall()}
        if us_cols and "location_text" not in us_cols:
            conn.execute("ALTER TABLE user_settings ADD COLUMN location_text TEXT DEFAULT 'Bhubaneswar, Odisha'")
        conn.commit()

    # ── seed Odisha coords for all users without proper settings ──────────
    with get_conn() as conn:
        all_users = conn.execute("SELECT username FROM users").fetchall()
        existing_settings = {r["username"] for r in conn.execute("SELECT username FROM user_settings").fetchall()}
        for i, row in enumerate(all_users):
            uname = row["username"]
            base_lat, base_lng = _ODISHA_COORDS[i % len(_ODISHA_COORDS)]
            lat = round(base_lat + _rand.uniform(-0.06, 0.06), 6)
            lng = round(base_lng + _rand.uniform(-0.06, 0.06), 6)
            if uname not in existing_settings:
                conn.execute(
                    "INSERT OR IGNORE INTO user_settings (username, latitude, longitude, radius_km, location_text) VALUES (?, ?, ?, 15, 'Bhubaneswar, Odisha')",
                    (uname, lat, lng),
                )
        conn.execute(
            "UPDATE user_settings SET latitude = 20.2961, longitude = 85.8245 WHERE latitude IS NULL OR longitude IS NULL"
        )
        conn.commit()

    # ── move food_listings from BLR coords (lat 10-15) -> Odisha ──────────
    with get_conn() as conn:
        blr_rows = conn.execute(
            "SELECT id FROM food_listings WHERE (donor_latitude BETWEEN 10 AND 15) OR donor_latitude IS NULL"
        ).fetchall()
        for listing in blr_rows:
            base_lat, base_lng = _ODISHA_COORDS[listing["id"] % len(_ODISHA_COORDS)]
            new_lat = round(base_lat + _rand.uniform(-0.12, 0.12), 6)
            new_lng = round(base_lng + _rand.uniform(-0.12, 0.12), 6)
            conn.execute(
                "UPDATE food_listings SET donor_latitude = ?, donor_longitude = ? WHERE id = ?",
                (new_lat, new_lng, listing["id"]),
            )
        conn.commit()


def load_or_train_model() -> RandomForestRegressor:
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            return pickle.load(f)

    # 5-feature synthetic training set
    # Columns: temp, hours_ago, food_cat_enc, storage_enc, packaging_enc -> safe_left
    # food_cat:  protein=0, dairy=1, produce=2, grains=3, prepared=4
    # storage:   frozen=0,  refrigerated=1, ambient=2
    # packaging: sealed=0,  bulk=1, open=2
    records = [
        # temp  h_ago  cat  stor  pkg  safe
        (-5,    1,     0,   0,    0,   24),   # frozen sealed protein
        (-5,    6,     0,   0,    0,   24),
        (-5,   12,     0,   0,    0,   22),
        (-5,    2,     1,   0,    0,   24),   # frozen sealed dairy
        (-5,    2,     2,   0,    0,   24),   # frozen sealed produce
        ( 0,    4,     3,   0,    0,   24),   # frozen sealed grains
        ( 0,    4,     4,   0,    0,   20),   # frozen sealed prepared
        ( 2,    6,     0,   0,    1,   18),   # frozen bulk protein
        ( 4,    1,     0,   1,    0,   20),   # fridge sealed protein 1h
        ( 4,    4,     0,   1,    0,   16),
        ( 4,    8,     0,   1,    0,   10),
        ( 4,   12,     0,   1,    0,    5),
        ( 4,   18,     0,   1,    0,    2),
        ( 4,    2,     1,   1,    0,   22),   # fridge sealed dairy
        ( 4,    8,     1,   1,    0,   16),
        ( 4,    4,     2,   1,    0,   20),   # fridge sealed produce
        ( 4,   10,     2,   1,    0,   14),
        ( 4,    2,     3,   1,    0,   22),   # fridge sealed grains
        ( 4,    2,     4,   1,    0,   14),   # fridge sealed prepared
        ( 6,    6,     4,   1,    0,    8),
        ( 4,    1,     4,   1,    2,    8),   # fridge open prepared 1h
        ( 4,    4,     4,   1,    2,    5),
        ( 4,    8,     4,   1,    2,    2),
        ( 6,    2,     0,   1,    2,    8),   # fridge open protein
        ( 8,    4,     1,   1,    2,    4),   # warm fridge open dairy
        (15,    1,     3,   2,    0,   16),   # cool ambient sealed grains
        (15,    4,     3,   2,    0,   12),
        (20,    1,     2,   2,    0,   12),   # cool ambient sealed produce
        (20,    4,     2,   2,    0,    7),
        (18,    2,     4,   2,    0,    8),   # cool ambient sealed prepared
        (18,    6,     4,   2,    0,    3),
        (15,    2,     0,   2,    0,   10),   # cool ambient sealed protein
        (25,    1,     4,   2,    2,    4),   # warm open prepared 1h
        (25,    2,     4,   2,    2,    2),
        (25,    3,     4,   2,    2,    0.5),
        (25,    4,     4,   2,    2,    0),
        (30,    1,     0,   2,    2,    3),   # hot open protein
        (30,    2,     0,   2,    2,    1),
        (30,    3,     0,   2,    2,    0),
        (30,    1,     1,   2,    1,    3),   # hot bulk dairy
        (35,    1,     0,   2,    2,    2),
        (35,    2,     0,   2,    2,    0),
        (35,    1,     4,   2,    2,    1.5),
        (35,    2,     4,   2,    2,    0),
        (40,    1,     4,   2,    2,    0.5),
        (40,    2,     4,   2,    2,    0),
        (25,    1,     3,   2,    0,   12),   # warm sealed grains
        (35,    2,     3,   2,    0,    5),
        (20,    6,     0,   2,    1,    5),   # ambient bulk protein
        (60,    0.5,   4,   2,    2,    3),   # just cooked prepared
        (70,    0.5,   0,   2,    2,    2),   # just cooked protein
        (80,    0.5,   4,   2,    2,    2),
        (60,    2,     4,   2,    2,    1),
        (100,   0.25,  4,   2,    2,    3),   # boiling
    ]
    df = pd.DataFrame(records, columns=["temp", "hours_ago", "food_cat", "storage", "packaging", "safe_left"])

    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(df[["temp", "hours_ago", "food_cat", "storage", "packaging"]], df["safe_left"])

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

    return model


model: RandomForestRegressor | None = None
init_db()


def get_model() -> RandomForestRegressor:
    global model
    if model is None:
        model = load_or_train_model()
    return model


def predict_safe_hours(
    temp: float,
    hours_ago: float,
    food_category: str = "prepared",
    storage: str = "ambient",
    packaging: str = "open",
) -> float:
    model_instance = get_model()
    food_cat_enc = FOOD_CAT_MAP.get(food_category, 4)
    storage_enc = STORAGE_MAP.get(storage, 2)
    packaging_enc = PACKAGING_MAP.get(packaging, 2)
    safe_hours = float(
        model_instance.predict(
            pd.DataFrame(
                [[temp, hours_ago, food_cat_enc, storage_enc, packaging_enc]],
                columns=["temp", "hours_ago", "food_cat", "storage", "packaging"],
            )
        )[0]
    )
    return round(max(0.0, safe_hours), 1)


def get_prediction_metadata(
    safe_hours: float,
    temp: float,
    hours_ago: float,
    storage: str,
    packaging: str,
) -> tuple[float, float]:
    # Heuristic confidence/priority for consistent API surfacing in prototype mode.
    storage_penalty = {"frozen": 0.0, "refrigerated": 4.0, "ambient": 9.0}.get(storage, 8.0)
    packaging_penalty = {"sealed": 0.0, "bulk": 4.0, "open": 7.0}.get(packaging, 6.0)
    temp_penalty = min(30.0, max(0.0, (temp - 4.0) * 0.8))
    age_penalty = min(28.0, max(0.0, (hours_ago - 2.0) * 1.4))
    low_safe_penalty = 18.0 if safe_hours <= 2 else 10.0 if safe_hours <= 5 else 0.0

    confidence = 100.0 - (storage_penalty + packaging_penalty + temp_penalty + age_penalty + low_safe_penalty)
    confidence = round(max(30.0, min(99.0, confidence)), 1)

    urgency_component = max(0.0, 12.0 - safe_hours) * 5.2
    thermal_component = max(0.0, temp - 4.0) * 1.1
    exposure_component = max(0.0, hours_ago) * 1.4
    priority = round(min(100.0, urgency_component + thermal_component + exposure_component + packaging_penalty), 1)

    return confidence, priority


def get_user_geo(username: str) -> tuple[float | None, float | None, float | None]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT latitude, longitude, radius_km FROM user_settings WHERE username = ?",
            (username.lower(),),
        ).fetchone()
    if not row:
        return None, None, None

    try:
        lat = float(row["latitude"]) if row["latitude"] is not None else None
        lng = float(row["longitude"]) if row["longitude"] is not None else None
        radius = float(row["radius_km"]) if row["radius_km"] is not None else None
    except (TypeError, ValueError):
        return None, None, None
    return lat, lng, radius


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * (math.sin(d_lon / 2.0) ** 2)
    )
    return earth_radius_km * (2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a)))


def get_or_create_pickup_pass(food_id: int, donor_name: str, claimed_by: str, safe_hours: float) -> sqlite3.Row:
    with get_conn() as conn:
        existing = conn.execute(
            """
            SELECT id, food_id, donor_name, claimed_by, pass_code, verify_token, qr_payload,
                   expires_at, is_verified, verified_at, verified_by, is_active, created_at
            FROM pickup_passes
            WHERE food_id = ? AND is_active = 1
            ORDER BY id DESC
            LIMIT 1
            """,
            (food_id,),
        ).fetchone()
        if existing:
            return existing

        pass_code = f"PASS-{food_id}-{secrets.token_hex(3).upper()}"
        verify_token = secrets.token_urlsafe(16)
        validity_hours = max(2.0, min(24.0, safe_hours + 2.0))
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=validity_hours)).isoformat()
        qr_payload = json.dumps({"pass_code": pass_code, "food_id": food_id, "token": verify_token})

        cur = conn.execute(
            """
            INSERT INTO pickup_passes (food_id, donor_name, claimed_by, pass_code, verify_token, qr_payload, expires_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (food_id, donor_name, claimed_by, pass_code, verify_token, qr_payload, expires_at),
        )
        pass_id = cur.lastrowid
        conn.commit()

        created = conn.execute(
            """
            SELECT id, food_id, donor_name, claimed_by, pass_code, verify_token, qr_payload,
                   expires_at, is_verified, verified_at, verified_by, is_active, created_at
            FROM pickup_passes
            WHERE id = ?
            """,
            (pass_id,),
        ).fetchone()

    return created


def create_notification(
    title: str,
    message: str,
    *,
    target_username: str | None = None,
    target_role: str | None = None,
    notif_type: str = "info",
) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO notifications (target_username, target_role, title, message, type, is_read)
            VALUES (?, ?, ?, ?, ?, 0)
            """,
            (target_username, target_role, title, message, notif_type),
        )
        conn.commit()


def add_audit_log(
    action: str,
    *,
    actor: str | None = None,
    actor_role: str | None = None,
    entity: str | None = None,
    entity_id: str | None = None,
    meta: dict | None = None,
) -> None:
    payload = json.dumps(meta or {})
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO audit_logs (actor, actor_role, action, entity, entity_id, meta)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (actor, actor_role, action, entity, entity_id, payload),
        )
        conn.commit()


def serialize_claim_chat_message(row: sqlite3.Row, viewer: str | None = None) -> dict:
    sender = normalize_username(row["sender"])
    delivered_at = row["delivered_at"] if "delivered_at" in row.keys() else None
    read_at = row["read_at"] if "read_at" in row.keys() else None
    message_state = "received"
    if viewer and sender == normalize_username(viewer):
        if read_at:
            message_state = "read"
        elif delivered_at:
            message_state = "delivered"
        else:
            message_state = "sent"

    return {
        "id": row["id"],
        "food_id": row["food_id"],
        "donor_name": row["donor_name"],
        "ngo_name": row["ngo_name"],
        "sender": sender,
        "message": row["message"],
        "client_nonce": row["client_nonce"] if "client_nonce" in row.keys() else None,
        "delivered_at": delivered_at,
        "read_at": read_at,
        "status": message_state,
        "created_at": row["created_at"],
    }


def get_claim_chat_context(conn: sqlite3.Connection, food_id: int, username: str):
    listing = conn.execute(
        "SELECT id, donor_name, claimed_by, food_name, qty, safe_hours, is_claimed FROM food_listings WHERE id = ?",
        (food_id,),
    ).fetchone()
    if not listing:
        return None, jsonify({"status": "error", "message": "food listing not found"}), 404
    if int(listing["is_claimed"] or 0) != 1 or not listing["claimed_by"]:
        return None, jsonify({"status": "error", "message": "chat is available only after claim"}), 409

    donor_name = normalize_username(listing["donor_name"])
    ngo_name = normalize_username(listing["claimed_by"])
    if username not in {donor_name, ngo_name}:
        return None, jsonify({"status": "error", "message": "not allowed"}), 403

    counterpart = ngo_name if username == donor_name else donor_name
    return {
        "listing": listing,
        "donor_name": donor_name,
        "ngo_name": ngo_name,
        "counterpart": counterpart,
    }, None, None


@app.route("/v2/", defaults={"vpath": ""})
@app.route("/v2/<path:vpath>")
def frontendv2(vpath: str):
    """Backward-compatible route that now serves the unified index template."""
    if vpath.startswith("api/"):
        return jsonify({"status": "error", "message": "not found"}), 404
    return render_template("index.html")


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def home(path: str):
    if path.startswith("api/"):
        return jsonify({"status": "error", "message": "not found"}), 404
    return render_template("index.html")


@app.route("/api/cities", methods=["GET"])
def api_cities():
    """Return supported Odisha cities with their coordinates for registration."""
    return jsonify({
        "status": "success",
        "cities": [
            {"name": name, "lat": lat, "lng": lng}
            for name, (lat, lng) in ODISHA_CITIES.items()
        ],
    })


@app.route("/api/login", methods=["POST"])
@app.route("/api/auth/login", methods=["POST"])
def api_login():
    payload = request.get_json(silent=True) or {}
    username = normalize_username(payload.get("username", ""))
    password = str(payload.get("password", "")).strip()

    if not username or not password:
        return (
            jsonify({"status": "error", "message": "username and password are required"}),
            400,
        )

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, password, role, is_verified, is_banned FROM users WHERE username = ?",
            (username,),
        ).fetchone()

    if not row or row["password"] != password:
        add_audit_log("login_failed", actor=username, entity="user", entity_id=username)
        return jsonify({"status": "error", "message": "invalid credentials"}), 401

    # Prototype mode: keep login friction low and do not block by verification/ban flags.

    add_audit_log("login_success", actor=row["username"], actor_role=row["role"], entity="user", entity_id=str(row["id"]))

    return jsonify(
        {
            "status": "success",
            "user": {
                "id": row["id"],
                "username": row["username"],
                "role": row["role"],
                "is_verified": bool(row["is_verified"]),
                "is_banned": bool(row["is_banned"]),
            },
        }
    )


@app.route("/api/register", methods=["POST"])
@app.route("/api/auth/register", methods=["POST"])
def api_register():
    payload = request.get_json(silent=True) or {}
    username = normalize_username(payload.get("username", ""))
    password = str(payload.get("password", "")).strip()
    role = str(payload.get("role", "DONOR")).strip().upper()
    city = str(payload.get("city", "")).strip()
    location_text = str(payload.get("location_text", "")).strip()

    if not username or not password:
        return jsonify({"status": "error", "message": "username and password are required"}), 400

    if role not in {"DONOR", "NGO", "ADMIN"}:
        role = "DONOR"

    if city not in ODISHA_CITIES:
        city = "Bhubaneswar"
    if not location_text:
        location_text = f"{city}, Odisha"

    try:
        with get_conn() as conn:
            cur = conn.execute(
                "INSERT INTO users (username, password, role, is_verified, is_banned, location_text) VALUES (?, ?, ?, 1, 0, ?)",
                (username, password, role, location_text),
            )
            conn.commit()
            user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({"status": "error", "message": "username already exists"}), 409

    # Create user_settings with the chosen city's coordinates
    import random as _rand
    base_lat, base_lng = ODISHA_CITIES[city]
    reg_lat = round(base_lat + _rand.uniform(-0.03, 0.03), 6)
    reg_lng = round(base_lng + _rand.uniform(-0.03, 0.03), 6)
    with get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO user_settings (username, latitude, longitude, radius_km, location_text) VALUES (?, ?, ?, 15, ?)",
            (username, reg_lat, reg_lng, location_text),
        )
        conn.commit()

    add_audit_log("user_registered", actor=username, actor_role=role, entity="user", entity_id=str(user_id))
    create_notification(
        "New user registered",
        f"{username} joined as {role} from {location_text}",
        target_role="ADMIN",
        notif_type="info",
    )

    return jsonify(
        {
            "status": "success",
            "message": "account created",
            "user": {
                "id": user_id,
                "username": username,
                "role": role,
                "is_verified": True,
                "is_banned": False,
                "location_text": location_text,
            },
        }
    )


@app.route("/api/predict_and_add", methods=["POST"])
def api_predict_and_add():
    payload = request.get_json(silent=True) or {}

    donor_name = normalize_username(payload.get("donor_name", ""))
    food_name = str(payload.get("food_name", "")).strip()
    qty_raw = payload.get("qty", 0)
    temp_raw = payload.get("temp", 25)
    hours_raw = payload.get("hours_ago", 1)
    food_category = str(payload.get("food_category", "prepared")).strip().lower()
    storage = str(payload.get("storage", "ambient")).strip().lower()
    packaging = str(payload.get("packaging", "open")).strip().lower()

    if not donor_name or not food_name:
        return jsonify({"status": "error", "message": "donor_name and food_name are required"}), 400

    donor_user = get_user(donor_name)
    if not donor_user:
        return jsonify({"status": "error", "message": "donor account not found"}), 404
    if donor_user["role"] != "DONOR":
        return jsonify({"status": "error", "message": "only donor accounts can create listings"}), 403
    if int(donor_user["is_banned"] or 0) == 1:
        return jsonify({"status": "error", "message": "donor account is banned"}), 403
    if int(donor_user["is_verified"] or 0) == 0:
        return jsonify({"status": "error", "message": "donor account is awaiting verification"}), 403

    try:
        qty = float(qty_raw)
        temp = float(temp_raw)
        hours_ago = float(hours_raw)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "qty, temp, and hours_ago must be numeric"}), 400

    if qty <= 0:
        return jsonify({"status": "error", "message": "qty must be greater than zero"}), 400
    if hours_ago < 0:
        return jsonify({"status": "error", "message": "hours_ago cannot be negative"}), 400

    safe_hours = predict_safe_hours(temp, hours_ago, food_category, storage, packaging)
    confidence_score, priority_score = get_prediction_metadata(safe_hours, temp, hours_ago, storage, packaging)
    donor_lat, donor_lng, _ = get_user_geo(donor_name)

    if safe_hours <= 0:
        return jsonify(
            {
                "status": "unsafe",
                "message": "Food is not safe for donation.",
                "safe_hours": safe_hours,
                "confidence_score": confidence_score,
                "priority_score": priority_score,
                "is_safe": False,
            }
        )

    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO food_listings (
                donor_name, food_name, qty, temp, hours_ago, safe_hours,
                food_category, storage_conditions, packaging, donor_latitude, donor_longitude,
                is_claimed, claimed_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
            """,
            (
                donor_name,
                food_name,
                qty,
                temp,
                hours_ago,
                safe_hours,
                food_category,
                storage,
                packaging,
                donor_lat,
                donor_lng,
            ),
        )
        listing_id = cur.lastrowid
        conn.commit()

    add_audit_log(
        "listing_created",
        actor=donor_name,
        actor_role="DONOR",
        entity="food_listing",
        entity_id=str(listing_id),
        meta={"food_name": food_name, "safe_hours": safe_hours},
    )
    create_notification(
        "New food listing available",
        f"{food_name} by {donor_name} is available for claim",
        target_role="NGO",
        notif_type="success",
    )

    return jsonify(
        {
            "status": "success",
            "message": "Food listing created.",
            "listing_id": listing_id,
            "safe_hours": safe_hours,
            "confidence_score": confidence_score,
            "priority_score": priority_score,
            "is_safe": True,
        }
    )


@app.route("/api/predict", methods=["POST"])
@app.route("/api/ai/predict", methods=["POST"])
def api_predict():
    payload = request.get_json(silent=True) or {}
    temp_raw = payload.get("temp")
    hours_raw = payload.get("hours_ago")

    if temp_raw is None or hours_raw is None:
        return jsonify({"status": "error", "message": "temp and hours_ago are required"}), 400

    try:
        temp = float(temp_raw)
        hours_ago = float(hours_raw)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "temp and hours_ago must be numeric"}), 400

    food_category = str(payload.get("food_category", "prepared")).strip().lower()
    storage = str(payload.get("storage", "ambient")).strip().lower()
    packaging = str(payload.get("packaging", "open")).strip().lower()

    safe_hours = predict_safe_hours(temp, hours_ago, food_category, storage, packaging)
    confidence_score, priority_score = get_prediction_metadata(safe_hours, temp, hours_ago, storage, packaging)
    risk = "HIGH" if safe_hours <= 3 else "MEDIUM" if safe_hours <= 8 else "LOW"
    return jsonify(
        {
            "status": "success",
            "safe_hours": safe_hours,
            "risk": risk,
            "confidence_score": confidence_score,
            "priority_score": priority_score,
            "is_safe": safe_hours > 0,
        }
    )


@app.route("/api/food/add", methods=["POST"])
@app.route("/api/food", methods=["POST"])
def api_food_add():
    payload = request.get_json(silent=True) or {}

    donor_name = normalize_username(payload.get("donor_name", ""))
    food_name = str(payload.get("food_name", "")).strip()
    qty_raw = payload.get("qty", 0)
    temp_raw = payload.get("temp", 25)
    hours_raw = payload.get("hours_ago", 1)
    food_category = str(payload.get("food_category", "prepared")).strip().lower()
    storage = str(payload.get("storage", "ambient")).strip().lower()
    packaging = str(payload.get("packaging", "open")).strip().lower()

    if not donor_name or not food_name:
        return jsonify({"status": "error", "message": "donor_name and food_name are required"}), 400

    donor_user = get_user(donor_name)
    if not donor_user:
        return jsonify({"status": "error", "message": "donor account not found"}), 404
    if donor_user["role"] != "DONOR":
        return jsonify({"status": "error", "message": "only donor accounts can create listings"}), 403
    if int(donor_user["is_banned"] or 0) == 1:
        return jsonify({"status": "error", "message": "donor account is banned"}), 403
    if int(donor_user["is_verified"] or 0) == 0:
        return jsonify({"status": "error", "message": "donor account is awaiting verification"}), 403

    try:
        qty = float(qty_raw)
        temp = float(temp_raw)
        hours_ago = float(hours_raw)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "qty, temp, and hours_ago must be numeric"}), 400

    if qty <= 0:
        return jsonify({"status": "error", "message": "qty must be greater than zero"}), 400
    if hours_ago < 0:
        return jsonify({"status": "error", "message": "hours_ago cannot be negative"}), 400

    safe_hours = predict_safe_hours(temp, hours_ago, food_category, storage, packaging)
    confidence_score, priority_score = get_prediction_metadata(safe_hours, temp, hours_ago, storage, packaging)
    donor_lat, donor_lng, _ = get_user_geo(donor_name)
    if safe_hours <= 0:
        return jsonify(
            {
                "status": "unsafe",
                "message": "Food is not safe for donation.",
                "safe_hours": safe_hours,
                "confidence_score": confidence_score,
                "priority_score": priority_score,
                "is_safe": False,
            }
        )

    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO food_listings (
                donor_name, food_name, qty, temp, hours_ago, safe_hours,
                food_category, storage_conditions, packaging, donor_latitude, donor_longitude,
                is_claimed, claimed_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
            """,
            (
                donor_name,
                food_name,
                qty,
                temp,
                hours_ago,
                safe_hours,
                food_category,
                storage,
                packaging,
                donor_lat,
                donor_lng,
            ),
        )
        listing_id = cur.lastrowid
        conn.commit()

    add_audit_log(
        "listing_created",
        actor=donor_name,
        actor_role="DONOR",
        entity="food_listing",
        entity_id=str(listing_id),
        meta={"food_name": food_name, "safe_hours": safe_hours},
    )
    create_notification(
        "New food listing available",
        f"{food_name} by {donor_name} is available for claim",
        target_role="NGO",
        notif_type="success",
    )

    return jsonify(
        {
            "status": "success",
            "message": "Food listing created.",
            "listing_id": listing_id,
            "safe_hours": safe_hours,
            "confidence_score": confidence_score,
            "priority_score": priority_score,
            "is_safe": True,
        }
    )


@app.route("/api/food", methods=["GET"])
def api_food():
    with get_conn() as conn:
        rows = conn.execute(
            """
                 SELECT id, donor_name, food_name, qty, temp, hours_ago, safe_hours,
                     food_category, storage_conditions, packaging, donor_latitude, donor_longitude,
                     is_claimed, claimed_by
            FROM food_listings
            WHERE is_claimed = 0
            ORDER BY id DESC
            """
        ).fetchall()

    listings = [
        {
            "id": row["id"],
            "donor_name": row["donor_name"],
            "food_name": row["food_name"],
            "qty": row["qty"],
            "temp": row["temp"],
            "hours_ago": row["hours_ago"],
            "safe_hours": row["safe_hours"],
            "food_category": row["food_category"],
            "storage_conditions": row["storage_conditions"],
            "packaging": row["packaging"],
            "donor_latitude": row["donor_latitude"],
            "donor_longitude": row["donor_longitude"],
            "is_claimed": bool(row["is_claimed"]),
            "claimed_by": row["claimed_by"],
        }
        for row in rows
    ]

    return jsonify({"status": "success", "food": listings})


@app.route("/api/food/all", methods=["GET"])
def api_food_all():
    q = str(request.args.get("q", "")).strip().lower()
    donor_name = str(request.args.get("donor_name", "")).strip().lower()
    claimed_by = str(request.args.get("claimed_by", "")).strip().lower()
    is_claimed_raw = request.args.get("is_claimed")
    min_safe_raw = request.args.get("min_safe_hours")
    max_safe_raw = request.args.get("max_safe_hours")
    ngo_username = str(request.args.get("ngo_username", "")).strip().lower()

    where = []
    params: list = []

    if q:
        where.append("LOWER(fl.food_name) LIKE ?")
        params.append(f"%{q}%")
    if donor_name:
        where.append("LOWER(fl.donor_name) = ?")
        params.append(donor_name)
    if claimed_by:
        where.append("LOWER(COALESCE(fl.claimed_by, '')) = ?")
        params.append(claimed_by)
    if is_claimed_raw in {"0", "1"}:
        where.append("fl.is_claimed = ?")
        params.append(int(is_claimed_raw))
    if min_safe_raw is not None:
        try:
            where.append("fl.safe_hours >= ?")
            params.append(float(min_safe_raw))
        except ValueError:
            pass
    if max_safe_raw is not None:
        try:
            where.append("fl.safe_hours <= ?")
            params.append(float(max_safe_raw))
        except ValueError:
            pass

    where_clause = f"WHERE {' AND '.join(where)}" if where else ""

    with get_conn() as conn:
        rows = conn.execute(
            f"""
                 SELECT fl.id, fl.donor_name, fl.food_name, fl.qty, fl.temp, fl.hours_ago, fl.safe_hours,
                     fl.food_category, fl.storage_conditions, fl.packaging,
                     fl.donor_latitude, fl.donor_longitude,
                     fl.is_claimed, fl.claimed_by,
                     pp.pass_code, pp.expires_at, pp.is_verified, pp.verified_at, pp.verified_by,
                     COALESCE(u.location_text, us.location_text, 'Odisha') AS donor_location_text
                 FROM food_listings fl
                 LEFT JOIN users u ON LOWER(fl.donor_name) = u.username
                 LEFT JOIN user_settings us ON LOWER(fl.donor_name) = us.username
            LEFT JOIN pickup_passes pp
              ON fl.id = pp.food_id AND pp.is_active = 1
            {where_clause}
            ORDER BY fl.id DESC
            """,
            params,
        ).fetchall()

    ngo_lat, ngo_lng, ngo_radius = (None, None, None)
    if ngo_username:
        ngo_lat, ngo_lng, ngo_radius = get_user_geo(ngo_username)

    listings = []
    for row in rows:
        distance_km = None
        donor_lat = row["donor_latitude"]
        donor_lng = row["donor_longitude"]
        if ngo_lat is not None and ngo_lng is not None and donor_lat is not None and donor_lng is not None:
            try:
                distance_km = round(haversine_km(float(ngo_lat), float(ngo_lng), float(donor_lat), float(donor_lng)), 2)
            except (TypeError, ValueError):
                distance_km = None

        confidence_score, priority_score = get_prediction_metadata(
            float(row["safe_hours"] or 0),
            float(row["temp"] or 0),
            float(row["hours_ago"] or 0),
            str(row["storage_conditions"] or "ambient"),
            str(row["packaging"] or "open"),
        )

        if distance_km is not None and not bool(row["is_claimed"]):
            proximity_bonus = max(0.0, 20.0 - min(20.0, distance_km))
            priority_score = round(min(100.0, priority_score + proximity_bonus), 1)

        within_radius = None
        if distance_km is not None and ngo_radius is not None:
            within_radius = distance_km <= ngo_radius

        listings.append(
            {
                "id": row["id"],
                "donor_name": row["donor_name"],
                "food_name": row["food_name"],
                "qty": row["qty"],
                "temp": row["temp"],
                "hours_ago": row["hours_ago"],
                "safe_hours": row["safe_hours"],
                "food_category": row["food_category"],
                "storage_conditions": row["storage_conditions"],
                "packaging": row["packaging"],
                "donor_latitude": donor_lat,
                "donor_longitude": donor_lng,
                "distance_km": distance_km,
                "within_ngo_radius": within_radius,
                "confidence_score": confidence_score,
                "priority_score": priority_score,
                "is_claimed": bool(row["is_claimed"]),
                "claimed_by": row["claimed_by"],
                "donor_location_text": row["donor_location_text"],
                "pickup_pass": {
                    "pass_code": row["pass_code"],
                    "expires_at": row["expires_at"],
                    "is_verified": bool(row["is_verified"]) if row["is_verified"] is not None else False,
                    "verified_at": row["verified_at"],
                    "verified_by": row["verified_by"],
                }
                if row["pass_code"]
                else None,
            }
        )

    if ngo_radius is not None:
        in_radius = [item for item in listings if item["within_ngo_radius"] is True or item["within_ngo_radius"] is None]
        out_radius = [item for item in listings if item["within_ngo_radius"] is False]
        listings = in_radius + out_radius

    listings.sort(
        key=lambda item: (
            item["is_claimed"],
            -float(item["priority_score"] or 0),
            float(item["distance_km"] if item["distance_km"] is not None else 1e9),
            -int(item["id"]),
        )
    )

    return jsonify({
        "status": "success",
        "food": listings,
        "matching": {
            "ngo_username": ngo_username or None,
            "ngo_latitude": ngo_lat,
            "ngo_longitude": ngo_lng,
            "ngo_radius_km": ngo_radius,
        },
    })


@app.route("/api/claim", methods=["POST"])
@app.route("/api/food/<int:food_id>/claim", methods=["POST"])
def api_claim(food_id: int | None = None):
    payload = request.get_json(silent=True) or {}

    food_id_raw = food_id if food_id is not None else payload.get("food_id")
    claimed_by = normalize_username(payload.get("claimed_by", ""))

    if food_id_raw is None or not claimed_by:
        return jsonify({"status": "error", "message": "food_id and claimed_by are required"}), 400

    try:
        food_id = int(food_id_raw)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "food_id must be an integer"}), 400

    claimant = get_user(claimed_by)
    if not claimant:
        return jsonify({"status": "error", "message": "claiming account not found"}), 404
    if claimant["role"] != "NGO":
        return jsonify({"status": "error", "message": "only NGO accounts can claim food"}), 403
    if int(claimant["is_banned"] or 0) == 1:
        return jsonify({"status": "error", "message": "claiming account is banned"}), 403
    if int(claimant["is_verified"] or 0) == 0:
        return jsonify({"status": "error", "message": "claiming account is awaiting verification"}), 403

    with get_conn() as conn:
        target = conn.execute(
            "SELECT id, donor_name, food_name, safe_hours, is_claimed FROM food_listings WHERE id = ?",
            (food_id,),
        ).fetchone()

        if not target:
            return jsonify({"status": "error", "message": "food listing not found"}), 404

        if int(target["is_claimed"]) == 1:
            return jsonify({"status": "error", "message": "food already claimed"}), 409

        conn.execute(
            "UPDATE food_listings SET is_claimed = 1, claimed_by = ? WHERE id = ?",
            (claimed_by, food_id),
        )
        conn.commit()

    pickup_pass = get_or_create_pickup_pass(
        food_id=food_id,
        donor_name=target["donor_name"],
        claimed_by=claimed_by,
        safe_hours=float(target["safe_hours"] or 0),
    )

    add_audit_log(
        "listing_claimed",
        actor=claimed_by,
        actor_role="NGO",
        entity="food_listing",
        entity_id=str(food_id),
        meta={"donor_name": target["donor_name"], "food_name": target["food_name"]},
    )
    create_notification(
        "Your listing was claimed",
        f"{target['food_name']} was claimed by {claimed_by}",
        target_username=target["donor_name"],
        notif_type="success",
    )
    create_notification(
        "Pickup pass generated",
        f"Pass {pickup_pass['pass_code']} created for listing #{food_id}",
        target_username=claimed_by,
        notif_type="info",
    )
    add_audit_log(
        "pickup_pass_generated",
        actor=claimed_by,
        actor_role="NGO",
        entity="pickup_pass",
        entity_id=str(pickup_pass["id"]),
        meta={"food_id": food_id, "pass_code": pickup_pass["pass_code"]},
    )

    return jsonify(
        {
            "status": "success",
            "message": "Food claimed successfully.",
            "food_id": food_id,
            "claimed_by": claimed_by,
            "pickup_pass": {
                "pass_code": pickup_pass["pass_code"],
                "verify_token": pickup_pass["verify_token"],
                "expires_at": pickup_pass["expires_at"],
            },
        }
    )


@app.route("/api/chats", methods=["GET"])
def api_claim_chat_threads():
    username = normalize_username(request.args.get("username", ""))
    if not username:
        return jsonify({"status": "error", "message": "username is required"}), 400

    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT
                fl.id AS food_id,
                fl.food_name,
                fl.qty,
                fl.safe_hours,
                lower(fl.donor_name) AS donor_name,
                lower(fl.claimed_by) AS ngo_name,
                last_chat.id AS last_message_id,
                last_chat.sender AS last_message_sender,
                last_chat.message AS last_message,
                last_chat.created_at AS last_message_at,
                last_chat.delivered_at AS last_message_delivered_at,
                last_chat.read_at AS last_message_read_at,
                COALESCE(unread.unread_count, 0) AS unread_count,
                COUNT(cc.id) AS total_messages
            FROM food_listings fl
            LEFT JOIN (
                SELECT c1.*
                FROM claim_chats c1
                INNER JOIN (
                    SELECT food_id, MAX(id) AS max_id
                    FROM claim_chats
                    GROUP BY food_id
                ) latest ON latest.food_id = c1.food_id AND latest.max_id = c1.id
            ) last_chat ON last_chat.food_id = fl.id
            LEFT JOIN (
                SELECT food_id, COUNT(*) AS unread_count
                FROM claim_chats
                WHERE sender <> ? AND read_at IS NULL
                GROUP BY food_id
            ) unread ON unread.food_id = fl.id
            LEFT JOIN claim_chats cc ON cc.food_id = fl.id
            WHERE fl.is_claimed = 1 AND (lower(fl.donor_name) = ? OR lower(fl.claimed_by) = ?)
            GROUP BY fl.id, fl.food_name, fl.qty, fl.safe_hours, fl.donor_name, fl.claimed_by,
                     last_chat.id, last_chat.sender, last_chat.message, last_chat.created_at,
                     last_chat.delivered_at, last_chat.read_at, unread.unread_count
            ORDER BY COALESCE(last_chat.id, 0) DESC, fl.id DESC
            """,
            (username, username, username),
        ).fetchall()

    threads = []
    for row in rows:
        donor_name = normalize_username(row["donor_name"])
        ngo_name = normalize_username(row["ngo_name"])
        counterpart = ngo_name if username == donor_name else donor_name
        last_status = "idle"
        if row["last_message_id"]:
            if normalize_username(row["last_message_sender"] or "") == username:
                if row["last_message_read_at"]:
                    last_status = "read"
                elif row["last_message_delivered_at"]:
                    last_status = "delivered"
                else:
                    last_status = "sent"
            else:
                last_status = "received"
        threads.append(
            {
                "food_id": row["food_id"],
                "food_name": row["food_name"],
                "qty": row["qty"],
                "safe_hours": row["safe_hours"],
                "donor_name": donor_name,
                "ngo_name": ngo_name,
                "counterpart": counterpart,
                "unread_count": int(row["unread_count"] or 0),
                "total_messages": int(row["total_messages"] or 0),
                "last_message": row["last_message"],
                "last_message_id": row["last_message_id"],
                "last_message_sender": normalize_username(row["last_message_sender"] or "") if row["last_message_sender"] else None,
                "last_message_at": row["last_message_at"],
                "last_message_status": last_status,
            }
        )

    return jsonify({"status": "success", "threads": threads})


@app.route("/api/food/<int:food_id>/chat", methods=["GET"])
def api_claim_chat_get(food_id: int):
    username = normalize_username(request.args.get("username", ""))
    if not username:
        return jsonify({"status": "error", "message": "username is required"}), 400

    try:
        limit = int(request.args.get("limit", 80))
    except (TypeError, ValueError):
        limit = 80
    limit = max(10, min(200, limit))

    try:
        since_id = int(request.args.get("since_id", 0) or 0)
    except (TypeError, ValueError):
        since_id = 0
    since_id = max(0, since_id)

    with get_conn() as conn:
        context, error_response, status_code = get_claim_chat_context(conn, food_id, username)
        if error_response:
            return error_response, status_code

        now_iso = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            UPDATE claim_chats
            SET delivered_at = COALESCE(delivered_at, ?),
                read_at = COALESCE(read_at, ?)
            WHERE food_id = ? AND sender <> ?
            """,
            (now_iso, now_iso, food_id, username),
        )

        if since_id:
            rows = conn.execute(
                """
                SELECT id, food_id, donor_name, ngo_name, sender, message, client_nonce, delivered_at, read_at, created_at
                FROM claim_chats
                WHERE food_id = ? AND id > ?
                ORDER BY id ASC
                LIMIT ?
                """,
                (food_id, since_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, food_id, donor_name, ngo_name, sender, message, client_nonce, delivered_at, read_at, created_at
                FROM claim_chats
                WHERE food_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (food_id, limit),
            ).fetchall()
            rows = list(reversed(rows))

        latest_row = conn.execute(
            """
            SELECT id, food_id, donor_name, ngo_name, sender, message, client_nonce, delivered_at, read_at, created_at
            FROM claim_chats
            WHERE food_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (food_id,),
        ).fetchone()
        status_rows = conn.execute(
            """
            SELECT id, food_id, donor_name, ngo_name, sender, message, client_nonce, delivered_at, read_at, created_at
            FROM claim_chats
            WHERE food_id = ? AND sender = ? AND (delivered_at IS NOT NULL OR read_at IS NOT NULL)
            ORDER BY id DESC
            LIMIT 40
            """,
            (food_id, username),
        ).fetchall()
        unread_count = conn.execute(
            "SELECT COUNT(*) AS unread_count FROM claim_chats WHERE food_id = ? AND sender <> ? AND read_at IS NULL",
            (food_id, username),
        ).fetchone()["unread_count"]
        conn.commit()

    messages = [serialize_claim_chat_message(r, username) for r in rows]
    status_updates = [serialize_claim_chat_message(r, username) for r in status_rows]
    return jsonify(
        {
            "status": "success",
            "messages": messages,
            "status_updates": status_updates,
            "sync": {
                "mode": "incremental" if since_id else "initial",
                "since_id": since_id,
                "latest_message_id": latest_row["id"] if latest_row else 0,
                "returned_count": len(messages),
            },
            "conversation": {
                "food_id": context["listing"]["id"],
                "food_name": context["listing"]["food_name"],
                "qty": context["listing"]["qty"],
                "safe_hours": context["listing"]["safe_hours"],
                "donor_name": context["donor_name"],
                "ngo_name": context["ngo_name"],
                "counterpart": context["counterpart"],
                "unread_count": int(unread_count or 0),
                "last_message": serialize_claim_chat_message(latest_row, username) if latest_row else None,
            },
        }
    )


@app.route("/api/food/<int:food_id>/chat", methods=["POST"])
def api_claim_chat_post(food_id: int):
    payload = request.get_json(silent=True) or {}
    username = normalize_username(payload.get("username", ""))
    message = str(payload.get("message", "")).strip()
    client_nonce = str(payload.get("client_nonce", "")).strip() or None

    if not username or not message:
        return jsonify({"status": "error", "message": "username and message are required"}), 400
    if len(message) > 1000:
        return jsonify({"status": "error", "message": "message too long"}), 400

    with get_conn() as conn:
        context, error_response, status_code = get_claim_chat_context(conn, food_id, username)
        if error_response:
            return error_response, status_code

        if client_nonce:
            existing = conn.execute(
                """
                SELECT id, food_id, donor_name, ngo_name, sender, message, client_nonce, delivered_at, read_at, created_at
                FROM claim_chats
                WHERE food_id = ? AND sender = ? AND client_nonce = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (food_id, username, client_nonce),
            ).fetchone()
            if existing:
                return jsonify({"status": "success", "message": serialize_claim_chat_message(existing, username), "deduped": True})

        created_at = datetime.now(timezone.utc).isoformat()
        cur = conn.execute(
            """
            INSERT INTO claim_chats (food_id, donor_name, ngo_name, sender, message, client_nonce, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (food_id, context["donor_name"], context["ngo_name"], username, message, client_nonce, created_at),
        )
        msg_id = cur.lastrowid
        row = conn.execute(
            """
            SELECT id, food_id, donor_name, ngo_name, sender, message, client_nonce, delivered_at, read_at, created_at
            FROM claim_chats WHERE id = ?
            """,
            (msg_id,),
        ).fetchone()
        conn.commit()

    recipient = context["counterpart"]
    create_notification(
        "New claim chat message",
        f"{username} sent a message on {context['listing']['food_name']} (listing #{food_id})",
        target_username=recipient,
        notif_type="info",
    )
    add_audit_log(
        "claim_chat_message_sent",
        actor=username,
        entity="food_listing",
        entity_id=str(food_id),
        meta={"recipient": recipient},
    )

    return jsonify(
        {
            "status": "success",
            "message": serialize_claim_chat_message(row, username),
        }
    )


@app.route("/api/pickup-pass", methods=["GET"])
@app.route("/api/pickup-pass/<int:claim_id>", methods=["GET"])
def api_pickup_pass_get(claim_id: int | None = None):
    food_id_raw = claim_id if claim_id is not None else request.args.get("food_id")
    username = str(request.args.get("username", "")).strip().lower()

    if food_id_raw is None:
        return jsonify({"status": "error", "message": "food_id is required"}), 400

    try:
        food_id = int(food_id_raw)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "food_id must be an integer"}), 400

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT pp.id, pp.food_id, pp.donor_name, pp.claimed_by, pp.pass_code, pp.verify_token,
                   pp.qr_payload, pp.expires_at, pp.is_verified, pp.verified_at, pp.verified_by,
                   fl.food_name, fl.qty, fl.safe_hours
            FROM pickup_passes pp
            JOIN food_listings fl ON fl.id = pp.food_id
            WHERE pp.food_id = ? AND pp.is_active = 1
            ORDER BY pp.id DESC
            LIMIT 1
            """,
            (food_id,),
        ).fetchone()

    if not row:
        return jsonify({"status": "error", "message": "pickup pass not found"}), 404

    if username and username not in {str(row["claimed_by"]).lower(), str(row["donor_name"]).lower()}:
        return jsonify({"status": "error", "message": "not allowed"}), 403

    return jsonify(
        {
            "status": "success",
            "pickup_pass": {
                "id": row["id"],
                "food_id": row["food_id"],
                "food_name": row["food_name"],
                "qty": row["qty"],
                "safe_hours": row["safe_hours"],
                "donor_name": row["donor_name"],
                "claimed_by": row["claimed_by"],
                "pass_code": row["pass_code"],
                "verify_token": row["verify_token"],
                "expires_at": row["expires_at"],
                "is_verified": bool(row["is_verified"]),
                "verified_at": row["verified_at"],
                "verified_by": row["verified_by"],
                "qr_payload": row["qr_payload"],
            },
        }
    )


@app.route("/api/pickup-pass/verify", methods=["POST"])
@app.route("/api/pickup-pass/<int:claim_id>/verify", methods=["POST"])
def api_pickup_pass_verify(claim_id: int | None = None):
    payload = request.get_json(silent=True) or {}
    pass_code = str(payload.get("pass_code", "")).strip().upper()
    verify_token = str(payload.get("verify_token", "")).strip()
    verified_by = str(payload.get("verified_by", "system")).strip()

    if claim_id is None and (not pass_code or not verify_token):
        return jsonify({"status": "error", "message": "pass_code and verify_token are required"}), 400

    with get_conn() as conn:
        if claim_id is not None:
            row = conn.execute(
                """
                SELECT id, food_id, verify_token, expires_at, is_verified, pass_code
                FROM pickup_passes
                WHERE food_id = ? AND is_active = 1
                ORDER BY id DESC
                LIMIT 1
                """,
                (claim_id,),
            ).fetchone()
            if row:
                pass_code = row["pass_code"]
        else:
            row = conn.execute(
                """
                SELECT id, food_id, verify_token, expires_at, is_verified, pass_code
                FROM pickup_passes
                WHERE pass_code = ? AND is_active = 1
                ORDER BY id DESC
                LIMIT 1
                """,
                (pass_code,),
            ).fetchone()

        if not row:
            return jsonify({"status": "error", "message": "pickup pass not found"}), 404

        if row["verify_token"] != verify_token:
            add_audit_log("pickup_pass_verify_failed", actor=verified_by, entity="pickup_pass", entity_id=str(row["id"]))
            return jsonify({"status": "error", "message": "invalid verification token"}), 403

        expires_dt = None
        try:
            expires_dt = datetime.fromisoformat(str(row["expires_at"]).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            expires_dt = None

        if expires_dt and datetime.now(timezone.utc) > expires_dt:
            conn.execute("UPDATE pickup_passes SET is_active = 0 WHERE id = ?", (row["id"],))
            conn.commit()
            return jsonify({"status": "error", "message": "pickup pass expired"}), 410

        verified_at = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            UPDATE pickup_passes
            SET is_verified = 1, verified_at = ?, verified_by = ?
            WHERE id = ?
            """,
            (verified_at, verified_by, row["id"]),
        )
        conn.commit()

    add_audit_log(
        "pickup_pass_verified",
        actor=verified_by,
        entity="pickup_pass",
        entity_id=str(row["id"]),
        meta={"pass_code": pass_code, "food_id": row["food_id"]},
    )

    return jsonify(
        {
            "status": "success",
            "message": "pickup pass verified",
            "pass_code": pass_code,
            "food_id": row["food_id"],
            "verified_at": verified_at,
            "verified_by": verified_by,
        }
    )


@app.route("/api/food/update", methods=["POST"])
@app.route("/api/food/<int:food_id>", methods=["PUT"])
def api_food_update(food_id: int | None = None):
    payload = request.get_json(silent=True) or {}
    food_id_raw = food_id if food_id is not None else payload.get("food_id")
    updates = payload.get("updates") if isinstance(payload.get("updates"), dict) else payload

    if food_id_raw is None or not isinstance(updates, dict):
        return jsonify({"status": "error", "message": "food_id and updates are required"}), 400

    try:
        food_id = int(food_id_raw)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "food_id must be an integer"}), 400

    allowed_fields = {"food_name", "qty", "temp", "hours_ago", "food_category", "storage_conditions", "packaging"}
    clean_updates = {k: v for k, v in updates.items() if k in allowed_fields}

    if not clean_updates:
        return jsonify({"status": "error", "message": "no valid fields to update"}), 400

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, temp, hours_ago, food_category, storage_conditions, packaging
            FROM food_listings
            WHERE id = ?
            """,
            (food_id,),
        ).fetchone()
        if not row:
            return jsonify({"status": "error", "message": "food listing not found"}), 404

        numeric_fields = {"qty", "temp", "hours_ago"}
        for field in numeric_fields.intersection(clean_updates.keys()):
            try:
                clean_updates[field] = float(clean_updates[field])
            except (TypeError, ValueError):
                return jsonify({"status": "error", "message": f"{field} must be numeric"}), 400

        if "food_name" in clean_updates:
            clean_updates["food_name"] = str(clean_updates["food_name"]).strip()
            if not clean_updates["food_name"]:
                return jsonify({"status": "error", "message": "food_name cannot be empty"}), 400

        if "qty" in clean_updates and clean_updates["qty"] <= 0:
            return jsonify({"status": "error", "message": "qty must be greater than zero"}), 400
        if "hours_ago" in clean_updates and clean_updates["hours_ago"] < 0:
            return jsonify({"status": "error", "message": "hours_ago cannot be negative"}), 400
        if "food_category" in clean_updates:
            clean_updates["food_category"] = str(clean_updates["food_category"]).strip().lower()
        if "storage_conditions" in clean_updates:
            clean_updates["storage_conditions"] = str(clean_updates["storage_conditions"]).strip().lower()
        if "packaging" in clean_updates:
            clean_updates["packaging"] = str(clean_updates["packaging"]).strip().lower()

        predictive_fields = {"temp", "hours_ago", "food_category", "storage_conditions", "packaging"}
        if predictive_fields.intersection(clean_updates.keys()):
            recalculated_temp = float(clean_updates.get("temp", row["temp"]))
            recalculated_hours_ago = float(clean_updates.get("hours_ago", row["hours_ago"]))
            recalculated_category = str(clean_updates.get("food_category", row["food_category"] or "prepared"))
            recalculated_storage = str(clean_updates.get("storage_conditions", row["storage_conditions"] or "ambient"))
            recalculated_packaging = str(clean_updates.get("packaging", row["packaging"] or "open"))
            clean_updates["safe_hours"] = predict_safe_hours(
                recalculated_temp,
                recalculated_hours_ago,
                recalculated_category,
                recalculated_storage,
                recalculated_packaging,
            )

        set_clause = ", ".join(f"{field} = ?" for field in clean_updates.keys())
        params = list(clean_updates.values()) + [food_id]

        conn.execute(f"UPDATE food_listings SET {set_clause} WHERE id = ?", params)
        conn.commit()

    add_audit_log("listing_updated", entity="food_listing", entity_id=str(food_id), meta=clean_updates)

    return jsonify({"status": "success", "message": "listing updated", "food_id": food_id})


@app.route("/api/analytics", methods=["GET"])
def api_analytics():
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) AS c FROM food_listings").fetchone()["c"]
        claimed = conn.execute("SELECT COUNT(*) AS c FROM food_listings WHERE is_claimed = 1").fetchone()["c"]
        available = total - claimed
        avg_safe = conn.execute("SELECT COALESCE(AVG(safe_hours), 0) AS a FROM food_listings").fetchone()["a"]
        high_risk = conn.execute("SELECT COUNT(*) AS c FROM food_listings WHERE safe_hours <= 2 AND is_claimed = 0").fetchone()["c"]
        claimed_qty = conn.execute("SELECT COALESCE(SUM(qty), 0) AS q FROM food_listings WHERE is_claimed = 1").fetchone()["q"]
        total_qty = conn.execute("SELECT COALESCE(SUM(qty), 0) AS q FROM food_listings").fetchone()["q"]
        verified_passes = conn.execute("SELECT COUNT(*) AS c FROM pickup_passes WHERE is_active = 1 AND is_verified = 1").fetchone()["c"]
        pending_passes = conn.execute("SELECT COUNT(*) AS c FROM pickup_passes WHERE is_active = 1 AND is_verified = 0").fetchone()["c"]

        donor_rows = conn.execute(
            """
            SELECT donor_name, SUM(qty) AS total_qty
            FROM food_listings
            GROUP BY donor_name
            ORDER BY total_qty DESC
            LIMIT 8
            """
        ).fetchall()

        ngo_rows = conn.execute(
            """
            SELECT COALESCE(claimed_by, 'Unclaimed') AS ngo_name, COUNT(*) AS claims
            FROM food_listings
            GROUP BY COALESCE(claimed_by, 'Unclaimed')
            ORDER BY claims DESC
            LIMIT 8
            """
        ).fetchall()

    return jsonify(
        {
            "status": "success",
            "metrics": {
                "total_listings": int(total),
                "claimed_listings": int(claimed),
                "available_listings": int(available),
                "avg_safe_hours": round(float(avg_safe or 0), 2),
                "high_risk_available": int(high_risk),
                "total_qty_kg": round(float(total_qty or 0), 2),
                "claimed_qty_kg": round(float(claimed_qty or 0), 2),
                "waste_diverted_kg": round(float(claimed_qty or 0), 2),
                "meals_rescued": int(round(float(claimed_qty or 0) * 2.2)),
                "people_served_est": int(round(float(claimed_qty or 0) * 1.1)),
                "co2e_avoided_kg": round(float(claimed_qty or 0) * 2.5, 2),
                "pickup_passes_verified": int(verified_passes),
                "pickup_passes_pending": int(pending_passes),
            },
            "donor_volume": [
                {"name": row["donor_name"], "qty": round(float(row["total_qty"] or 0), 2)} for row in donor_rows
            ],
            "ngo_claims": [
                {"name": row["ngo_name"], "claims": int(row["claims"])} for row in ngo_rows
            ],
            "impact_formulas": {
                "meals_rescued": "claimed_qty_kg * 2.2",
                "people_served_est": "claimed_qty_kg * 1.1",
                "co2e_avoided_kg": "claimed_qty_kg * 2.5",
                "waste_diverted_kg": "claimed_qty_kg",
            },
        }
    )


@app.route("/api/admin/users", methods=["GET"])
def api_admin_users():
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, username, role, is_verified, is_banned FROM users ORDER BY id DESC"
        ).fetchall()

    users = [
        {
            "id": row["id"],
            "username": row["username"],
            "role": row["role"],
            "is_verified": bool(row["is_verified"]),
            "is_banned": bool(row["is_banned"]),
        }
        for row in rows
    ]

    return jsonify({"status": "success", "users": users})


@app.route("/api/admin/users/update-status", methods=["POST"])
@app.route("/api/admin/users/<int:user_id>/status", methods=["PATCH"])
def api_admin_users_update_status(user_id: int | None = None):
    payload = request.get_json(silent=True) or {}
    user_id_raw = user_id if user_id is not None else payload.get("user_id")
    action = str(payload.get("action", "")).strip().lower()

    if user_id_raw is None or action not in {"verify", "unverify", "ban", "unban"}:
        return jsonify({"status": "error", "message": "user_id and valid action are required"}), 400

    try:
        user_id = int(user_id_raw)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "user_id must be an integer"}), 400

    if action == "verify":
        field, value = "is_verified", 1
    elif action == "unverify":
        field, value = "is_verified", 0
    elif action == "ban":
        field, value = "is_banned", 1
    else:
        field, value = "is_banned", 0

    with get_conn() as conn:
        target = conn.execute("SELECT id, username, role FROM users WHERE id = ?", (user_id,)).fetchone()
        if not target:
            return jsonify({"status": "error", "message": "user not found"}), 404
        conn.execute(f"UPDATE users SET {field} = ? WHERE id = ?", (value, user_id))
        conn.commit()

    add_audit_log("admin_user_status_changed", actor_role="ADMIN", entity="user", entity_id=str(user_id), meta={"action": action})
    create_notification(
        "Account status updated",
        f"Your account status changed: {action}",
        target_username=target["username"],
        notif_type="warning" if action in {"ban", "unverify"} else "info",
    )

    return jsonify({"status": "success", "message": f"user {action}d", "user_id": user_id})


@app.route("/api/admin/overview", methods=["GET"])
def api_admin_overview():
    with get_conn() as conn:
        total_users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        total_ngos = conn.execute("SELECT COUNT(*) AS c FROM users WHERE role = 'NGO'").fetchone()["c"]
        total_donors = conn.execute("SELECT COUNT(*) AS c FROM users WHERE role = 'DONOR'").fetchone()["c"]
        total_admins = conn.execute("SELECT COUNT(*) AS c FROM users WHERE role = 'ADMIN'").fetchone()["c"]
        total_listings = conn.execute("SELECT COUNT(*) AS c FROM food_listings").fetchone()["c"]

    return jsonify(
        {
            "status": "success",
            "overview": {
                "total_users": int(total_users),
                "total_ngos": int(total_ngos),
                "total_donors": int(total_donors),
                "total_admins": int(total_admins),
                "total_listings": int(total_listings),
                "api_health": "healthy",
            },
        }
    )


@app.route("/api/admin/ai-logs", methods=["GET"])
def api_admin_ai_logs():
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, donor_name, food_name, temp, hours_ago, safe_hours, is_claimed
            FROM food_listings
            ORDER BY id DESC
            LIMIT 200
            """
        ).fetchall()

    logs = [
        {
            "id": row["id"],
            "donor_name": row["donor_name"],
            "food_name": row["food_name"],
            "temp": row["temp"],
            "hours_ago": row["hours_ago"],
            "safe_hours": row["safe_hours"],
            "is_claimed": bool(row["is_claimed"]),
            "risk_flag": "HIGH" if float(row["safe_hours"] or 0) <= 2 else "NORMAL",
        }
        for row in rows
    ]

    return jsonify({"status": "success", "logs": logs})


@app.route("/api/forgot-password", methods=["POST"])
@app.route("/api/auth/forgot-password", methods=["POST"])
def api_forgot_password():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip().lower()
    if not username:
        return jsonify({"status": "error", "message": "username is required"}), 400

    user = get_user(username)
    if not user:
        # Prototype mode: avoid hard failure for unknown accounts.
        return jsonify({"status": "success", "message": "If the account exists, a reset link has been generated."})

    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()

    with get_conn() as conn:
        conn.execute("UPDATE password_reset_tokens SET used_at = ? WHERE username = ? AND used_at IS NULL", (datetime.now(timezone.utc).isoformat(), username))
        conn.execute(
            "INSERT INTO password_reset_tokens (username, token, expires_at) VALUES (?, ?, ?)",
            (username, token, expires_at),
        )
        conn.commit()

    add_audit_log("forgot_password_requested", actor=username, entity="user", entity_id=str(user["id"]))
    # Prototype mode: return reset URL token directly in response for client integration.
    return jsonify({
        "status": "success",
        "message": "Reset link generated.",
        "reset_url": f"/reset-password/{token}",
        "token": token,
    })


@app.route("/api/auth/reset-password", methods=["POST"])
@app.route("/api/reset-password", methods=["POST"])
def api_reset_password():
    payload = request.get_json(silent=True) or {}
    token = str(payload.get("token", "")).strip()
    new_password = str(payload.get("new_password", "")).strip()

    if not token or not new_password:
        return jsonify({"status": "error", "message": "token and new_password are required"}), 400

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, expires_at, used_at FROM password_reset_tokens WHERE token = ?",
            (token,),
        ).fetchone()
        if not row:
            return jsonify({"status": "error", "message": "invalid token"}), 404

        conn.execute("UPDATE users SET password = ? WHERE username = ?", (new_password, row["username"]))
        conn.execute("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?", (datetime.now(timezone.utc).isoformat(), row["id"]))
        conn.commit()

    add_audit_log("password_reset_completed", actor=row["username"], entity="user", entity_id=row["username"])
    return jsonify({"status": "success", "message": "Password updated successfully"})


@app.route("/api/auth/logout", methods=["POST"])
@app.route("/api/logout", methods=["POST"])
def api_logout():
    payload = request.get_json(silent=True) or {}
    username = normalize_username(payload.get("username", ""))
    if username:
        add_audit_log("logout", actor=username, entity="user", entity_id=username)
    return jsonify({"status": "success", "message": "Logged out"})


@app.route("/api/support", methods=["POST"])
def api_support():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    email = str(payload.get("email", "")).strip()
    message = str(payload.get("message", "")).strip()

    if not email or not message:
        return jsonify({"status": "error", "message": "email and message are required"}), 400

    with get_conn() as conn:
        conn.execute(
            "INSERT INTO support_tickets (name, email, message) VALUES (?, ?, ?)",
            (name, email, message),
        )
        conn.commit()

    add_audit_log("support_ticket_created", actor=email, entity="support_ticket")
    create_notification("New support ticket", f"Support request from {email}", target_role="ADMIN", notif_type="info")

    return jsonify({"status": "success", "message": "Support ticket submitted"})


@app.route("/api/careers/apply", methods=["POST"])
def api_careers_apply():
    payload = request.get_json(silent=True) or {}
    role_name = str(payload.get("role_name", "")).strip()
    applicant_email = str(payload.get("applicant_email", "")).strip()
    applicant_name = str(payload.get("applicant_name", "")).strip()

    if not role_name or not applicant_email:
        return jsonify({"status": "error", "message": "role_name and applicant_email are required"}), 400

    with get_conn() as conn:
        conn.execute(
            "INSERT INTO career_applications (role_name, applicant_email, applicant_name) VALUES (?, ?, ?)",
            (role_name, applicant_email, applicant_name),
        )
        conn.commit()

    add_audit_log("career_application_created", actor=applicant_email, entity="career_application", meta={"role_name": role_name})

    return jsonify({"status": "success", "message": "Application submitted"})


@app.route("/api/settings", methods=["GET"])
@app.route("/api/settings/profile", methods=["GET"])
def api_settings_get():
    username = str(request.args.get("username", "")).strip().lower()
    if not username:
        return jsonify({"status": "error", "message": "username is required"}), 400

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT org_name, phone, avatar, timezone, latitude, longitude, radius_km,
                   alert_email, alert_sms, alert_critical, risk_threshold
            FROM user_settings
            WHERE username = ?
            """,
            (username,),
        ).fetchone()

    if not row:
        return jsonify({"status": "success", "settings": {}})

    return jsonify(
        {
            "status": "success",
            "settings": {
                "org_name": row["org_name"],
                "phone": row["phone"],
                "avatar": row["avatar"],
                "timezone": row["timezone"],
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "radius_km": row["radius_km"],
                "alert_email": bool(row["alert_email"]),
                "alert_sms": bool(row["alert_sms"]),
                "alert_critical": bool(row["alert_critical"]),
                "risk_threshold": row["risk_threshold"],
            },
        }
    )


@app.route("/api/settings", methods=["POST"])
@app.route("/api/settings/profile", methods=["PUT"])
def api_settings_post():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip().lower()
    values = payload.get("values") or {}

    if not username or not isinstance(values, dict):
        return jsonify({"status": "error", "message": "username and values are required"}), 400

    allowed = {
        "org_name", "phone", "avatar", "timezone", "latitude", "longitude", "radius_km",
        "alert_email", "alert_sms", "alert_critical", "risk_threshold",
    }
    clean = {k: values[k] for k in values.keys() if k in allowed}
    if not clean:
        return jsonify({"status": "error", "message": "no valid settings fields"}), 400

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM user_settings WHERE username = ?",
            (username,),
        ).fetchone()

        if not existing:
            conn.execute("INSERT INTO user_settings (username) VALUES (?)", (username,))

        set_clause = ", ".join([f"{k} = ?" for k in clean.keys()])
        params = list(clean.values()) + [username]
        conn.execute(f"UPDATE user_settings SET {set_clause} WHERE username = ?", params)
        conn.commit()

    add_audit_log("settings_updated", actor=username, entity="user_settings", entity_id=username, meta=clean)

    return jsonify({"status": "success", "message": "settings saved"})


@app.route("/api/notifications", methods=["GET"])
def api_notifications_get():
    username = str(request.args.get("username", "")).strip().lower()
    role = str(request.args.get("role", "")).strip().upper()

    if not username and not role:
        return jsonify({"status": "error", "message": "username or role is required"}), 400

    audience_filters = []
    params: list = []
    if username:
        audience_filters.append("LOWER(COALESCE(target_username, '')) = ?")
        params.append(username)
    if role:
        audience_filters.append("target_role = ?")
        params.append(role)
    where_clause = " OR ".join(audience_filters)

    sql = f"""
        SELECT id, target_username, target_role, title, message, type, is_read, created_at
        FROM notifications
        WHERE {where_clause}
        ORDER BY id DESC
        LIMIT 100
    """

    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()

    notifications = [
        {
            "id": row["id"],
            "target_username": row["target_username"],
            "target_role": row["target_role"],
            "title": row["title"],
            "message": row["message"],
            "type": row["type"],
            "is_read": bool(row["is_read"]),
            "created_at": row["created_at"],
        }
        for row in rows
    ]

    unread_count = sum(1 for n in notifications if not n["is_read"])
    return jsonify({"status": "success", "notifications": notifications, "unread_count": unread_count})


@app.route("/api/notifications/mark-read", methods=["POST"])
@app.route("/api/notifications/<int:notification_id>/read", methods=["PATCH"])
def api_notifications_mark_read(notification_id: int | None = None):
    payload = request.get_json(silent=True) or {}
    notification_id = notification_id if notification_id is not None else payload.get("notification_id")
    username = str(payload.get("username", "")).strip().lower()
    role = str(payload.get("role", "")).strip().upper()

    if notification_id is None:
        return jsonify({"status": "error", "message": "notification_id is required"}), 400

    try:
        notification_id = int(notification_id)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "notification_id must be integer"}), 400

    if not username and not role:
        return jsonify({"status": "error", "message": "username or role is required"}), 400

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, target_username, target_role FROM notifications WHERE id = ?",
            (notification_id,),
        ).fetchone()
        if not row:
            return jsonify({"status": "error", "message": "notification not found"}), 404

        target_username = str(row["target_username"] or "").strip().lower()
        target_role = str(row["target_role"] or "").strip().upper()

        allowed_by_username = bool(username) and target_username and target_username == username
        allowed_by_role = bool(role) and target_role and target_role == role
        if not (allowed_by_username or allowed_by_role):
            return jsonify({"status": "error", "message": "not allowed"}), 403

        conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notification_id,))
        conn.commit()

    return jsonify({"status": "success", "notification_id": notification_id})


@app.route("/api/notifications/read-all", methods=["PATCH", "POST"])
def api_notifications_read_all():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip().lower()
    role = str(payload.get("role", "")).strip().upper()

    if not username and not role:
        return jsonify({"status": "error", "message": "username or role is required"}), 400

    filters = []
    params: list = []
    if username:
        filters.append("LOWER(COALESCE(target_username, '')) = ?")
        params.append(username)
    if role:
        filters.append("target_role = ?")
        params.append(role)

    where_clause = " OR ".join(filters)

    with get_conn() as conn:
        cur = conn.execute(
            f"UPDATE notifications SET is_read = 1 WHERE ({where_clause}) AND is_read = 0",
            params,
        )
        conn.commit()
        updated = int(cur.rowcount or 0)

    return jsonify({"status": "success", "updated": updated})


@app.route("/api/admin/audit-logs", methods=["GET"])
def api_admin_audit_logs():
    limit_raw = request.args.get("limit", 200)
    action = str(request.args.get("action", "")).strip().lower()
    actor = str(request.args.get("actor", "")).strip().lower()

    try:
        limit = max(1, min(500, int(limit_raw)))
    except (TypeError, ValueError):
        limit = 200

    where = []
    params = []
    if action:
        where.append("LOWER(action) = ?")
        params.append(action)
    if actor:
        where.append("LOWER(COALESCE(actor, '')) = ?")
        params.append(actor)

    where_clause = f"WHERE {' AND '.join(where)}" if where else ""

    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT id, actor, actor_role, action, entity, entity_id, meta, created_at
            FROM audit_logs
            {where_clause}
            ORDER BY id DESC
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()

    logs = [
        {
            "id": row["id"],
            "actor": row["actor"],
            "actor_role": row["actor_role"],
            "action": row["action"],
            "entity": row["entity"],
            "entity_id": row["entity_id"],
            "meta": row["meta"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]

    return jsonify({"status": "success", "logs": logs})


@app.route("/api/food/delete", methods=["POST"])
@app.route("/api/food/<int:food_id>", methods=["DELETE"])
def delete_food_listing(food_id: int | None = None):
    data = request.get_json(force=True) or {}
    food_id = food_id if food_id is not None else data.get("food_id")
    donor_name = data.get("donor_name", "").strip()

    if not food_id or not donor_name:
        return jsonify({"status": "error", "message": "food_id and donor_name are required"}), 400

    try:
        food_id = int(food_id)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "food_id must be an integer"}), 400

    with get_conn() as conn:
        row = conn.execute(
            "SELECT donor_name, is_claimed FROM food_listings WHERE id = ?", (food_id,)
        ).fetchone()

        if not row:
            return jsonify({"status": "error", "message": "Listing not found"}), 404

        if row["donor_name"] != donor_name:
            return jsonify({"status": "error", "message": "You do not own this listing"}), 403

        if row["is_claimed"]:
            return jsonify({"status": "error", "message": "Cannot retract a claimed listing"}), 409

        conn.execute("DELETE FROM food_listings WHERE id = ?", (food_id,))
        conn.commit()

    add_audit_log("retract_listing", actor=donor_name, actor_role="DONOR", entity="food_listings", entity_id=str(food_id))
    return jsonify({"status": "success", "message": "Listing retracted"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
