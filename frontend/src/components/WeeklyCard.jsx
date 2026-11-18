import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function WeeklyCard({ data }) {
  return (
    <div className="card card-green">
      <div className="card-title">📈 Weekly Analytics</div>
      <div className="card-sub">Multi-day posture trend</div>
      <div style={{ height: 160, marginTop: 12 }}>
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" stroke="#7d8b8a" fontSize={10} />
              <YAxis domain={[0, 100]} stroke="#7d8b8a" fontSize={11} width={28} />
              <Tooltip
                contentStyle={{ background: "#0d1512", border: "1px solid #1f2e2a", borderRadius: 8 }}
                labelStyle={{ color: "#f4f7f5" }}
              />
              <Bar dataKey="avg_posture" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state">Data builds up day over day — check back tomorrow.</div>
        )}
      </div>
    </div>
  );
}
