import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function RecommendationsCard({ tips = [], aiTip, loading, onAsk }) {
  const [banditRec, setBanditRec] = useState(null);
  const [rewardStatus, setRewardStatus] = useState("");

  useEffect(() => {
    async function loadBandit() {
      try {
        const res = await api.getBanditRecommendation();
        if (res && res.recommendation) {
          setBanditRec(res.recommendation);
        }
      } catch (e) {
        console.warn("Bandit load error:", e);
      }
    }
    loadBandit();
  }, []);

  async function handleReward() {
    if (!banditRec) return;
    try {
      setRewardStatus("Logging reward...");
      await api.recordBanditReward(banditRec.id, 1.0);
      setRewardStatus("✓ Reward Logged (+1.0)");
      setTimeout(() => setRewardStatus(""), 4000);
    } catch (e) {
      setRewardStatus("Failed to log reward");
    }
  }

  return (
    <div className="card card-blue">
      <div className="card-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div className="card-title">🤖 AI Habit Coach</div>
          <div className="card-sub">Orchestrated by n8n.io & Google Gemini</div>
        </div>
        <button
          className="btn-log"
          onClick={onAsk}
          disabled={loading}
          style={{ marginTop: 0, padding: "6px 12px", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}
        >
          {loading ? "Thinking..." : "Ask Coach"}
        </button>
      </div>

      <div className="ai-coach-bubble" style={{
        background: "rgba(59, 130, 246, 0.08)",
        border: "1px dashed rgba(59, 130, 246, 0.3)",
        borderRadius: "8px",
        padding: "12px",
        fontSize: "13px",
        color: "#f4f7f5",
        marginBottom: "16px",
        lineHeight: "1.4",
        minHeight: "44px",
        display: "flex",
        alignItems: "center"
      }}>
        {loading ? (
          <span style={{ color: "#3b82f6", display: "flex", alignItems: "center", gap: 8 }}>
            <span className="spinner-dot" style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#3b82f6",
            }} />
            Consulting n8n AI model...
          </span>
        ) : aiTip ? (
          <span>"{aiTip}"</span>
        ) : (
          <span style={{ color: "#8ea19c" }}>Click "Ask Coach" to fetch custom guidance from the n8n AI agent.</span>
        )}
      </div>

      {/* Contextual Bandit RL Recommendation Box (Weeks 11–12) */}
      {banditRec && (
        <div style={{
          background: "rgba(168, 85, 247, 0.07)",
          border: "1px solid rgba(168, 85, 247, 0.25)",
          borderRadius: "8px",
          padding: "10px 12px",
          marginBottom: "14px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#c084fc", display: "flex", alignItems: "center", gap: "5px" }}>
              🎰 Contextual Bandit Personalized Nudge (RL)
            </span>
            <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>
              Pulls: {banditRec.pulls} · Q-Score: {banditRec.avg_reward}
            </span>
          </div>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#f4f7f5", marginBottom: "2px" }}>
            {banditRec.title}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.4" }}>
            {banditRec.description}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              type="button"
              onClick={handleReward}
              disabled={Boolean(rewardStatus)}
              style={{
                background: "rgba(168, 85, 247, 0.15)",
                border: "1px solid #a855f7",
                color: "#c084fc",
                borderRadius: "6px",
                padding: "3px 10px",
                fontSize: "11px",
                fontWeight: "700",
                cursor: rewardStatus ? "default" : "pointer"
              }}
            >
              {rewardStatus || "✓ I Followed This (+1 Reward)"}
            </button>
          </div>
        </div>
      )}

      <div className="card-title" style={{ fontSize: "13px", color: "#8ea19c", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
        🔔 Local Dashboard Insights
      </div>
      {tips.length > 0 ? (
        <ul className="tip-list">
          {tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: "13px", color: "#8ea19c", marginTop: "8px" }}>You're on track — keep up the good habits!</div>
      )}
    </div>
  );
}
