import os
import sqlite3
import sys

if getattr(sys, "frozen", False):
    DB_DIR = os.path.expanduser("~/.ai-habit-coach/data")
else:
    DB_DIR = os.getenv("DATABASE_DIR", os.path.join(os.path.dirname(__file__), "data"))

DB_PATH = os.getenv("DATABASE_PATH", os.path.join(DB_DIR, "wellness.db"))


def get_conn():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS behavior_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            posture_score REAL NOT NULL,
            is_active INTEGER NOT NULL,
            sitting_minutes INTEGER NOT NULL,
            face_detected INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS water_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            ml INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS break_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            duration_seconds INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_behavior_ts ON behavior_log(timestamp);
        CREATE INDEX IF NOT EXISTS idx_water_ts ON water_log(timestamp);
        CREATE INDEX IF NOT EXISTS idx_break_ts ON break_log(timestamp);

        CREATE TABLE IF NOT EXISTS user_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            name TEXT,
            gender TEXT DEFAULT 'Male',
            age INTEGER DEFAULT 25,
            phone_number TEXT,
            is_verified INTEGER DEFAULT 0,
            verification_code TEXT
        );
        """
    )
    # Schema migration for existing databases
    try:
        conn.execute("ALTER TABLE user_settings ADD COLUMN name TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists
    try:
        conn.execute("ALTER TABLE user_settings ADD COLUMN gender TEXT DEFAULT 'Male'")
    except sqlite3.OperationalError:
        pass  # Column already exists
    try:
        conn.execute("ALTER TABLE user_settings ADD COLUMN age INTEGER DEFAULT 25")
    except sqlite3.OperationalError:
        pass  # Column already exists
    try:
        conn.execute("ALTER TABLE user_settings ADD COLUMN is_verified INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass  # Column already exists
    try:
        conn.execute("ALTER TABLE user_settings ADD COLUMN verification_code TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists

    conn.commit()
    conn.close()
