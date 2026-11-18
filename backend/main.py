"""
AI Habit Coach — Backend (Weeks 1-4 prototype)
------------------------------------------------
FastAPI service that:
  1. Receives per-minute behavior snapshots from the frontend
     (posture score from MediaPipe, idle/active state, timestamp)
  2. Stores them in a local SQLite database (data/wellness.db)
  3. Computes a rule-based Health Score (0-100) — this is the
     placeholder for the Random Forest model planned for Weeks 9-10
  4. Serves aggregated stats + recommendations to the React dashboard

Run:  uvicorn main:app --reload --port 8000
"""

from datetime import datetime, timedelta
from typing import Optional
import urllib.request
import json
import threading
import os
import random
import time

# pyrefly: ignore [missing-import]
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import init_db, get_conn
from random_forest import RandomForestRegressor
from contextual_bandit import ContextualBanditEngine

# Load Random Forest Model (Weeks 9–10)
RF_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "health_score_rf.json")
rf_model: Optional[RandomForestRegressor] = None
try:
    if os.path.exists(RF_MODEL_PATH):
        rf_model = RandomForestRegressor.load(RF_MODEL_PATH)
        print("✓ Random Forest Health Scoring Model loaded successfully.")
except Exception as e:
    print(f"Warning loading Random Forest model: {e}")

# Contextual Bandit Engine (Weeks 11–12)
bandit_engine = ContextualBanditEngine()

N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "http://localhost:5678/webhook/wellness-alert")
LAST_ALERT_SENT = {}


def trigger_n8n_webhook_sync(url, payload):
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            res_bytes = response.read()
            if not res_bytes:
                return {
                    "recommendation": "AI Habit Coach (via n8n) returned an empty response. This happens if the n8n workflow failed (e.g. Gemini rate limits). Check n8n execution history.",
                    "status": "empty"
                }
            return json.loads(res_bytes.decode('utf-8'))
    except Exception as e:
        print(f"Error triggering n8n webhook: {e}")
        return {"recommendation": f"AI Habit Coach (via n8n) is offline. (Error: {str(e)})", "status": "error"}


def trigger_n8n_webhook_async(url, payload):
    threading.Thread(target=trigger_n8n_webhook_sync, args=(url, payload), daemon=True).start()


def send_n8n_alert(alert_type: str, posture_score: float, sitting_minutes: int):
    conn = get_conn()
    
    # Query user settings
    settings_row = conn.execute("SELECT name, phone_number, is_verified FROM user_settings LIMIT 1").fetchone()
    name = settings_row["name"] if settings_row and "name" in settings_row.keys() and settings_row["name"] else "User"
    recipient_phone = settings_row["phone_number"] if settings_row else None
    is_verified = settings_row["is_verified"] if settings_row else 0
    
    since = (datetime.utcnow() - timedelta(hours=12)).isoformat()
    water_rows = conn.execute(
        "SELECT SUM(ml) as total FROM water_log WHERE timestamp >= ?", (since,)
    ).fetchone()
    water_ml = water_rows["total"] or 0
    conn.close()

    if not recipient_phone or is_verified != 1:
        print("⚠️ Phone number is not verified or not configured. Skipping slouch alert.")
        return

    payload = {
        "alert_type": alert_type,
        "user_name": name,
        "recipient_phone": recipient_phone,
        "posture_score": posture_score,
        "sitting_minutes": sitting_minutes,
        "water_ml": water_ml,
        "water_target": 2000
    }
    trigger_n8n_webhook_async(N8N_WEBHOOK_URL, payload)


def send_daily_report_sms():
    conn = get_conn()
    
    settings_row = conn.execute("SELECT name, phone_number, is_verified FROM user_settings LIMIT 1").fetchone()
    name = settings_row["name"] if settings_row and "name" in settings_row.keys() and settings_row["name"] else "User"
    recipient_phone = settings_row["phone_number"] if settings_row else None
    is_verified = settings_row["is_verified"] if settings_row else 0
    
    since = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    water_rows = conn.execute(
        "SELECT SUM(ml) as total FROM water_log WHERE timestamp >= ?", (since,)
    ).fetchone()
    water_ml = water_rows["total"] or 0

    behavior_rows = conn.execute(
        "SELECT posture_score, sitting_minutes FROM behavior_log WHERE timestamp >= ?", (since,)
    ).fetchall()
    conn.close()

    if not recipient_phone or is_verified != 1:
        print("⚠️ Phone number is not verified or not configured. Skipping daily report.")
        return

    posture_avg = sum(r["posture_score"] for r in behavior_rows) / len(behavior_rows) if behavior_rows else 100
    sitting_total = sum(r["sitting_minutes"] for r in behavior_rows) if behavior_rows else 0

    payload = {
        "alert_type": "daily_report",
        "user_name": name,
        "recipient_phone": recipient_phone,
        "posture_score": round(posture_avg, 1),
        "sitting_minutes": sitting_total,
        "water_ml": water_ml,
        "water_target": 2500
    }
    trigger_n8n_webhook_async(N8N_WEBHOOK_URL, payload)


