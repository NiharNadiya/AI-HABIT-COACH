import { useCallback, useEffect, useRef, useState } from "react";
import WebcamView from "./components/WebcamView";
import ScoreRing from "./components/ScoreRing";
import FiveMinPostureCard from "./components/FiveMinPostureCard";
import HydrationAndBreakCard from "./components/HydrationAndBreakCard";
import RecommendationsCard from "./components/RecommendationsCard";
import VerificationPage from "./components/VerificationPage";
import { api } from "./lib/api";

export default function App() {
  const [today, setToday] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [liveScore, setLiveScore] = useState(null);
  const [postureStats, setPostureStats] = useState(null);
  const [backendOk, setBackendOk] = useState(true);
  const [aiTip, setAiTip] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [userGender, setUserGender] = useState("Male");
  const [userAge, setUserAge] = useState(25);
  const [phone, setPhone] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [showVerifyBox, setShowVerifyBox] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyStatus, setVerifyStatus] = useState("");
  const [breakResetCount, setBreakResetCount] = useState(0);

  // Routing View State: Remember if unlocked, otherwise prompt verification setup
  const [viewState, setViewState] = useState(() => {
    return localStorage.getItem("ai_coach_unlocked") === "true" ? "dashboard" : "verification";
  });

  const handleAskAICoach = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await api.getAIRecommendation();
      if (res && res.recommendation) {
        setAiTip(res.recommendation);
      } else {
        setAiTip("AI Habit Coach returned an empty response. Verify n8n setup.");
      }
    } catch (e) {
      setAiTip("Failed to connect to AI Habit Coach. Is the FastAPI server running?");
    } finally {
      setAiLoading(false);
    }
  }, []);

  // Fetch saved settings on page load
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await api.getSettings();
        if (res) {
          if (res.name) {
            setUserName(res.name);
          }
          if (res.gender) {
            setUserGender(res.gender);
          }
          if (res.age) {
            setUserAge(res.age);
          }
          if (res.phone_number) {
            setPhone(res.phone_number);
          }
          setIsVerified(res.is_verified === 1);
        }
      } catch (e) {
        console.warn("Failed to load user settings:", e.message);
      }
    }
    loadSettings();
  }, []);

  async function handleSaveSettings() {
    setSaveStatus("Sending code...");
    try {
      const res = await api.saveSettings({
        name: userName,
        gender: userGender,
        age: userAge,
        phone_number: phone
      });
      if (res && res.status === "verification_sent") {
        setSaveStatus("Code sent successfully!");
        setIsVerified(false);
        setShowVerifyBox(true);
      } else {
        setSaveStatus("Saved settings.");
      }
      setTimeout(() => setSaveStatus(""), 4000);
    } catch (e) {
      setSaveStatus("Failed to save.");
      setTimeout(() => setSaveStatus(""), 3000);
    }
  }

  async function handleVerifyOTP() {
    setVerifyStatus("Verifying...");
    try {
      const res = await api.verifyPhone(otp);
      if (res && res.status === "verified") {
        setIsVerified(true);
        setShowVerifyBox(false);
        setVerifyStatus("Verified successfully!");
        setOtp("");
        setTimeout(() => setVerifyStatus(""), 4000);
        refresh();
      }
    } catch (e) {
      setVerifyStatus("Invalid code. Try again.");
      setTimeout(() => setVerifyStatus(""), 4000);
    }
  }

  const refresh = useCallback(async () => {
    try {
      const [t, w] = await Promise.all([api.today(), api.weekly()]);
      setToday(t);
      setWeekly(w);
      setBackendOk(true);
    } catch (e) {
      setBackendOk(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const lastRequestedRef = useRef(0);

  useEffect(() => {
    if (!today) return;

    const now = Date.now();
    const isCalibrating = postureStats?.isCalibrating ?? true;
    const isSlouching = !isCalibrating && (
      (today.posture_avg > 0 && today.posture_avg < 70) ||
      (postureStats?.avgScore !== undefined && postureStats.avgScore < 70)
    );
    const isSittingTooLong = today.current_sitting_minutes >= 15;

    if (isSlouching || isSittingTooLong) {
      if (now - lastRequestedRef.current > 1800000) {
        lastRequestedRef.current = now;
        handleAskAICoach();
      }
    } else {
      setAiTip("You're maintaining a great posture and activity level! Keep it up.");
    }
  }, [today, liveScore, postureStats, handleAskAICoach]);

  async function handleBreak() {
    try {
      await api.logBreak(60);
      setBreakResetCount(prev => prev + 1);
      refresh();
    } catch (e) {
      console.warn(e.message);
    }
  }

  // 1. Loading Screen
  if (viewState === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#070c0f", color: "#2dd4bf" }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Loading AI Habit Coach...</div>
      </div>
    );
  }

  // 2. Verification Page (Shows if user is not verified or wants to re-verify)
  if (viewState === "verification") {
    return (
      <VerificationPage
        initialName={userName}
        initialGender={userGender}
        initialAge={userAge}
        initialPhone={phone}
        onVerified={() => {
          setIsVerified(true);
          localStorage.setItem("ai_coach_unlocked", "true");
          setViewState("dashboard");
          refresh();
        }}
        onSkip={() => {
          localStorage.setItem("ai_coach_unlocked", "true");
          setViewState("dashboard");
          refresh();
        }}
      />
    );
  }

  // 3. Main Dashboard Page (Shows after successful verification)
  const healthScore = today?.health_score ?? liveScore ?? 0;

  return (
    <div className="app">
      <header className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <span className="eyebrow">AI HABIT COACH</span>
          <h1>Workplace Wellness Dashboard</h1>
          <p className="subtitle">
            {backendOk
              ? `Welcome ${userName || 'User'} (${userGender}, age ${userAge}) — Personalized Ergonomics & Hydration`
              : "Connecting to Cloud Backend (Render free tier wakes up in ~30s on first load)..."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
          <span style={{
            fontSize: "11px",
            padding: "5px 12px",
            borderRadius: "14px",
            background: backendOk ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
            border: `1px solid ${backendOk ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)"}`,
            color: backendOk ? "#34d399" : "#fbbf24",
            fontWeight: "600",
            display: "inline-flex",
            alignItems: "center",
            gap: "7px"
          }}>
            <span style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: backendOk ? "#10b981" : "#f59e0b",
              boxShadow: backendOk ? "0 0 8px #10b981" : "0 0 8px #f59e0b"
            }}></span>
            {backendOk ? "Cloud Backend Online" : "Waking up Backend (~30s)..."}
          </span>

          <button
            onClick={() => setViewState("verification")}
            className="btn-log"
            style={{
              fontSize: "12px",
              background: "rgba(45, 212, 191, 0.08)",
              borderColor: "var(--teal)",
              color: "var(--teal)",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            🔒 {isVerified ? `Verified: ${phone || 'SMS Active'}` : "Profile & Verification"}
          </button>
        </div>
      </header>

      <div className="layout">
        <div className="left-col">
          <WebcamView 
            onLiveScore={setLiveScore}
            onPostureStats={setPostureStats}
            onBreakLogged={refresh} 
            breakResetCount={breakResetCount}
          />

          <button
            className="btn-log"
            onClick={() => setViewState("verification")}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "13px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              background: "rgba(45, 212, 191, 0.08)",
              borderColor: "var(--teal)",
              color: "var(--teal)",
              borderRadius: "12px"
            }}
          >
            ⚙️ Update Profile & Targets {isVerified && "✓"}
          </button>

          <div className="card card-score">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div className="card-title">🏆 Health Score</div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "#10b981",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  padding: "2px 8px",
                  borderRadius: "6px"
                }}
              >
                🌲 Random Forest ML (R²: 0.91)
              </span>
            </div>
            <ScoreRing value={healthScore} label="Overall wellness" color="#10b981" size={160} />
            <div style={{ marginTop: "10px", borderTop: "1px solid var(--border)", paddingTop: "8px", fontSize: "11px", color: "var(--text-dim)", textAlign: "center" }}>
              Non-linear ML prediction based on Posture, Sitting Fatigue & Recovery
            </div>
          </div>
        </div>

        <div className="right-col">
          {/* 5-Minute Posture Analytics Card */}
          <FiveMinPostureCard
            stats={postureStats}
            liveScore={liveScore}
          />

          {/* Combined Hydration & Break Actions Box */}
          <HydrationAndBreakCard
            waterMl={today?.water_ml ?? 0}
            targetMl={today?.hydration_target_ml ?? (userGender === "Female" ? 2000 : 2500)}
            sittingMinutes={today?.current_sitting_minutes ?? 0}
            onLogged={refresh}
            onBreakLogged={handleBreak}
          />

          <RecommendationsCard
            tips={today?.recommendations ?? []}
            aiTip={aiTip}
            loading={aiLoading}
            onAsk={handleAskAICoach}
          />
        </div>
      </div>

      <footer className="footer">
        AI Habit Coach · Weeks 1–4 prototype · Posture: MediaPipe (browser) · Backend: FastAPI + SQLite
      </footer>
    </div>
  );
}
