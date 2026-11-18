import { api } from "../lib/api";

export default function HydrationCard({ waterMl, targetMl, onLogged }) {
  const pct = Math.min(100, Math.round((waterMl / targetMl) * 100));

  async function logGlass() {
    try {
      await api.logWater(250);
      onLogged?.();
    } catch (e) {
      console.warn(e.message);
    }
  }

  return (
    <div className="card card-blue">
      <div className="card-title">💧 Hydration Progress</div>
      <div className="card-sub">
        {waterMl}ml / {targetMl}ml goal
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <button className="btn-log" onClick={logGlass}>
        + Log 250ml glass
      </button>
    </div>
  );
}
