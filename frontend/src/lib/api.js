const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  logBehavior: (snapshot) => post("/api/log", snapshot),
  logWater: (ml = 250) => post("/api/water", { ml }),
  logBreak: (duration_seconds = 60) => post("/api/break", { duration_seconds }),
  today: () => get("/api/today"),
  weekly: () => get("/api/weekly"),
  getAIRecommendation: () => get("/api/ai-recommendation"),
  getSettings: () => get("/api/settings"),
  saveSettings: (settings) => post("/api/settings", settings),
  verifyPhone: (code) => post("/api/settings/verify", { code }),
  getDailyReport: () => get("/api/report/daily"),
  sendDailyReport: () => post("/api/report/daily/send", {}),
  getMLStatus: () => get("/api/ml/status"),
  getBanditRecommendation: () => get("/api/ml/bandit/recommendation"),
  recordBanditReward: (arm_id, reward = 1.0) => post("/api/ml/bandit/reward", { arm_id, reward }),
};
