// Landmark indices from MediaPipe Pose (33-point model)
const NOSE = 0;
const LEFT_EAR = 7;
const RIGHT_EAR = 8;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Extracts raw posture geometry metrics from a landmark frame.
 * Used for both live evaluation and averaging into a personalized baseline.
 */
export function extractLandmarkMetrics(landmarks) {
  if (!landmarks || landmarks.length < 25) return null;
  const nose = landmarks[NOSE];
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const rightShoulder = landmarks[RIGHT_SHOULDER];
  const leftEar = landmarks[LEFT_EAR];
  const rightEar = landmarks[RIGHT_EAR];

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const earMid = midpoint(leftEar, rightEar);
  const shoulderWidth = dist(leftShoulder, rightShoulder) || 0.001;

  const noseEarDrop = (nose.y - earMid.y) / shoulderWidth;
  const forwardZ = shoulderMid.z - earMid.z;
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y) / shoulderWidth;

  return { noseEarDrop, forwardZ, shoulderTilt };
}

/**
 * Estimates a 0-100 posture score and deviation angle from a single frame of pose landmarks.
 * If a calibrated baseline is provided, posture is scored relative to the user's calibrated
 * upright posture (eliminating camera tilt and anatomical variance).
 */
export function scorePosture(landmarks, baseline = null) {
  if (!landmarks || landmarks.length < 25) return null;

  const nose = landmarks[NOSE];
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const rightShoulder = landmarks[RIGHT_SHOULDER];
  const leftEar = landmarks[LEFT_EAR];
  const rightEar = landmarks[RIGHT_EAR];
  const leftHip = landmarks[LEFT_HIP];
  const rightHip = landmarks[RIGHT_HIP];

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const earMid = midpoint(leftEar, rightEar);
  const shoulderWidth = dist(leftShoulder, rightShoulder) || 0.001;

  const currentNoseEarDrop = (nose.y - earMid.y) / shoulderWidth;
  const currentForwardZ = shoulderMid.z - earMid.z;
  const currentShoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y) / shoulderWidth;

  // Use calibrated baseline if available, otherwise sensible default laptop values
  const baseNoseDrop = baseline?.noseEarDrop ?? 0.28;
  const baseForwardZ = baseline?.forwardZ ?? 0.05;
  const baseShoulderTilt = baseline?.shoulderTilt ?? 0.02;

  // 1. Head Pitch: deviation lower than calibrated upright baseline
  const pitchDelta = Math.max(0, currentNoseEarDrop - baseNoseDrop);
  const pitchFlexion = Math.max(0, pitchDelta / 0.20);

  // 2. Head Forward Depth: deviation forward from baseline
  const forwardDeltaZ = Math.max(0, currentForwardZ - baseForwardZ);
  const depthFlexion = Math.min(1.5, forwardDeltaZ / 0.15);

  // 3. Shoulder tilt asymmetry: deviation from baseline
  const tiltDelta = Math.max(0, currentShoulderTilt - baseShoulderTilt);
  const tiltFlexion = Math.min(1.5, tiltDelta / 0.12);

  // Check if hips are visible for torso lean penalty
  const hipsVisible = leftHip && rightHip && 
                      (leftHip.visibility === undefined || leftHip.visibility > 0.5) &&
                      (rightHip.visibility === undefined || rightHip.visibility > 0.5);

  let torsoFlexion = 0;
  if (hipsVisible) {
    const hipMid = midpoint(leftHip, rightHip);
    const torsoOffset = Math.abs(shoulderMid.x - hipMid.x) / shoulderWidth;
    torsoFlexion = Math.min(1, torsoOffset / 0.20);
  }

  // Calculate slouch deviation angle in degrees from calibrated baseline (0° = ideal calibrated upright)
  const neckAngle = Math.round(Math.min(90, pitchFlexion * 45 + depthFlexion * 30 + tiltFlexion * 15));

  // Comfortable upright threshold: deviation <= 14° is Good Posture
  const isGood = neckAngle <= 14;

  // Score aligns with angle: 0° deviation = 100%, 14° = 75%, drops below 70% as slouch increases
  const score = isGood
    ? Math.max(75, Math.round(100 - (neckAngle / 14) * 25))
    : Math.max(0, Math.round(75 - ((neckAngle - 14) / 36) * 75));

  return {
    score,
    neckAngle, // live deviation in degrees from calibrated baseline
    isGood,
    forwardOffset: +pitchFlexion.toFixed(3),
    shoulderTilt: +currentShoulderTilt.toFixed(3),
    torsoOffset: hipsVisible ? +torsoFlexion.toFixed(3) : 0,
    hipsVisible,
    isCalibrated: Boolean(baseline),
  };
}