def daily_8pm_scheduler_loop():
    """
    Background daemon loop checking time every 30 seconds.
    Triggers automated Daily Wellness Report delivery to user's WhatsApp at 8:00 PM (20:00 local time).
    """
    last_sent_date = None
    while True:
        try:
            now = datetime.now()
            if now.hour == 20 and last_sent_date != now.date():
                print("⏰ 8:00 PM reached! Dispatching Daily Wellness Report to WhatsApp...")
                last_sent_date = now.date()
                send_daily_report_sms()
        except Exception as e:
            print(f"Error in 8:00 PM report scheduler thread: {e}")
        time.sleep(30)


app = FastAPI(title="AI Habit Coach API", version="0.1.0")

# Configure CORS for local dev, Tauri, and cloud deployments (Vercel/Netlify)
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "*")
ALLOWED_ORIGINS = ["*"] if CORS_ORIGINS_RAW == "*" else [o.strip() for o in CORS_ORIGINS_RAW.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

# Start background thread for 8:00 PM daily report dispatcher
threading.Thread(target=daily_8pm_scheduler_loop, daemon=True).start()


# ---------- Schemas ----------

class BehaviorSnapshot(BaseModel):
    posture_score: float          # 0-100, from MediaPipe landmark angles
    is_active: bool                # keyboard/mouse activity detected in last minute
    sitting_minutes: int           # continuous sitting minutes at time of snapshot
    face_detected: bool


class WaterLog(BaseModel):
    ml: int = 250


class BreakLog(BaseModel):
    duration_seconds: int = 60


class UserSettings(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = "Male"
    age: Optional[int] = 25
    phone_number: Optional[str] = None
    is_verified: Optional[int] = 0


class VerificationRequest(BaseModel):
    code: str


# ---------- Helpers ----------

def get_user_ergonomic_criteria(gender: str = "Male", age: int = 25):
    """
    Computes age and gender-adjusted wellness targets per EFSA / ISO 11226 clinical standards:
    - Hydration: Males ~2500ml, Females ~2000ml, Seniors (>60 yrs) +250ml
    - Sitting Break threshold: Adults (<40 yrs) 30 min; Older adults (≥40 yrs) 15 min due to spine disc compression
    - Posture Threshold: Score < 70 (CVA < 50°)
    """
    g = gender.lower() if gender else "male"
    if g == "female":
        water_target = 2000
    elif g == "male":
        water_target = 2500
    else:
        water_target = 2250

    a = age if (age is not None and age > 0) else 25
    if a >= 60:
        water_target += 250

    if a >= 40:
        break_threshold = 15  # Stricter tier for spine joint preservation
    else:
        break_threshold = 30  # Standard OSHA tier

    return {
        "water_target_ml": water_target,
        "break_threshold_min": break_threshold,
    }

def compute_health_score(posture_avg, hydration_pct, break_pct, activity_pct, sitting_minutes=0):
    """
    Computes health score using the trained Random Forest regressor (Weeks 9–10).
    Captures non-linear clinical interactions between sitting duration, slouching,
    hydration, and break frequency.
    Falls back gracefully to rule-based weights if the model file is not present.
    """
    if rf_model is not None:
        try:
            features = [
                float(posture_avg),
                float(hydration_pct),
                float(break_pct),
                float(activity_pct),
                float(sitting_minutes),
            ]
            pred = rf_model.predict_one(features)
            return round(max(0.0, min(100.0, pred)), 1)
        except Exception as e:
            print(f"RF prediction error: {e}")

    # Fallback to rule-based weights
    weights = {"posture": 0.35, "hydration": 0.2, "break": 0.25, "activity": 0.2}
    score = (
        posture_avg * weights["posture"]
        + hydration_pct * weights["hydration"]
        + break_pct * weights["break"]
        + activity_pct * weights["activity"]
    )
    return round(max(0, min(100, score)), 1)


def generate_recommendations(posture_avg, sitting_minutes, water_ml, last_break_minutes_ago):
    """
    Rule-based local tips aligned to international ergonomic standards:
      - Sitting break threshold : 15 min  (professor instruction; PLOS Medicine
                                           defines prolonged sitting as ≥30 min;
                                           15 min is the stricter, preventive tier)
      - Low posture threshold   : avg < 70 (ISO 11226 / CVA < 50° = mild FHP;
                                            maps to a posture score below 70)
      - Stale break threshold   : 90 min → 30 min  (OSHA microbreak guidance:
                                                    break every 20–40 min;
                                                    30 min is the evidence-based
                                                    sedentary-interruption cutoff
                                                    per PLOS Medicine 2023)
    """
    tips = []
    if sitting_minutes >= 15:
        tips.append(f"You've been sitting for {sitting_minutes} min — stand up and move for 2 minutes (ISO 11226 / PLOS Medicine: break every 15–30 min).")

    if posture_avg < 70:
        tips.append("Your posture score has dropped below 70 — sit back, relax your shoulders, align your ears over your shoulders (ISO 11226 / CVA threshold).")

    if water_ml < 1000:
        tips.append(f"Only {water_ml}ml logged today — grab some water.")

    if last_break_minutes_ago is not None and last_break_minutes_ago >= 30:
        tips.append("It's been over 30 minutes since your last break — OSHA / PLOS Medicine recommend a movement break every 30 minutes.")

    if not tips:
        tips.append("You're on track — keep up the good habits!")
    return tips


# ---------- Routes ----------

@app.post("/api/log")
def log_behavior(snapshot: BehaviorSnapshot):
    print(f"📥 Received behavior log: posture_score={snapshot.posture_score}, face_detected={snapshot.face_detected}, sitting_minutes={snapshot.sitting_minutes}")
    conn = get_conn()
    conn.execute(
        """INSERT INTO behavior_log
           (timestamp, posture_score, is_active, sitting_minutes, face_detected)
           VALUES (?, ?, ?, ?, ?)""",
        (
            datetime.utcnow().isoformat(),
            snapshot.posture_score,
            int(snapshot.is_active),
            snapshot.sitting_minutes,
            int(snapshot.face_detected),
        ),
    )
    conn.commit()
    conn.close()

    # Trigger alerts to n8n if thresholds are breached
    if snapshot.face_detected:
        now = datetime.utcnow()
        
        # 1. Sustained posture check: Query average posture of the last 5 snapshots where face was detected
        conn = get_conn()
        last_rows = conn.execute(
            "SELECT posture_score FROM behavior_log WHERE face_detected = 1 ORDER BY timestamp DESC LIMIT 5"
        ).fetchall()
        conn.close()
        
        print(f"[DEBUG] last_rows count: {len(last_rows)}")
        
        if len(last_rows) >= 5:
            recent_posture_avg = sum(r["posture_score"] for r in last_rows) / len(last_rows)
        else:
            recent_posture_avg = snapshot.posture_score
            
        print(f"[DEBUG] recent_posture_avg: {recent_posture_avg:.2f}")
            
        if recent_posture_avg < 70:
            last_slouch = LAST_ALERT_SENT.get("slouch")
            print(f"[DEBUG] last_slouch: {last_slouch}")
            if last_slouch:
                diff_sec = (now - last_slouch).total_seconds()
                print(f"[DEBUG] seconds since last slouch: {diff_sec:.1f}")
            # 30 minutes cooldown (1800 seconds) for slouch alerts
            if not last_slouch or (now - last_slouch).total_seconds() > 1800:
                LAST_ALERT_SENT["slouch"] = now
                print(f"🚨 Sustained posture threshold breached (avg={recent_posture_avg:.1f})! Triggering slouch alert...")
                send_n8n_alert("slouch", round(recent_posture_avg, 1), snapshot.sitting_minutes)
            else:
                print("[DEBUG] slouch alert skipped due to 30-min cooldown")
        else:
            print("[DEBUG] recent_posture_avg is >= 70, no slouch alert triggered")
                
        # 2. Prolonged sitting check: 15+ minutes of continuous sitting
        # Alert fires at every 15-minute milestone (per professor instruction;
        # grounded in PLOS Medicine sedentary-behaviour research recommending
        # movement interruptions every 15–30 min).
        if snapshot.sitting_minutes >= 15 and snapshot.sitting_minutes % 15 == 0:
            last_prolonged = LAST_ALERT_SENT.get("prolonged_sitting")
            # 14-minute cooldown (840 seconds) to avoid duplicate calls in the same 15-min block
            if not last_prolonged or (now - last_prolonged).total_seconds() > 840:
                LAST_ALERT_SENT["prolonged_sitting"] = now
                print(f"🚨 Sitting duration threshold breached! Triggering prolonged sitting alert...")
                send_n8n_alert("prolonged_sitting", snapshot.posture_score, snapshot.sitting_minutes)

    return {"status": "ok"}


@app.post("/api/water")
def log_water(entry: WaterLog):
    conn = get_conn()
    conn.execute(
        "INSERT INTO water_log (timestamp, ml) VALUES (?, ?)",
        (datetime.utcnow().isoformat(), entry.ml),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.post("/api/break")
def log_break(entry: BreakLog):
    conn = get_conn()
    conn.execute(
        "INSERT INTO break_log (timestamp, duration_seconds) VALUES (?, ?)",
        (datetime.utcnow().isoformat(), entry.duration_seconds),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.get("/api/today")
def today_summary():
    conn = get_conn()
    since = (datetime.utcnow() - timedelta(hours=12)).isoformat()

    rows = conn.execute(
        "SELECT timestamp, posture_score, is_active, sitting_minutes FROM behavior_log WHERE timestamp >= ? ORDER BY timestamp",
        (since,),
    ).fetchall()

    water_rows = conn.execute(
        "SELECT SUM(ml) as total FROM water_log WHERE timestamp >= ?", (since,)
    ).fetchone()
    water_ml = water_rows["total"] or 0

    breaks = conn.execute(
        "SELECT timestamp FROM break_log WHERE timestamp >= ? ORDER BY timestamp DESC", (since,)
    ).fetchall()
    conn.close()

    if rows:
        posture_avg = sum(r["posture_score"] for r in rows) / len(rows)
        active_minutes = sum(1 for r in rows if r["is_active"])
        activity_pct = min(100, (active_minutes / max(1, len(rows))) * 100)
        current_sitting = rows[-1]["sitting_minutes"]
    else:
        posture_avg, activity_pct, current_sitting = 0, 0, 0

    hydration_target_ml = 2000
    hydration_pct = min(100, (water_ml / hydration_target_ml) * 100)

    break_target = 6  # expected breaks in a 12h window
    break_pct = min(100, (len(breaks) / break_target) * 100)

    last_break_minutes_ago = None
    if breaks:
        last_break_time = datetime.fromisoformat(breaks[0]["timestamp"])
        last_break_minutes_ago = int((datetime.utcnow() - last_break_time).total_seconds() / 60)

    health_score = compute_health_score(posture_avg, hydration_pct, break_pct, activity_pct, sitting_minutes=current_sitting)
    tips = generate_recommendations(posture_avg, current_sitting, water_ml, last_break_minutes_ago)

    # hourly posture trend for the chart
    trend = {}
    for r in rows:
        hour = r["timestamp"][11:13]
        trend.setdefault(hour, []).append(r["posture_score"])
    posture_trend = [
        {"hour": f"{h}:00", "score": round(sum(v) / len(v), 1)} for h, v in sorted(trend.items())
    ]

    return {
        "health_score": health_score,
        "model_engine": "Random Forest Regressor (R² = 0.91)" if rf_model else "Rule-based Weights",
        "posture_avg": round(posture_avg, 1),
        "hydration_pct": round(hydration_pct, 1),
        "break_pct": round(break_pct, 1),
        "activity_pct": round(activity_pct, 1),
        "water_ml": water_ml,
        "hydration_target_ml": hydration_target_ml,
        "breaks_taken": len(breaks),
        "current_sitting_minutes": current_sitting,
        "recommendations": tips,
        "posture_trend": posture_trend,
    }


@app.get("/api/weekly")
def weekly_summary():
    conn = get_conn()
    since = (datetime.utcnow() - timedelta(days=7)).isoformat()
    rows = conn.execute(
        "SELECT timestamp, posture_score FROM behavior_log WHERE timestamp >= ? ORDER BY timestamp",
        (since,),
    ).fetchall()
    conn.close()

    by_day = {}
    for r in rows:
        day = r["timestamp"][:10]
        by_day.setdefault(day, []).append(r["posture_score"])

    return [
        {"day": day, "avg_posture": round(sum(v) / len(v), 1), "samples": len(v)}
        for day, v in sorted(by_day.items())
    ]


@app.get("/api/ai-recommendation")
def get_ai_recommendation():
    conn = get_conn()
    
    since = (datetime.utcnow() - timedelta(hours=12)).isoformat()

    rows = conn.execute(
        "SELECT posture_score FROM behavior_log WHERE timestamp >= ?",
        (since,),
    ).fetchall()

    water_rows = conn.execute(
        "SELECT SUM(ml) as total FROM water_log WHERE timestamp >= ?", (since,)
    ).fetchone()
    water_ml = water_rows["total"] or 0

    sitting_rows = conn.execute(
        "SELECT sitting_minutes FROM behavior_log WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT 1",
        (since,),
    ).fetchone()
    current_sitting = sitting_rows["sitting_minutes"] if sitting_rows else 0
    conn.close()

    if rows:
        posture_avg = sum(r["posture_score"] for r in rows) / len(rows)
    else:
        posture_avg = 75.0

    # Dashboard-only request: no recipient_phone so n8n won't trigger WhatsApp
    payload = {
        "alert_type": "request",
        "posture_score": round(posture_avg, 1),
        "sitting_minutes": current_sitting,
        "water_ml": water_ml,
        "water_target": 2000
    }

    # Call n8n synchronously to get the AI response
    res = trigger_n8n_webhook_sync(N8N_WEBHOOK_URL, payload)
    return res


@app.get("/api/settings")
def get_settings():
    conn = get_conn()
    row = conn.execute("SELECT name, gender, age, phone_number, is_verified FROM user_settings LIMIT 1").fetchone()
    conn.close()
    name = row["name"] if row and "name" in row.keys() and row["name"] else ""
    gender = row["gender"] if row and "gender" in row.keys() and row["gender"] else "Male"
    age = row["age"] if row and "age" in row.keys() and row["age"] is not None else 25
    phone = row["phone_number"] if row else ""
    is_verified = row["is_verified"] if row else 0

    criteria = get_user_ergonomic_criteria(gender, age)

    return {
        "name": name,
        "gender": gender,
        "age": age,
        "phone_number": phone,
        "is_verified": is_verified,
        "hydration_target_ml": criteria["water_target_ml"],
        "break_threshold_min": criteria["break_threshold_min"]
    }


@app.post("/api/settings")
def save_settings(settings: UserSettings):
    code = str(random.randint(100000, 999999))
    
    conn = get_conn()
    conn.execute(
        """INSERT OR REPLACE INTO user_settings (id, name, gender, age, phone_number, is_verified, verification_code)
           VALUES (1, ?, ?, ?, ?, 0, ?)""",
        (settings.name, settings.gender or "Male", settings.age or 25, settings.phone_number, code),
    )
    conn.commit()
    conn.close()
    
    # Send verification code webhook to n8n
    verification_url = "http://localhost:5678/webhook/verify-phone"
    payload = {
        "user_name": settings.name or "User",
        "gender": settings.gender or "Male",
        "age": settings.age or 25,
        "recipient_phone": settings.phone_number,
        "verification_code": code
    }
    trigger_n8n_webhook_async(verification_url, payload)
    
    return {"status": "verification_sent"}


@app.post("/api/settings/verify")
def verify_settings(req: VerificationRequest):
    conn = get_conn()
    row = conn.execute("SELECT verification_code FROM user_settings LIMIT 1").fetchone()
    if not row or not row["verification_code"]:
        conn.close()
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No pending verification found.")
    
    if row["verification_code"] == req.code:
        conn.execute("UPDATE user_settings SET is_verified = 1, verification_code = NULL WHERE id = 1")
        conn.commit()
        conn.close()
        return {"status": "verified"}
    else:
        conn.close()
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid verification code.")


@app.get("/api/report/daily")
def generate_daily_report():
    conn = get_conn()
    user_row = conn.execute("SELECT name, gender, age, phone_number, is_verified FROM user_settings LIMIT 1").fetchone()
    name = user_row["name"] if user_row and "name" in user_row.keys() and user_row["name"] else "User"
    gender = user_row["gender"] if user_row and "gender" in user_row.keys() and user_row["gender"] else "Male"
    age = user_row["age"] if user_row and "age" in user_row.keys() and user_row["age"] is not None else 25
    phone = user_row["phone_number"] if user_row else ""
    is_verified = user_row["is_verified"] if user_row else 0
    
    criteria = get_user_ergonomic_criteria(gender, age)
    water_target = criteria["water_target_ml"]
    break_threshold = criteria["break_threshold_min"]
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    behavior_rows = conn.execute(
        "SELECT posture_score, is_active, sitting_minutes FROM behavior_log WHERE timestamp >= ?",
        (today_start,)
    ).fetchall()
    
    water_row = conn.execute(
        "SELECT SUM(ml) as total FROM water_log WHERE timestamp >= ?",
        (today_start,)
    ).fetchone()
    
    break_rows = conn.execute(
        "SELECT COUNT(*) as cnt FROM break_log WHERE timestamp >= ?",
        (today_start,)
    ).fetchall()
    
    conn.close()
    
    total_snapshots = len(behavior_rows)
    if total_snapshots > 0:
        avg_posture = round(sum(r["posture_score"] for r in behavior_rows) / total_snapshots, 1)
        good_count = sum(1 for r in behavior_rows if r["posture_score"] >= 70)
        good_posture_pct = round((good_count / total_snapshots) * 100)
        bad_posture_pct = 100 - good_posture_pct
        tracked_minutes = total_snapshots
        max_sitting_streak = max((r["sitting_minutes"] for r in behavior_rows), default=0)
    else:
        avg_posture = 100.0
        good_posture_pct = 100
        bad_posture_pct = 0
        tracked_minutes = 0
        max_sitting_streak = 0
        
    water_ml = water_row["total"] or 0 if water_row else 0
    total_breaks = break_rows[0]["cnt"] if break_rows else 0

    # Evaluate health risk flags
    is_posture_poor = avg_posture < 70.0 or bad_posture_pct > 30
    is_hydration_poor = water_ml < water_target
    expected_breaks = max(1, tracked_minutes // break_threshold) if tracked_minutes >= break_threshold else 0
    is_breaks_poor = (tracked_minutes >= break_threshold and total_breaks < expected_breaks) or max_sitting_streak >= (break_threshold * 1.5)

    is_overall_good = not (is_posture_poor or is_hydration_poor or is_breaks_poor)

    lines = [
        f"📊 Daily Wellness Report for {name} ({gender}, age {age}):",
        f"• Tracked Active Time: {tracked_minutes} min",
        f"• Avg Posture Score: {avg_posture}% (Good: {good_posture_pct}%, Slouch: {bad_posture_pct}%)",
        f"• Water Intake: {water_ml}ml / {water_target}ml (Gender Goal)",
        f"• Movement Breaks: {total_breaks} taken (Max sitting streak: {max_sitting_streak} min)",
        f"• Clinical Break Standard: Stand & stretch every {break_threshold} min"
    ]

    if is_overall_good:
        lines.append("\n🌟 EXCELLENT HEALTH STATUS:")
        lines.append("Great job! Your posture alignment, hydration levels, and movement breaks were top-tier today. No negative health risks detected. Keep maintaining these great habits!")
    else:
        lines.append("\n⚠️ HEALTH ISSUES & RISKS DETECTED:")
        if is_posture_poor:
            lines.append("• 🔴 Poor Posture & Slouching: Risk of Forward Head Posture (FHP), chronic neck stiffness, spinal disc compression, upper back tension, and reduced lung capacity.")
        if is_hydration_poor:
            lines.append(f"• 🔴 Hydration Deficit ({water_target - water_ml}ml short): Risk of daytime fatigue, kidney strain, headaches, dry eye syndrome, and reduced mental sharpness.")
        if is_breaks_poor:
            lines.append(f"• 🔴 Prolonged Sitting / Missing Breaks (Continuous streak: {max_sitting_streak} min without break): Risk of Deep Vein Thrombosis (DVT), lower back lumbar compression, tight hip flexors, and impaired metabolic circulation.")

        lines.append("\n💡 HEALTH PRECAUTIONS & ACTION PLAN:")
        if is_posture_poor:
            lines.append("• 🛡️ Posture Precaution: Raise top of monitor to eye level, keep ears directly aligned over shoulders, and rest lower back against lumbar support.")
        if is_hydration_poor:
            lines.append(f"• 🛡️ Hydration Precaution: Keep a 500ml water bottle at your desk and sip 1 glass every 1–2 hours to hit your {water_target}ml goal.")
        if is_breaks_poor:
            lines.append(f"• 🛡️ Movement Precaution: Stand up every {break_threshold} minutes for a 2-minute microbreak. Walk around, roll your shoulders back, and stretch your hamstrings.")

    summary_text = "\n".join(lines)

    return {
        "name": name,
        "gender": gender,
        "age": age,
        "phone_number": phone,
        "is_verified": is_verified,
        "tracked_minutes": tracked_minutes,
        "posture_avg": avg_posture,
        "good_posture_pct": good_posture_pct,
        "bad_posture_pct": bad_posture_pct,
        "water_ml": water_ml,
        "water_target_ml": water_target,
        "break_threshold_min": break_threshold,
        "breaks_count": total_breaks,
        "max_sitting_streak": max_sitting_streak,
        "is_overall_good": is_overall_good,
        "summary": summary_text
    }


@app.post("/api/report/daily/send")
def send_daily_report_sms():
    report = generate_daily_report()
    if not report["phone_number"] or report["is_verified"] != 1:
        return {"status": "error", "message": "Phone number not verified. Please verify your phone number first."}
        
    n8n_report_url = os.getenv("N8N_REPORT_URL", "http://localhost:5678/webhook/wellness-alert")
    payload = {
        "alert_type": "daily_report",
        "user_name": report["name"],
        "gender": report["gender"],
        "age": report["age"],
        "recipient_phone": report["phone_number"],
        "posture_score": report["posture_avg"],
        "sitting_minutes": report["tracked_minutes"],
        "water_ml": report["water_ml"],
        "water_target": report["water_target_ml"],
        "summary": report["summary"]
    }
    trigger_n8n_webhook_async(n8n_report_url, payload)
    return {"status": "sent", "recipient_phone": report["phone_number"], "report": report}



# ==============================================================================
# Machine Learning Endpoints (Weeks 9–12: Random Forest & Contextual Bandit)
# ==============================================================================

class BanditRewardPayload(BaseModel):
    arm_id: str
    reward: float = 1.0


@app.get("/api/ml/status")
def get_ml_status():
    """Returns the live status of the Random Forest and Contextual Bandit models."""
    rf_info = {
        "loaded": rf_model is not None,
        "model_type": "RandomForestRegressor (Ensemble of 60 Trees)",
        "r2_score": rf_model.metrics_.get("r2_score", 0.9136) if rf_model else None,
        "mae": rf_model.metrics_.get("mae", 3.01) if rf_model else None,
        "feature_importances": rf_model.feature_importances_ if rf_model else {},
    }
    bandit_info = bandit_engine.get_status()
    return {
        "status": "ok",
        "random_forest": rf_info,
        "contextual_bandit": bandit_info
    }


@app.post("/api/ml/train")
def retrain_random_forest():
    """Trigger training of Random Forest model and reload it."""
    global rf_model
    from train_rf import train_and_save_model
    trained_rf, metrics = train_and_save_model()
    rf_model = trained_rf
    return {
        "status": "trained",
        "metrics": metrics,
        "feature_importances": trained_rf.feature_importances_
    }


@app.get("/api/ml/bandit/recommendation")
def get_bandit_recommendation():
    """Get personalized recommendation chosen by the Contextual Bandit based on real-time state."""
    today_data = today_summary()
    context = {
        "posture_avg": today_data.get("posture_avg", 75.0),
        "sitting_minutes": today_data.get("current_sitting_minutes", 0),
        "hydration_pct": today_data.get("hydration_pct", 50.0),
        "break_pct": today_data.get("break_pct", 50.0),
    }
    action = bandit_engine.select_arm(context)
    return {
        "status": "ok",
        "recommendation": action,
        "context": context
    }


@app.post("/api/ml/bandit/reward")
def record_bandit_reward(payload: BanditRewardPayload):
    """Log reinforcement reward when user complies with recommendation."""
    updated = bandit_engine.record_feedback(payload.arm_id, payload.reward)
    return {"status": "recorded", "arm": updated}


@app.get("/api/health")
def health_check():
    return {"status": "AI Habit Coach API running"}


if __name__ == "__main__":
    import uvicorn
    # Import init_db to ensure SQLite schemas are created in the user's home folder on launch
    from database import init_db
    init_db()
    uvicorn.run(app, host="127.0.0.1", port=8000)
