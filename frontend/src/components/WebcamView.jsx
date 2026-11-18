import { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { extractLandmarkMetrics, scorePosture } from "../lib/posture";
import { api } from "../lib/api";

const CONNECTIONS = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [24, 26], [26, 28],
];

const ABSENT_THRESHOLD_SECS = 900; // Time in frame absence before logging a break (15 minutes)

export default function WebcamView({ onLiveScore, onPostureStats, onBreakLogged, breakResetCount }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);

  const [status, setStatus] = useState("Loading pose model…");
  const [faceDetected, setFaceDetected] = useState(false);
  const [sittingMinutes, setSittingMinutes] = useState(0);
  const [liveAngle, setLiveAngle] = useState(null);

  // Personalized calibration baseline
  const [baseline, setBaseline] = useState(() => {
    try {
      const saved = localStorage.getItem("posture_calibration_baseline");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const baselineRef = useRef(baseline);

  useEffect(() => {
    baselineRef.current = baseline;
  }, [baseline]);

  const [isCalibratingSelf, setIsCalibratingSelf] = useState(false);
  const [calibrationCountdown, setCalibrationCountdown] = useState(3);
  const [calibrationSuccess, setCalibrationSuccess] = useState(false);
  const calibrationSamplesRef = useRef([]);
  const isCalibratingSelfRef = useRef(false);

  function startCalibration() {
    if (!faceDetectedRef.current) return;
    setIsCalibratingSelf(true);
    isCalibratingSelfRef.current = true;
    calibrationSamplesRef.current = [];
    setCalibrationCountdown(3);
    setCalibrationSuccess(false);

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      setCalibrationCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        finishCalibration();
      }
    }, 1000);
  }

  function finishCalibration() {
    isCalibratingSelfRef.current = false;
    setIsCalibratingSelf(false);

    const samples = calibrationSamplesRef.current;
    if (samples.length > 5) {
      const avgNoseEarDrop = samples.reduce((s, i) => s + i.noseEarDrop, 0) / samples.length;
      const avgForwardZ = samples.reduce((s, i) => s + i.forwardZ, 0) / samples.length;
      const avgShoulderTilt = samples.reduce((s, i) => s + i.shoulderTilt, 0) / samples.length;

      const newBaseline = {
        noseEarDrop: +avgNoseEarDrop.toFixed(4),
        forwardZ: +avgForwardZ.toFixed(4),
        shoulderTilt: +avgShoulderTilt.toFixed(4),
      };

      setBaseline(newBaseline);
      baselineRef.current = newBaseline;
      try {
        localStorage.setItem("posture_calibration_baseline", JSON.stringify(newBaseline));
      } catch (e) {
        console.warn("Failed to save calibration to localStorage:", e);
      }

      // Reset rolling buffers so new baseline applies cleanly immediately
      fiveMinBufferRef.current = [];
      minuteBucketsRef.current = {};
      sessionTrackingStartRef.current = Date.now();
      setCalibrationSuccess(true);
      setTimeout(() => setCalibrationSuccess(false), 3000);
    }
  }

  function resetCalibration() {
    setBaseline(null);
    baselineRef.current = null;
    try {
      localStorage.removeItem("posture_calibration_baseline");
    } catch (e) {}
    fiveMinBufferRef.current = [];
    minuteBucketsRef.current = {};
    sessionTrackingStartRef.current = Date.now();
  }

  const lastActiveRef = useRef(Date.now());
  const sittingMinutesRef = useRef(0);
  const faceDetectedRef = useRef(false);

  const lastFaceSeenRef = useRef(Date.now());
  const isUserPresentRef = useRef(true);

  const scoreBuffer = useRef([]);
  const fiveMinBufferRef = useRef([]);
  const minuteBucketsRef = useRef({});
  const sittingStart = useRef(Date.now());
  const sessionTrackingStartRef = useRef(Date.now());

  // Reset sitting timer and 5-min buffer when parent signals a break
  useEffect(() => {
    if (breakResetCount > 0) {
      console.log("Break signaled by parent. Resetting sitting block and 5-min buffer.");
      sittingStart.current = Date.now();
      sessionTrackingStartRef.current = Date.now();
      setSittingMinutes(0);
      isUserPresentRef.current = true;
      fiveMinBufferRef.current = [];
      minuteBucketsRef.current = {};
    }
  }, [breakResetCount]);

  useEffect(() => {
    sittingMinutesRef.current = sittingMinutes;
  }, [sittingMinutes]);

  useEffect(() => {
    faceDetectedRef.current = faceDetected;
  }, [faceDetected]);

  // Track keyboard/mouse activity
  useEffect(() => {
    const bump = () => { lastActiveRef.current = Date.now(); };
    window.addEventListener("keydown", bump);
    window.addEventListener("mousemove", bump);
    return () => {
      window.removeEventListener("keydown", bump);
      window.removeEventListener("mousemove", bump);
    };
  }, []);

  // Sitting timer
  useEffect(() => {
    const id = setInterval(() => {
      if (isUserPresentRef.current) {
        setSittingMinutes(Math.floor((Date.now() - sittingStart.current) / 60000));
      } else {
        setSittingMinutes(0);
      }
    }, 15000);
    return () => clearInterval(id);
  }, []);

  // Setup camera + model
  useEffect(() => {
    let stream;
    async function setup() {
      try {
        setStatus("Requesting camera access…");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        setStatus("Loading pose model…");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        let landmarker;
        try {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        } catch {
          console.warn("GPU delegate failed, falling back to CPU.");
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        }

        landmarkerRef.current = landmarker;
        setStatus("live");
        loop();
      } catch (err) {
        console.error(err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setStatus("Camera permission denied — please allow camera access and refresh.");
        } else if (err.name === "NotFoundError") {
          setStatus("No camera found — plug in a webcam and refresh.");
        } else {
          setStatus("Error: " + err.message);
        }
      }
    }
    setup();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
    };
  }, []);

  function loop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const result = landmarker.detectForVideo(video, performance.now());

    if (result.landmarks && result.landmarks.length > 0) {
      const lm = result.landmarks[0];

      if (!isUserPresentRef.current) {
        isUserPresentRef.current = true;
        sittingStart.current = Date.now();
        sessionTrackingStartRef.current = Date.now();
        setSittingMinutes(0);
        fiveMinBufferRef.current = [];
        minuteBucketsRef.current = {};
      }
      lastFaceSeenRef.current = Date.now();
      setFaceDetected(true);

      // Collect calibration samples if calibration is in progress
      if (isCalibratingSelfRef.current) {
        const sample = extractLandmarkMetrics(lm);
        if (sample) {
          calibrationSamplesRef.current.push(sample);
        }
      }

      const posture = scorePosture(lm, baselineRef.current);
      drawSkeleton(ctx, lm, canvas.width, canvas.height, posture);

      if (posture) {
        scoreBuffer.current.push(posture.score);
        setLiveAngle(posture.neckAngle);
        onLiveScore?.(posture.score);

        const now = Date.now();
        // Update 5-minute rolling buffer
        fiveMinBufferRef.current.push({
          timestamp: now,
          score: posture.score,
          neckAngle: posture.neckAngle,
          isGood: posture.isGood,
        });

        // Keep last 5 minutes (300,000 ms)
        const cutoff = now - 300000;
        fiveMinBufferRef.current = fiveMinBufferRef.current.filter((i) => i.timestamp >= cutoff);

        // Track minute-by-minute buckets for 1-to-5, 2-to-6, 3-to-7 sliding window
        const trackingElapsedMs = Math.max(0, now - sessionTrackingStartRef.current);
        const trackingElapsedSecs = Math.floor(trackingElapsedMs / 1000);
        const currentMinute = Math.floor(trackingElapsedSecs / 60) + 1;

        if (!minuteBucketsRef.current[currentMinute]) {
          minuteBucketsRef.current[currentMinute] = { scores: [], angles: [] };
        }
        minuteBucketsRef.current[currentMinute].scores.push(posture.score);
        minuteBucketsRef.current[currentMinute].angles.push(posture.neckAngle);

        const isCalibrating = trackingElapsedSecs < 300; // First 5 minutes

        if (isCalibrating) {
          // During the first 5 minutes: DO NOT show good or bad posture
          const remainingSecs = 300 - trackingElapsedSecs;
          const calibratingTimeLeft = `${Math.floor(remainingSecs / 60)}m ${String(remainingSecs % 60).padStart(2, "0")}s`;
          const calibratingProgress = `${Math.floor(trackingElapsedSecs / 60)}m ${String(trackingElapsedSecs % 60).padStart(2, "0")}s`;

          onPostureStats?.({
            liveAngle: posture.neckAngle,
            liveScore: posture.score,
            avgAngle: posture.neckAngle,
            avgScore: posture.score,
            goodPct: null, // Don't show good posture during first 5 mins
            badPct: null,  // Don't show bad posture during first 5 mins
            goodTimeStr: "--",
            badTimeStr: "--",
            isCalibrating: true,
            elapsedSecs: trackingElapsedSecs,
            calibratingTimeLeft,
            calibratingProgress,
            currentMinute,
            windowLabel: `Collecting Min 1–5 (Min ${currentMinute})`,
            isCalibrated: Boolean(baselineRef.current),
          });
        } else {
          // After first 5 minutes: compute sliding 5-minute average
          // completedMinutes: 5 -> Min 1-5, 6 -> Min 2-6, 7 -> Min 3-7, etc.
          const completedMinutes = Math.floor(trackingElapsedSecs / 60);
          const startMin = Math.max(1, completedMinutes - 4);
          const endMin = completedMinutes;
          const windowLabel = `Min ${startMin}–${endMin} Avg`;

          // Clean up old buckets
          Object.keys(minuteBucketsRef.current).forEach((key) => {
            if (parseInt(key, 10) < startMin) {
              delete minuteBucketsRef.current[key];
            }
          });

          // Aggregate scores and angles across the 5 minutes [startMin..endMin]
          let windowScores = [];
          let windowAngles = [];
          for (let m = startMin; m <= endMin; m++) {
            const b = minuteBucketsRef.current[m];
            if (b && b.scores.length > 0) {
              windowScores.push(...b.scores);
              windowAngles.push(...b.angles);
            }
          }

          if (windowScores.length === 0) {
            windowScores = fiveMinBufferRef.current.map((i) => i.score);
            windowAngles = fiveMinBufferRef.current.map((i) => i.neckAngle);
          }

          const totalSamples = windowScores.length;
          const avgScore = totalSamples > 0 ? Math.round(windowScores.reduce((a, b) => a + b, 0) / totalSamples) : posture.score;
          const avgAngle = totalSamples > 0 ? Math.round(windowAngles.reduce((a, b) => a + b, 0) / totalSamples) : posture.neckAngle;

          // Posture ratio is calculated from the 5-minute sliding window average
          const goodPct = Math.min(100, Math.max(0, avgScore));
          const badPct = 100 - goodPct;

          const goodSecs = Math.round((goodPct / 100) * 300);
          const badSecs = 300 - goodSecs;

          const goodTimeStr = `${Math.floor(goodSecs / 60)}m ${String(goodSecs % 60).padStart(2, "0")}s`;
          const badTimeStr = `${Math.floor(badSecs / 60)}m ${String(badSecs % 60).padStart(2, "0")}s`;

          onPostureStats?.({
            liveAngle: posture.neckAngle,
            liveScore: posture.score,
            avgAngle,
            avgScore,
            goodPct,
            badPct,
            goodTimeStr,
            badTimeStr,
            isCalibrating: false,
            elapsedSecs: 300,
            calibratingTimeLeft: "0m 00s",
            calibratingProgress: "5m 00s",
            currentMinute,
            startMin,
            endMin,
            windowLabel,
            isCalibrated: Boolean(baselineRef.current),
          });
        }
      }
    } else {
      setFaceDetected(false);
      setLiveAngle(null);

      if (isUserPresentRef.current) {
        const absentSecs = (Date.now() - lastFaceSeenRef.current) / 1000;
        if (absentSecs >= ABSENT_THRESHOLD_SECS) {
          isUserPresentRef.current = false;
          sittingStart.current = Date.now();
          setSittingMinutes(0);

          api.logBreak(Math.round(absentSecs))
            .then(() => onBreakLogged?.())
            .catch((e) => console.warn("Failed to auto-log break:", e.message));
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  // Push averaged snapshot to backend every 60s
  useEffect(() => {
    const id = setInterval(async () => {
      const buf = scoreBuffer.current;
      const hasFace = faceDetectedRef.current;

      if (buf.length === 0 && hasFace) return;

      const avg = buf.length > 0 ? buf.reduce((a, b) => a + b, 0) / buf.length : 0;
      scoreBuffer.current = [];

      const isActive = Date.now() - lastActiveRef.current < 60000;
      try {
        await api.logBehavior({
          posture_score: Math.round(avg),
          is_active: isActive,
          sitting_minutes: sittingMinutesRef.current,
          face_detected: hasFace,
        });
      } catch (e) {
        console.warn("Backend not reachable yet:", e.message);
      }
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // Background check for absence
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (isUserPresentRef.current) {
        const absentSecs = (Date.now() - lastFaceSeenRef.current) / 1000;
        if (absentSecs >= ABSENT_THRESHOLD_SECS) {
          isUserPresentRef.current = false;
          sittingStart.current = Date.now();
          setSittingMinutes(0);

          api.logBreak(Math.round(absentSecs))
            .then(() => onBreakLogged?.())
            .catch((e) => console.warn("Failed to auto-log break in background check:", e.message));
        }
      }
    }, 10000);
    return () => clearInterval(checkInterval);
  }, []);

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`webcam-card ${isExpanded ? "is-expanded" : ""}`}>
      <div className="webcam-header">
        <span>📷 Live Ergonomics Feed</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={startCalibration}
            disabled={isCalibratingSelf || !faceDetected}
            title={baseline ? "Click to recalibrate your baseline posture" : "Sit comfortably upright and click to calibrate"}
            style={{
              background: isCalibratingSelf
                ? "rgba(245, 158, 11, 0.2)"
                : calibrationSuccess
                ? "rgba(16, 185, 129, 0.25)"
                : baseline
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(45, 212, 191, 0.15)",
              border: `1px solid ${
                isCalibratingSelf
                  ? "#f59e0b"
                  : calibrationSuccess
                  ? "#10b981"
                  : baseline
                  ? "#10b981"
                  : "var(--teal)"
              }`,
              color: isCalibratingSelf
                ? "#f59e0b"
                : calibrationSuccess
                ? "#10b981"
                : baseline
                ? "#10b981"
                : "var(--teal)",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: "700",
              cursor: isCalibratingSelf || !faceDetected ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            {isCalibratingSelf
              ? `⏳ Hold Still (${calibrationCountdown}s)`
              : calibrationSuccess
              ? "✓ Calibrated!"
              : baseline
              ? "🎯 Recalibrate"
              : "🎯 Calibrate Posture"}
          </button>
          <span style={{ fontSize: "11px", fontWeight: "600", color: "#8ea19c", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "6px" }}>
            MediaPipe AI
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: "rgba(45, 212, 191, 0.12)",
              border: "1px solid var(--teal)",
              color: "var(--teal)",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            {isExpanded ? "✕ Minimize" : "⛶ Fullscreen / Popout"}
          </button>
        </div>
      </div>
      <div className="webcam-frame">
        <video ref={videoRef} style={{ display: "none" }} playsInline muted />
        <canvas ref={canvasRef} className="webcam-canvas" />
        {isCalibratingSelf && (
          <div className="webcam-overlay" style={{ background: "rgba(7, 12, 15, 0.8)", backdropFilter: "blur(3px)" }}>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "#f59e0b", marginBottom: "4px" }}>
              🎯 Calibrating Your Upright Posture
            </div>
            <div style={{ fontSize: "12px", color: "#f4f7f5" }}>
              Sit naturally upright facing your screen
            </div>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#2dd4bf", marginTop: "8px" }}>
              {calibrationCountdown}s
            </div>
          </div>
        )}
        {!isCalibratingSelf && !faceDetected && status === "live" && (
          <div className="webcam-overlay">Position yourself in frame</div>
        )}
        {!isCalibratingSelf && status !== "live" && <div className="webcam-overlay">{status}</div>}
      </div>
      <div className="webcam-meta" style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600" }}>
          <span className={`dot ${faceDetected ? "dot-live" : "dot-off"}`} />
          {faceDetected ? "Tracking posture" : "No pose detected"} · sitting {sittingMinutes}m
          {baseline && (
            <span style={{ fontSize: "11px", color: "#10b981", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16,185,129,0.3)", padding: "1px 6px", borderRadius: "4px" }}>
              ✓ Calibrated Baseline
            </span>
          )}
        </div>
        {baseline && (
          <button
            type="button"
            onClick={resetCalibration}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: "11px",
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0
            }}
          >
            Reset Baseline
          </button>
        )}
      </div>
    </div>
  );
}

function drawSkeleton(ctx, landmarks, w, h) {
  ctx.strokeStyle = "#2dd4bf";
  ctx.lineWidth = 2;
  CONNECTIONS.forEach(([a, b]) => {
    const p1 = landmarks[a];
    const p2 = landmarks[b];
    if (!p1 || !p2) return;
    ctx.beginPath();
    ctx.moveTo(p1.x * w, p1.y * h);
    ctx.lineTo(p2.x * w, p2.y * h);
    ctx.stroke();
  });
  ctx.fillStyle = "#10b981";
  landmarks.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 3, 0, 2 * Math.PI);
    ctx.fill();
  });
}
