# 🧘 AI Habit Coach — Workplace Wellness Desktop App

> A privacy-first, AI-powered desktop application that monitors posture, tracks hydration, and delivers personalized wellness recommendations — all running locally on your machine.

---

## 📌 Project Overview

AI Habit Coach is an intelligent workplace wellness system designed to help desk workers maintain healthy habits throughout their workday. It uses **real-time computer vision** to detect posture, tracks hydration and break patterns, and leverages **Google Gemini AI** (via n8n workflow automation) to generate personalized coaching recommendations delivered through the dashboard and **WhatsApp notifications**.

Built as a **Tauri v2 desktop application** with a React frontend and Python FastAPI backend, the entire system runs locally — no data leaves your machine.

---

## 🗓️ Roadmap Progress (Weeks 1–12)

| Roadmap Week | Milestone | Status |
|---|---|---|
| **Weeks 1–2** | Project Setup (React, FastAPI, SQLite, Tauri) | ✅ Complete |
| **Weeks 3–4** | Computer Vision — Posture Detection & Personalized Calibration | ✅ Complete |
| **Weeks 5–6** | Behavior Logging & Activity Tracking | ✅ Complete |
| **Weeks 7–8** | Dashboard, Alerts & Gemini AI Orchestration | ✅ Complete |
| **Weeks 9–10** | Random Forest Health Score Regressor ($R^2 = 0.9136$, MAE = $3.01$) | ✅ Complete |
| **Weeks 11–12** | Contextual Bandit Recommendation Engine (UCB1 RL Loop) | ✅ Complete |

---

## ✅ Detailed Work Completed (Weeks 1–8)

### Weeks 1–2: Project Setup & Architecture

- **Frontend**: Initialized a React + Vite project with a modern dark-themed UI using custom CSS variables, glassmorphism effects, and responsive grid layouts.
- **Backend**: Built a FastAPI REST API server with SQLite database for persistent local storage. Designed normalized schemas for `behavior_log`, `water_log`, `break_log`, and `user_settings` tables.
- **Desktop Packaging**: Integrated Tauri v2 to package the web app as a native macOS desktop application (`.app` / `.dmg`). The Tauri shell plugin spawns the Python backend as a sidecar process, and cleanly terminates it on app exit.
- **n8n Workflow Automation**: Set up n8n (self-hosted via Docker) as the AI orchestration layer with two workflows:
  - **AI Habit Coach Workflow** — Receives wellness alerts via webhook, generates AI recommendations using Google Gemini, responds to the frontend, and sends WhatsApp/Discord notifications.
  - **Verification Workflow** — Handles phone number verification via Twilio WhatsApp OTP.
- **CORS & Dev Server Configuration**: Configured CORS origins for Vite dev server (`localhost:5173`), Tauri WebView (`tauri://localhost`), and production builds.

### Weeks 3–4: Computer Vision — Real-Time Posture Detection

- **MediaPipe Pose Landmarker**: Integrated Google's `@mediapipe/tasks-vision` library to run the Pose Landmarker model directly in the browser — no Python OpenCV backend required.
  - Uses the `pose_landmarker_lite` model (Float16) for efficient real-time inference.
  - Automatically falls back from GPU to CPU delegate if GPU acceleration is unavailable (common on macOS).
- **Posture Scoring Algorithm** (`posture.js`): Developed a geometric heuristic-based scoring system (0–100) using three biomechanical metrics:
  1. **Forward Head Offset** — Measures horizontal displacement of the ear midpoint from the shoulder midpoint, normalized by shoulder width. Detects forward-head posture (tech neck).
  2. **Shoulder Tilt** — Measures vertical asymmetry between left and right shoulders. Detects lateral slouching.
  3. **Torso Lean** — Measures horizontal offset of shoulder midpoint from hip midpoint. Detects slumping forward or backward.
  - Weights: Forward Head (50%) + Shoulder Tilt (20%) + Torso Lean (30%) when hips are visible; Forward Head (70%) + Shoulder Tilt (30%) when hips are out of frame.
