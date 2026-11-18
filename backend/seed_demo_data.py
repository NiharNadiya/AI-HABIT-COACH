"""
Seeds ~7 days of realistic-looking behavior data so the Weekly Analytics
and Posture Trend charts have something to show on presentation day,
without needing to have actually run the tracker for a week.

Run once:  python seed_demo_data.py
"""
import random
from datetime import datetime, timedelta

from database import init_db, get_conn

init_db()
conn = get_conn()

now = datetime.utcnow()
random.seed(42)

rows = []
for day_offset in range(6, -1, -1):  # 6 days ago -> today
    day = now - timedelta(days=day_offset)
    # simulate a workday: 9am - 6pm, one sample every ~15 min
    base_quality = random.uniform(65, 88)  # each day has a slightly different baseline
    for hour in range(9, 18):
        for minute in (0, 15, 30, 45):
            ts = day.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if ts > now:
                continue
            # posture dips after lunch and late afternoon
            dip = -8 if hour in (13, 16, 17) else 0
            noise = random.uniform(-6, 6)
            score = max(30, min(98, base_quality + dip + noise))
            sitting_minutes = (hour - 9) * 60 + minute if hour < 12 else ((hour - 13) * 60 + minute if hour >= 13 else 0)
            is_active = random.random() > 0.15
            rows.append((ts.isoformat(), round(score, 1), int(is_active), sitting_minutes % 90, 1))

conn.executemany(
    "INSERT INTO behavior_log (timestamp, posture_score, is_active, sitting_minutes, face_detected) VALUES (?, ?, ?, ?, ?)",
    rows,
)

# a few water + break logs per day
water_rows, break_rows = [], []
for day_offset in range(6, -1, -1):
    day = now - timedelta(days=day_offset)
    for h in (9, 11, 13, 15, 17):
        ts = day.replace(hour=h, minute=random.choice([0, 20, 40]), second=0)
        if ts <= now:
            water_rows.append((ts.isoformat(), 250))
    for h in (10, 12, 15):
        ts = day.replace(hour=h, minute=random.choice([0, 30]), second=0)
        if ts <= now:
            break_rows.append((ts.isoformat(), 300))

conn.executemany("INSERT INTO water_log (timestamp, ml) VALUES (?, ?)", water_rows)
conn.executemany("INSERT INTO break_log (timestamp, duration_seconds) VALUES (?, ?)", break_rows)

conn.commit()
conn.close()
print(f"Seeded {len(rows)} behavior rows, {len(water_rows)} water logs, {len(break_rows)} break logs.")
