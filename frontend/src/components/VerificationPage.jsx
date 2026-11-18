import { useState } from "react";
import { api } from "../lib/api";

export default function VerificationPage({ initialName, initialGender, initialAge, initialPhone, onVerified, onSkip }) {
  const [name, setName] = useState(initialName || "");
  const [gender, setGender] = useState(initialGender || "Male");
  const [age, setAge] = useState(initialAge || 25);
  const [phone, setPhone] = useState(initialPhone || "");
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  async function handleSendCode(e) {
    e?.preventDefault();
    if (!name || name.trim().length < 2) {
      setStatus("Please enter your full name.");
      return;
    }
    if (!phone || phone.trim().length < 8) {
      setStatus("Please enter a valid phone number with country code (e.g. +919106733220)");
      return;
    }

    setLoading(true);
    setStatus("Saving profile & sending 6-digit code via WhatsApp...");
    try {
      const res = await api.saveSettings({
        name: name.trim(),
        gender,
        age: parseInt(age, 10) || 25,
        phone_number: phone.trim()
      });
      if (res && res.status === "verification_sent") {
        setCodeSent(true);
        setStatus(`Verification code sent to ${phone.trim()} on WhatsApp!`);
      } else {
        setStatus("Settings saved. Please enter the verification code.");
        setCodeSent(true);
      }
    } catch (err) {
      console.error(err);
      setStatus("Failed to send code. Make sure FastAPI backend is running.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e) {
    e?.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setStatus("Please enter the 6-digit code sent to your phone.");
      return;
    }

    setLoading(true);
    setStatus("Verifying code...");
    try {
      const res = await api.verifyPhone(otp.trim());
      if (res && res.status === "verified") {
        setVerifiedSuccess(true);
        setStatus("Profile & phone number verified successfully!");
        setTimeout(() => {
          onVerified?.();
        }, 1200);
      } else {
        setStatus("Invalid code. Please check and try again.");
      }
    } catch (err) {
      console.error(err);
      setStatus("Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "radial-gradient(ellipse at top, rgba(45, 212, 191, 0.12), transparent 60%), radial-gradient(ellipse at bottom, rgba(16, 185, 129, 0.08), transparent 60%), #070c0f"
    }}>
      <div style={{
        maxWidth: "480px",
        width: "100%",
        background: "#0d1512",
        border: "1px solid #1f2e2a",
        borderRadius: "20px",
        padding: "36px 30px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        textAlign: "center",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Glow accent */}
        <div style={{
          position: "absolute",
          top: "-60px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "200px",
          height: "120px",
          background: "radial-gradient(ellipse, rgba(45, 212, 191, 0.3), transparent 70%)",
          pointerEvents: "none"
        }} />

        <div className="eyebrow" style={{ marginBottom: "16px" }}>AI HABIT COACH REGISTRATION</div>

        <h1 style={{ fontSize: "24px", fontWeight: "800", margin: "0 0 10px", color: "#f4f7f5" }}>
          {verifiedSuccess ? "🎉 Profile & Phone Verified!" : "User Profile & Ergonomic Target Setup"}
        </h1>

        <p style={{ fontSize: "13px", color: "#8ea19c", margin: "0 0 24px", lineHeight: "1.6" }}>
          {verifiedSuccess
            ? "Redirecting you to the Workplace Wellness Dashboard..."
            : "We customize your hydration and posture break targets per WHO/ISO guidelines based on your Gender & Age."}
        </p>

        {verifiedSuccess ? (
          <div style={{ padding: "20px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "12px", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
            <div style={{ color: "#10b981", fontWeight: "700", fontSize: "15px" }}>Welcome, {name}!</div>
            <div style={{ color: "#8ea19c", fontSize: "12px", marginTop: "4px" }}>Launching personalized dashboard...</div>
          </div>
        ) : (
          <div style={{ textAlign: "left" }}>
            {/* Step 1: User Profile & Mobile Input */}
            <form onSubmit={handleSendCode}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#f4f7f5", marginBottom: "6px" }}>
                  👤 Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nihar Nadiya"
                  disabled={codeSent && loading}
                  style={{
                    width: "100%",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid #1f2e2a",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    color: "#f4f7f5",
                    fontSize: "14px",
                    outline: "none"
                  }}
                />
              </div>

              {/* Gender & Age Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#f4f7f5", marginBottom: "6px" }}>
                    ⚤ Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    disabled={codeSent && loading}
                    style={{
                      width: "100%",
                      background: "#070c0f",
                      border: "1px solid #1f2e2a",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      color: "#f4f7f5",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  >
                    <option value="Male">Male (~2500ml water)</option>
                    <option value="Female">Female (~2000ml water)</option>
                    <option value="Other">Other (~2250ml water)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#f4f7f5", marginBottom: "6px" }}>
                    🎂 Age (years)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    disabled={codeSent && loading}
                    style={{
                      width: "100%",
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid #1f2e2a",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      color: "#f4f7f5",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#f4f7f5", marginBottom: "6px" }}>
                  📱 Mobile Phone Number (with Country Code)
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +919106733220"
                    disabled={codeSent && loading}
                    style={{
                      flex: 1,
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid #1f2e2a",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      color: "#f4f7f5",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-log"
                    style={{
                      marginTop: 0,
                      background: "linear-gradient(90deg, #10b981, #2dd4bf)",
                      border: "none",
                      color: "#070c0f",
                      fontWeight: "700",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      cursor: "pointer"
                    }}
                  >
                    {codeSent ? "Resend" : "Send OTP"}
                  </button>
                </div>
              </div>
            </form>

            {/* Step 2: 6-Digit OTP Code Input */}
            {codeSent && (
              <form onSubmit={handleVerifyOTP} style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #1f2e2a" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#2dd4bf", marginBottom: "6px" }}>
                  🔒 Enter 6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  style={{
                    width: "100%",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(45, 212, 191, 0.3)",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    color: "#f4f7f5",
                    fontSize: "18px",
                    fontWeight: "800",
                    letterSpacing: "8px",
                    textAlign: "center",
                    outline: "none",
                    marginBottom: "16px"
                  }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    background: "linear-gradient(90deg, #2dd4bf, #3b82f6)",
                    border: "none",
                    color: "#070c0f",
                    fontWeight: "800",
                    fontSize: "14px",
                    padding: "12px",
                    borderRadius: "10px",
                    cursor: "pointer"
                  }}
                >
                  {loading ? "Verifying..." : "Verify & Launch Dashboard"}
                </button>
              </form>
            )}

            {/* Status Notification */}
            {status && (
              <div style={{
                marginTop: "16px",
                padding: "10px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                textAlign: "center",
                background: status.includes("Failed") || status.includes("Invalid") ? "rgba(239, 68, 68, 0.1)" : "rgba(45, 212, 191, 0.1)",
                color: status.includes("Failed") || status.includes("Invalid") ? "#ef4444" : "#2dd4bf",
                border: `1px solid ${status.includes("Failed") || status.includes("Invalid") ? "rgba(239,68,68,0.2)" : "rgba(45,212,191,0.2)"}`
              }}>
                {status}
              </div>
            )}

            {/* Skip Option for Demo */}
            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <button
                type="button"
                onClick={onSkip}
                style={{
                  background: "none",
                  border: "none",
                  color: "#8ea19c",
                  fontSize: "12px",
                  cursor: "pointer",
                  textDecoration: "underline"
                }}
              >
                Skip verification & continue to dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