- **Skeleton Overlay**: Real-time skeleton visualization drawn on an HTML5 canvas, showing 12 key body connections (shoulders, elbows, wrists, hips, knees, ankles) with teal-colored joint markers.
- **Score Buffering**: Per-frame posture scores are averaged over 60-second windows before being sent to the backend, reducing noise and network overhead.

### Weeks 5–6: Behavior Logging & Activity Tracking

- **Per-Minute Behavior Snapshots**: Every 60 seconds, the frontend sends an averaged behavior snapshot to `POST /api/log` containing:
  - `posture_score` — Averaged posture score from the score buffer
  - `is_active` — Boolean flag based on keyboard/mouse activity within the last 60 seconds
  - `sitting_minutes` — Continuous sitting duration since the last break
  - `face_detected` — Whether the user is currently in frame
- **Sitting Duration Timer**: Tracks continuous sitting time in 15-second increments. Automatically resets when the user leaves the frame for an extended period.
- **Automatic Break Detection**: If the user is absent from the webcam frame for more than 15 minutes (`ABSENT_THRESHOLD_SECS = 900`), the system auto-logs a break to the backend and resets the sitting timer.
- **Activity Detection**: Monitors keyboard (`keydown`) and mouse (`mousemove`) events to determine if the user is actively working. A 60-second timeout classifies the user as idle.
- **Water Intake Logging**: Manual logging via the dashboard (default 250ml per entry), stored with timestamps in `water_log`.
- **Break Logging**: Manual and automatic break logging with duration tracking, stored in `break_log`.

### Weeks 7–8: Dashboard, Alerts & AI Recommendations

- **Health Score Dashboard**: Four radial score rings displaying real-time metrics:
  | Dimension | Weight | Data Source |
  |---|---|---|
  | Posture | 35% | MediaPipe pose score (12h average) |
  | Hydration | 20% | Water intake vs. 2000ml daily target |
  | Break Habit | 25% | Breaks taken vs. 6 expected per 12h session |
  | Activity Balance | 20% | Active minutes vs. total logged minutes |

- **Composite Health Score (0–100)**: Weighted average of all four dimensions, displayed as a large radial ring. This rule-based formula is the transparent stand-in for the Week 9–10 Random Forest model.

- **Interactive Dashboard Cards**:
  - 📊 **Posture Trend Chart** — Hourly posture score trend line for the current session
  - 🪑 **Sitting Duration Card** — Current sitting block duration with "I took a break" button
  - 💧 **Hydration Card** — Water intake progress bar with quick-log buttons
  - 📈 **Weekly Analytics** — 7-day posture trend with daily averages and sample counts

- **AI Recommendations Engine** (via n8n + Google Gemini):
  - **Automatic triggering**: When posture drops below 75% or sitting exceeds 30 minutes, the frontend automatically calls `GET /api/ai-recommendation` (with a 5-minute cooldown to avoid API rate limits).
  - **Manual "Ask Coach" button**: Users can request an on-demand AI recommendation at any time.
  - **n8n AI Agent Workflow**: The backend sends current metrics (posture score, sitting duration, water intake, alert type) to an n8n webhook. The n8n workflow uses a LangChain Agent node powered by Google Gemini to generate an empathetic, actionable, 1-sentence recommendation.

- **Smart Alert System** (via n8n + Twilio WhatsApp):
  - **Sustained Slouch Alert**: Triggered when the average posture score over the last 5 snapshots drops below 70%, with a 30-minute cooldown between alerts.
  - **Prolonged Sitting Alert**: Triggered at every 60-minute sitting milestone, with a 59-minute cooldown to prevent duplicates.
  - **WhatsApp Delivery**: Alerts are sent to the user's verified WhatsApp number via Twilio's WhatsApp Sandbox API.
  - **Phone Verification Flow**: Users enter their phone number in the Settings panel → backend generates a 6-digit OTP → n8n sends it via Twilio WhatsApp → user verifies the code in the dashboard.

