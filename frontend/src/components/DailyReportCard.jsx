import { useState, useEffect } from "react";
import { api } from "../lib/api";

export default function DailyReportCard({ userName }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sendStatus, setSendStatus] = useState("");

  async function fetchReport() {
    try {
      const data = await api.getDailyReport();
      setReport(data);
    } catch (e) {
      console.warn("Failed to fetch daily report:", e.message);
    }
  }

  useEffect(() => {
    fetchReport();
    const id = setInterval(fetchReport, 30000);
    return () => clearInterval(id);
  }, []);

  async function handleSendReport() {
    setLoading(true);
    setSendStatus("Sending report to WhatsApp...");
    try {
      const res = await api.sendDailyReport();
      if (res && res.status === "sent") {
        setSendStatus("Daily Report sent to WhatsApp!");
      } else {
        setSendStatus(res.message || "Failed to send report.");
      }
      setTimeout(() => setSendStatus(""), 4000);
    } catch (e) {
      setSendStatus("Failed to send report via n8n.");
      setTimeout(() => setSendStatus(""), 4000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card card-green" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="card-title">📑 Daily Wellness Report</div>
          <div className="card-sub">Automated summary & WhatsApp export</div>
        </div>
        <button
          className="btn-log"
          onClick={handleSendReport}
          disabled={loading}
          style={{
            marginTop: 0,
            fontSize: "11px",
            background: "rgba(16, 185, 129, 0.1)",
            borderColor: "var(--green)",
            color: "var(--green)",
            fontWeight: "700",
            padding: "6px 12px"
          }}
        >
          {loading ? "Sending..." : "📱 Send Report via WhatsApp"}
        </button>
      </div>

      {/* Report Summary Data */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
        gap: "10px",
        marginTop: "4px"
      }}>
        <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: "8px", textAlign: "center" }}>
          <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>User</div>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "#f4f7f5", marginTop: "2px" }}>
            {report?.name || userName || "User"}
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: "8px", textAlign: "center" }}>
          <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>Posture Avg</div>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--teal)", marginTop: "2px" }}>
            {report?.posture_avg ?? 0}%
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: "8px", textAlign: "center" }}>
          <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>Water Intake</div>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--cyan)", marginTop: "2px" }}>
            {report?.water_ml ?? 0}ml
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: "8px", textAlign: "center" }}>
          <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>Breaks</div>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--blue)", marginTop: "2px" }}>
            {report?.breaks_count ?? 0}
          </div>
        </div>
      </div>

      {sendStatus && (
        <div style={{
          fontSize: "11px",
          color: sendStatus.includes("Failed") || sendStatus.includes("error") ? "#ef4444" : "#10b981",
          textAlign: "center"
        }}>
          {sendStatus}
        </div>
      )}
    </div>
  );
}
