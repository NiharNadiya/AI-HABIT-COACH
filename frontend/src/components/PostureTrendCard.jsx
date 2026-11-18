import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function PostureTrendCard({ data }) {
  return (
    <div className="card card-green">
      <div className="card-title">📊 Posture Trend</div>
      <div className="card-sub">Hourly posture quality</div>
      <div style={{ height: 160, marginTop: 12 }}>
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="hour" stroke="#7d8b8a" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#7d8b8a" fontSize={11} width={28} />
              <Tooltip
                contentStyle={{ background: "#0d1512", border: "1px solid #1f2e2a", borderRadius: 8 }}
                labelStyle={{ color: "#f4f7f5" }}
              />
              <Line type="monotone" dataKey="score" stroke="#2dd4bf" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state">Not enough data yet — keep the camera on for a few minutes.</div>
        )}
      </div>
    </div>
  );
}