- **Rule-Based Local Recommendations**: In addition to AI recommendations, the dashboard shows context-aware local tips:
  - Sitting > 60 min → "Take a 5-minute walk"
  - Posture < 60% → "Sit back, relax your shoulders"
  - Water < 1000ml → "Grab some water"
  - Last break > 90 min ago → "It's been over 90 minutes since your last break"

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Tauri v2 Desktop App                         │
│  ┌─────────────────────────┐    ┌────────────────────────────────┐  │
│  │    React + Vite (UI)    │    │  Python FastAPI (Sidecar)      │  │
│  │                         │    │                                │  │
│  │  Webcam → MediaPipe     │───▶│  POST /api/log (behavior)     │  │
│  │  Pose Landmarker        │    │  POST /api/water (hydration)  │  │
│  │  (in-browser inference) │    │  POST /api/break (breaks)     │  │
│  │                         │◀───│  GET  /api/today (dashboard)  │  │
│  │  Dashboard Components   │    │  GET  /api/weekly (analytics) │  │
│  │  Score Rings / Charts   │    │  GET  /api/ai-recommendation  │  │
│  └─────────────────────────┘    └──────────┬─────────────────────┘  │
│                                            │                        │
└────────────────────────────────────────────│────────────────────────┘
                                             │ HTTP Webhook
                                             ▼
                                  ┌────────────────────┐
                                  │   n8n (Docker)      │
                                  │                    │
                                  │  Webhook Trigger   │
                                  │       ▼            │
                                  │  AI Agent Node     │
                                  │  (Google Gemini)   │
                                  │       ▼            │
                                  │  ┌──────────────┐  │
                                  │  │ Respond JSON │  │
                                  │  │ Twilio WA    │  │
                                  │  │ Discord/Slack│  │
                                  │  └──────────────┘  │
                                  └────────────────────┘
                                             │
                                             ▼
                                  ┌────────────────────┐
                                  │  Twilio WhatsApp   │
                                  │  (Sandbox API)     │
                                  └────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Desktop Shell | Tauri v2 (Rust) | Native app packaging, sidecar process management |
| Frontend | React 18 + Vite | Dashboard UI, real-time data visualization |
| Styling | Vanilla CSS | Dark theme, glassmorphism, responsive grid layout |
| Computer Vision | MediaPipe Tasks Vision | In-browser pose landmark detection (33-point model) |
| Backend | FastAPI (Python 3.13) | REST API, data aggregation, health scoring |
| Database | SQLite | Local persistent storage (privacy-first) |
| AI Orchestration | n8n (self-hosted, Docker) | Workflow automation, LLM agent orchestration |
| AI Model | Google Gemini 3.5 Flash | Personalized wellness recommendations |
| Notifications | Twilio WhatsApp API | OTP verification, wellness alert delivery |

---

## 🚀 Setup & Installation

### Prerequisites

- Python 3.11+ with `pip`
- Node.js 18+ with `npm`
- Docker Desktop (for n8n)
- Twilio account with WhatsApp Sandbox enabled (optional, for notifications)
- Google AI API key (for Gemini-powered recommendations)

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# (Optional) Seed a week of realistic demo data
python seed_demo_data.py

# Start the API server
uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. Verify with `http://localhost:8000/api/health`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, allow camera access. The skeleton overlay and live posture score should appear within a few seconds.

> **Note**: First load fetches the MediaPipe model from Google's CDN (~a few MB). Do this once before any demo or presentation to cache the model for offline use.

### 3. n8n (AI Workflow Engine)

```bash
# Start n8n via Docker
docker run -d --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n
```

Open `http://localhost:5678`, import the workflow JSON files from the `n8n/` directory, and configure:
- **Google Gemini API key** in the Google Gemini Model node credentials
- **Twilio credentials** (Account SID, Auth Token) in the Twilio node credentials

> **Important**: Since n8n runs inside Docker, configure webhook URLs using `http://host.docker.internal:8000` instead of `http://localhost:8000` to reach your local backend.

### 4. Desktop App (Tauri — Optional)

```bash
cd src-tauri
cargo tauri dev       # Development mode
cargo tauri build     # Production .app / .dmg
```

