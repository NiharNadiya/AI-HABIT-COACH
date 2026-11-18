export default function SittingCard({ minutes, onBreakLogged }) {
  const capped = Math.min(120, minutes);
  const pct = Math.round((capped / 120) * 100);
  const status = minutes >= 60 ? "Take a break soon" : minutes >= 30 ? "Getting close to a break" : "Fresh sitting block";

  return (
    <div className="card card-cyan">
      <div className="card-title">⏱ Sitting Timeline</div>
      <div className="card-sub">{minutes} min continuous · {status}</div>
      <div className="bar-track">
        <div className="bar-fill bar-fill-warn" style={{ width: `${pct}%` }} />
      </div>
      <button className="btn-log" onClick={onBreakLogged}>
        I took a break
      </button>
    </div>
  );
}
