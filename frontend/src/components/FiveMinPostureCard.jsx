import React from "react";

export default function FiveMinPostureCard({ stats, liveScore }) {
  const isCalibrating = stats?.isCalibrating ?? true;
  const isCalibrated = stats?.isCalibrated ?? false;
  const windowLabel = stats?.windowLabel ?? (isCalibrating ? "Collecting Min 1–5" : "Min 1–5 Avg");
  const goodPct = stats?.goodPct;
  const badPct = stats?.badPct;
  const avgAngle = stats?.avgAngle ?? 0;
  const goodTimeStr = stats?.goodTimeStr ?? "--";
  const badTimeStr = stats?.badTimeStr ?? "--";
  const calibratingTimeLeft = stats?.calibratingTimeLeft ?? "5m 00s";
  const calibratingProgress = stats?.calibratingProgress ?? "0m 00s";
  const elapsedSecs = stats?.elapsedSecs ?? 0;

  const isGoodAvg = isCalibrating ? true : (avgAngle <= 14 || (goodPct !== null && goodPct >= 70));

  return (
    <div className="card card-green" style={{ position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⏱️ 5-Minute Posture Average</span>
          </div>
          <div className="card-sub">
            {isCalibrating
              ? `Collecting initial 5-minute baseline (${calibratingProgress} / 5m 00s)`
              : `Sliding 5-minute ergonomics window (${windowLabel})${isCalibrated ? " · Calibrated 🎯" : ""}`}
          </div>
        </div>
        <div
          style={{
            padding: "4px 10px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: "600",
            background: isCalibrating
              ? "rgba(45, 212, 191, 0.12)"
              : isGoodAvg
              ? "rgba(16, 185, 129, 0.15)"
              : "rgba(239, 68, 68, 0.15)",
            color: isCalibrating
              ? "var(--teal)"
              : isGoodAvg
              ? "#10b981"
              : "#ef4444",
            border: `1px solid ${
              isCalibrating
                ? "rgba(45, 212, 191, 0.3)"
                : isGoodAvg
                ? "rgba(16, 185, 129, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }`,
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <span style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: isCalibrating ? "var(--teal)" : isGoodAvg ? "#10b981" : "#ef4444",
            boxShadow: `0 0 6px ${isCalibrating ? "var(--teal)" : isGoodAvg ? "#10b981" : "#ef4444"}`
          }} />
          {isCalibrating ? `⏳ Calibrating (${calibratingTimeLeft} left)` : `${windowLabel}: ${avgAngle}°`}
        </div>
      </div>

      {/* 5-Min Stats Highlights */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "12px",
        marginTop: "16px",
        marginBottom: "16px"
      }}>
        {/* Angle Box */}
        <div style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "10px 12px",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>
            {isCalibrating ? "Live Slouch Angle" : `${windowLabel} Angle`}
          </div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: avgAngle <= 14 ? "var(--teal)" : "#f59e0b" }}>
            {avgAngle}°
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
            {isCalibrating ? "Calibrating..." : avgAngle <= 14 ? "Upright Alignment" : "Forward Slouch"}
          </div>
        </div>

        {/* Good Posture Box */}
        <div style={{
          background: isCalibrating ? "rgba(255, 255, 255, 0.02)" : "rgba(16, 185, 129, 0.04)",
          border: `1px solid ${isCalibrating ? "var(--border)" : "rgba(16, 185, 129, 0.2)"}`,
          borderRadius: "10px",
          padding: "10px 12px",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "11px", color: isCalibrating ? "var(--text-dim)" : "#10b981", fontWeight: "600", marginBottom: "4px" }}>
            🟢 Good Posture
          </div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: isCalibrating ? "var(--text-dim)" : "#10b981" }}>
            {isCalibrating ? "--" : `${goodPct}%`}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
            {isCalibrating ? "Available after 5m" : goodTimeStr}
          </div>
        </div>

        {/* Bad Posture Box */}
        <div style={{
          background: isCalibrating ? "rgba(255, 255, 255, 0.02)" : "rgba(239, 68, 68, 0.04)",
          border: `1px solid ${isCalibrating ? "var(--border)" : "rgba(239, 68, 68, 0.2)"}`,
          borderRadius: "10px",
          padding: "10px 12px",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "11px", color: isCalibrating ? "var(--text-dim)" : "#ef4444", fontWeight: "600", marginBottom: "4px" }}>
            🔴 Bad Posture
          </div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: isCalibrating ? "var(--text-dim)" : "#ef4444" }}>
            {isCalibrating ? "--" : `${badPct}%`}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
            {isCalibrating ? "Available after 5m" : badTimeStr}
          </div>
        </div>
      </div>

      {/* Dual Progress Bar / Calibration Bar */}
      <div style={{ marginTop: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
          <span style={{ color: isCalibrating ? "var(--teal)" : "#10b981", fontWeight: "600" }}>
            {isCalibrating ? `Baseline Collection (${calibratingProgress} / 5m 00s)` : `Good Posture (${goodPct}%)`}
          </span>
          <span style={{ color: isCalibrating ? "var(--text-dim)" : "#ef4444", fontWeight: "600" }}>
            {isCalibrating ? `Unlocks in ${calibratingTimeLeft}` : `Bad Posture (${badPct}%)`}
          </span>
        </div>
        <div style={{
          height: "10px",
          borderRadius: "999px",
          background: isCalibrating ? "rgba(255, 255, 255, 0.05)" : "rgba(239, 68, 68, 0.3)",
          overflow: "hidden",
          display: "flex",
          border: "1px solid rgba(255,255,255,0.05)"
        }}>
          <div style={{
            width: `${isCalibrating ? Math.min(100, Math.round((elapsedSecs / 300) * 100)) : (goodPct ?? 100)}%`,
            height: "100%",
            background: "linear-gradient(90deg, #10b981, #2dd4bf)",
            borderRadius: isCalibrating || goodPct === 100 ? "999px" : "999px 0 0 999px",
            transition: "width 0.5s ease"
          }} />
          {!isCalibrating && badPct !== null && (
            <div style={{
              width: `${badPct}%`,
              height: "100%",
              background: "linear-gradient(90deg, #ef4444, #f87171)",
              borderRadius: badPct === 100 ? "999px" : "0 999px 999px 0",
              transition: "width 0.5s ease"
            }} />
          )}
        </div>
      </div>
    </div>
  );
}