---

## 📁 Project Structure

```
ai-habit-coach/
├── backend/
│   ├── main.py                  # FastAPI routes, health scoring, alert logic, n8n integration
│   ├── database.py              # SQLite schema, connection management, migrations
│   ├── seed_demo_data.py        # Populates a week of realistic demo data
│   └── requirements.txt         # Python dependencies (FastAPI, Uvicorn, Pydantic)
│
├── frontend/
│   └── src/
│       ├── App.jsx              # Main dashboard layout, state management, settings UI
│       ├── index.css             # Design system (dark theme, CSS variables, responsive grids)
│       ├── main.jsx             # React entry point
│       ├── components/
│       │   ├── WebcamView.jsx           # Camera + MediaPipe pose loop + skeleton overlay
│       │   ├── ScoreRing.jsx            # Radial SVG score gauge (animated)
│       │   ├── PostureTrendCard.jsx     # Hourly posture trend line chart
│       │   ├── SittingCard.jsx          # Sitting duration tracker + break button
│       │   ├── HydrationCard.jsx        # Water intake progress bar + log button
│       │   ├── WeeklyCard.jsx           # 7-day posture analytics chart
│       │   └── RecommendationsCard.jsx  # AI Coach bubble + local insights list
│       └── lib/
│           ├── posture.js       # Landmark → posture score algorithm (3 biomechanical metrics)
│           └── api.js           # Backend HTTP client (fetch wrapper)
│
├── n8n/
│   ├── workflow.json                    # Main AI coaching + alerting workflow
│   └── verification_workflow.json       # WhatsApp OTP verification workflow
│
├── src-tauri/
│   ├── src/lib.rs               # Tauri app setup, sidecar process lifecycle management
│   ├── tauri.conf.json          # Tauri configuration (window, bundle, sidecar binaries)
│   ├── Cargo.toml               # Rust dependencies
│   └── icons/                   # Application icons (icns, ico, png)
│
└── README.md
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/log` | Log a behavior snapshot (posture, activity, sitting time) |
| `POST` | `/api/water` | Log water intake (default 250ml) |
| `POST` | `/api/break` | Log a break (default 60 seconds) |
| `GET` | `/api/today` | Get today's aggregated stats, health score & recommendations |
| `GET` | `/api/weekly` | Get 7-day posture trend with daily averages |
| `GET` | `/api/ai-recommendation` | Fetch AI-generated recommendation via n8n + Gemini |
| `GET` | `/api/settings` | Get user settings (phone number, verification status) |
| `POST` | `/api/settings` | Save phone number & trigger WhatsApp OTP verification |
| `POST` | `/api/settings/verify` | Verify 6-digit OTP code |
| `GET` | `/api/health` | Health check endpoint |

---

## ⚠️ Known Limitations

- **Posture scoring** uses geometric heuristics (forward-head offset, shoulder tilt, torso lean), not clinically validated angle thresholds — suitable for relative trend tracking, not medical advice.
- **Activity detection** relies on keyboard/mouse event timeouts, not granular productivity measurement.
- **Health Score weights** (35/20/25/20) are a reasonable starting point — the Week 9–10 Random Forest model will optimize these based on labeled training data.
- **Single-user only** — local SQLite with no authentication, matching the "privacy-first, all data stays local" design principle.
- **Camera dependency** — Posture detection requires a webcam with clear upper-body visibility.

---

## 🔮 Next Steps (Weeks 9–12)

- **Random Forest Health Score**: Collect labeled sessions (self-rated comfort 1–5 alongside sensor data) to train a scikit-learn Random Forest regressor, replacing the rule-based weights.
- **ML Recommendation Engine**: Move from prompt-based Gemini recommendations to a fine-tuned model trained on wellness coaching data.
- **Cloud Sync** (optional): Add encrypted cloud backup for cross-device usage.
- **Wearable Integration**: Connect to smartwatch APIs for heart rate and step count data.

---

## 📄 License

This project is developed as part of an academic capstone project.
