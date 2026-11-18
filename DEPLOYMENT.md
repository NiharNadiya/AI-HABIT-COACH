# 🚀 Cloud Deployment Guide — AI Habit Coach

This guide details how to deploy **AI Habit Coach** live on the web so anyone can access it via a public HTTPS URL.

---

## 🏗️ Cloud Architecture

```
┌─────────────────────────────────┐
│     Frontend (Vercel / Netlify) │  👉 https://ai-habit-coach.vercel.app
│     React 18 + MediaPipe Vision │     (Client-side webcam inference via HTTPS)
└────────────────┬────────────────┘
                 │ HTTP (REST)
                 ▼
┌─────────────────────────────────┐
│      Backend (Render / Railway) │  👉 https://ai-habit-coach-api.onrender.com
│      FastAPI + SQLite + ML      │     (Random Forest & Contextual Bandit)
└────────────────┬────────────────┘
                 │ Webhook
                 ▼
┌─────────────────────────────────┐
│       n8n (Railway / Docker)    │  👉 https://n8n-production.up.railway.app
│       Google Gemini AI Agent    │     (WhatsApp Alerts via Twilio)
└─────────────────────────────────┘
```

> [!IMPORTANT]
> **Webcam Permission Requirement**: Web browsers (Chrome, Safari, Firefox) **require HTTPS** to grant webcam camera access. Deploying the frontend to Vercel/Netlify provides free automatic SSL (HTTPS) out of the box!

---

## ⚡ Recommended Free Cloud Setup

| Component | Platform | Plan |
|---|---|---|
| **Frontend** | [Vercel](https://vercel.com) | Free (Hobby) |
| **Backend** | [Render](https://render.com) | Free Web Service |
| **n8n Workflow** | [Railway](https://railway.app) / [Render](https://render.com) | Free / Starter |

---

## Step 1: Deploy Backend to Render

1. Push your repository to **GitHub**.
2. Sign up / Log in to [Render](https://dashboard.render.com).
3. Click **New +** $\rightarrow$ **Web Service**.
4. Connect your GitHub repository:
   - **Name**: `ai-habit-coach-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Under **Environment Variables**, add:
   - `PYTHON_VERSION`: `3.11.9`
   - `CORS_ORIGINS`: `*`
   - `N8N_WEBHOOK_URL`: `(Your n8n webhook URL from Step 3)`
6. Click **Create Web Service**.
7. Once deployed, copy your backend URL:
   `https://ai-habit-coach-backend.onrender.com`

---

## Step 2: Deploy Frontend to Vercel

1. Log in to [Vercel](https://vercel.com).
2. Click **Add New…** $\rightarrow$ **Project**.
3. Select your GitHub repository.
4. Configure Project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`frontend`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand **Environment Variables**:
   - **Key**: `VITE_API_URL`
   - **Value**: Your Render backend URL (e.g. `https://ai-habit-coach-backend.onrender.com`)
6. Click **Deploy**.
7. In ~30 seconds, your frontend will be live at `https://your-project.vercel.app`!

---

## Step 3: Deploy n8n (AI Agent & WhatsApp)

### Option A: 1-Click Railway Deployment (Fastest)
1. Go to [Railway n8n Template](https://railway.app/template/n8n).
2. Click **Deploy Now**.
3. Once deployed, open your n8n dashboard URL (e.g. `https://n8n-production.up.railway.app`).
4. Import your workflows from the repository:
   - `n8n/workflow.json`
   - `n8n/verification_workflow.json`
5. Configure credentials in n8n:
   - **Google Gemini API Key** (in the Google Gemini node)
   - **Twilio Account SID & Auth Token** (in the Twilio WhatsApp node)
6. Activate both workflows.
7. Copy the production Webhook URL into your Render backend's `N8N_WEBHOOK_URL` environment variable.

---

## 🎯 Verification Checklist

- [ ] Frontend opens with HTTPS lock icon: `https://your-app.vercel.app`
- [ ] Browser prompts for Camera permission and skeleton overlay appears
- [ ] Posture calibration button works (`🎯 Calibrate Posture`)
- [ ] "+ Log 250ml Glass" and "I Took a Break" update state instantly
- [ ] "Ask Coach" communicates with the cloud n8n webhook and returns Gemini advice
- [ ] Health score displays `🌲 Random Forest ML (R²: 0.91)`
