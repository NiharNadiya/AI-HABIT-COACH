import { api } from "../lib/api";

export default function HydrationAndBreakCard({ waterMl, targetMl, sittingMinutes, onLogged, onBreakLogged }) {
  const waterPct = Math.min(100, Math.round((waterMl / targetMl) * 100));

  const cappedSitting = Math.min(120, sittingMinutes);
  const sittingPct = Math.round((cappedSitting / 120) * 100);
  const sittingStatus = sittingMinutes >= 60 ? "Take a break soon" : sittingMinutes >= 30 ? "Getting close to a break" : "Fresh sitting block";

  async function logGlass() {
    try {
      await api.logWater(250);
      onLogged?.();
    } catch (e) {
      console.warn(e.message);
    }
  }

  return (
    <div className="card card-blue" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="card-title">💧 Hydration & Movement Actions</div>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Hydration Section */}
        <div style={{
          background: "rgba(34, 211, 238, 0.04)",
          border: "1px solid rgba(34, 211, 238, 0.2)",
          borderRadius: "10px",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          justify: "space-between"
        }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--cyan)", marginBottom: "2px" }}>
              💧 Hydration Goal
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>
              {waterMl}ml / {targetMl}ml goal
            </div>
            <div className="bar-track" style={{ marginTop: "10px" }}>
              <div className="bar-fill" style={{ width: `${waterPct}%` }} />
            </div>
          </div>
          <button className="btn-log" onClick={logGlass} style={{ marginTop: "12px", width: "100%", textAlign: "center" }}>
            + Log 250ml Glass
          </button>
        </div>

        {/* Sitting / Break Section */}
        <div style={{
          background: "rgba(45, 212, 191, 0.04)",
          border: "1px solid rgba(45, 212, 191, 0.2)",
          borderRadius: "10px",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          justify: "space-between"
        }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--teal)", marginBottom: "2px" }}>
              ⏱️ Sitting Timeline
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>
              {sittingMinutes}m continuous · {sittingStatus}
            </div>
            <div className="bar-track" style={{ marginTop: "10px" }}>
              <div className="bar-fill bar-fill-warn" style={{ width: `${sittingPct}%` }} />
            </div>
          </div>
          <button className="btn-log" onClick={onBreakLogged} style={{ marginTop: "12px", width: "100%", textAlign: "center" }}>
            🚶‍♂️ I Took a Break
          </button>
        </div>
      </div>
    </div>
  );
}
