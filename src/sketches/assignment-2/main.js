import p5 from "p5";
import ml5 from "ml5";
import Matter from "matter-js";

new p5((p) => {
const W = 640;
const H = 480;

const HOLD_FRAMES = 5; // how long to hold on the previous frames if the body disappears
const MAX_MISSING = 30;

  // const VIDEO_W = 480; // use this small video for pose detection
  // const VIDEO_H = 240;
  
  const COUNTDOWN_SECS = 30;
  const FROZEN_SECS = 5;
  const BONE_THICKNESS = 8;
  const HEAD_CIRCLE_BUFFER_LENGTH = 10 //frames

  const SKELETON_CONNECTIONS = [
    [0,1],[0,2],[1,3],[2,4],[5,6],[5,7],[7,9],[6,8],[8,10],
    [5,11],[6,12],[11,12],[11,13],[13,15],[12,14],[14,16],
  ];

  let video;
  let bodyPose;
  let poses = [];
  let cameraReady = false;
  let modelReady = false;
  let statusMessage = "Requesting camera access...";
  
  // Full-body tracking: true when head + hips + ankles are all visible
  let fullBodyInView = false;
  // Approximate pixel height from nose to mid-ankle
  let bodyHeight = 0;
  // Circle bounding the head { x, y, radius }, or null
  let headCircle = null;
  let lastGoodHeadCircle = null;
  let smoothedHeadCircle = null;

  function updateBodyStats(pose) {
    if (!pose) { fullBodyInView = false; bodyHeight = 0; smoothedHeadCircle = null; return; }
    const kp = pose.keypoints;
    const confident = (i) => kp[i].confidence > 0.5;

    const hasHead = confident(0);
    const hasHip = confident(11) || confident(12);
    const hasAnkle = confident(15) || confident(16);
    fullBodyInView = hasHead && hasHip && hasAnkle;

    if (fullBodyInView) {
      const visibleAnkles = [15, 16].filter(confident);
      const ankleY = visibleAnkles.reduce((s, i) => s + kp[i].y, 0) / visibleAnkles.length;
      bodyHeight = ankleY - kp[0].y;
    } else {
      bodyHeight = 0;
    }
    if (hasHead) {
      // Radius from ear-to-ear width; fall back to a fraction of bodyHeight
      const visibleEars = [3, 4].filter(confident);
      let radius;
      if (visibleEars.length === 2) {
        radius = Math.hypot(kp[3].x - kp[4].x, kp[3].y - kp[4].y) * 0.7;
      } else if (visibleEars.length === 1) {
        radius = Math.hypot(kp[0].x - kp[visibleEars[0]].x, kp[0].y - kp[visibleEars[0]].y) * 1.4;
      } else {
        radius = bodyHeight > 0 ? bodyHeight * 0.12 : 50;
      }
      headCircle = { x: kp[0].x, y: kp[0].y, radius }
      const displayHeadCircle = updateSmoothedHeadCircle(headCircle);

      if (displayHeadCircle) {
        drawHeadCircle(displayHeadCircle);
      }
      
    }
  }

  function smoothValue(previous, current, alpha, deadzone = 0) {
    if (!Number.isFinite(current)) return previous;
    if (previous === null || previous === undefined) return current;
    const diff = current - previous;
    if (Math.abs(diff) < deadzone) {
      return previous;
    }
    return previous + diff * alpha;

  }

function smoothCircleToward(targetCircle) {
  if (!targetCircle) return smoothedHeadCircle;
  if (!smoothedHeadCircle) {
    smoothedHeadCircle = { ...targetCircle };
    return smoothedHeadCircle;
  }
  smoothedHeadCircle.x = smoothValue(smoothedHeadCircle.x, targetCircle.x, 0.22, 3);
  smoothedHeadCircle.y = smoothValue(smoothedHeadCircle.y, targetCircle.y, 0.22, 3);
  smoothedHeadCircle.radius = smoothValue(smoothedHeadCircle.radius, targetCircle.radius, 0.12, 2);
  return smoothedHeadCircle;

}

function updateSmoothedHeadCircle(currentHeadCircle) {
  const hasGoodHead =
    currentHeadCircle &&
    Number.isFinite(currentHeadCircle.x) &&
    Number.isFinite(currentHeadCircle.y) &&
    Number.isFinite(currentHeadCircle.radius);
  if (hasGoodHead) {
    let missingHeadFrames = 0;
    lastGoodHeadCircle = { ...currentHeadCircle };
    // Smooth toward the newly detected position.
    return smoothCircleToward(lastGoodHeadCircle);
  }

  // No valid pose/head this frame.

  missingHeadFrames++;
  if (missingHeadFrames <= HOLD_FRAMES) {
    // Brief dropout: hold the existing smoothed circle.
    return smoothedHeadCircle;
  }

  if (missingHeadFrames <= MAX_MISSING && lastGoodHeadCircle) {
    // Longer dropout: still keep it around.
    // Maybe shrink/fade here
    return smoothedHeadCircle;
  }

  // Pose has been gone too long. Reset so the next detection starts fresh.
  smoothedHeadCircle = null;
  lastGoodHeadCircle = null;

  return null;

}

  function updateBuffer(buffer, value) {
  buffer.push(value);

  if (buffer.length > HEAD_CIRCLE_BUFFER_LENGTH) {
    buffer.shift();
  }
  if (buffer.length === 0) return 0;
}

function avgHeadCircle(buffer) {
  if (buffer.length === 0) return null;

  const sum = buffer.reduce(
    (acc, v) => ({
      x: acc.x + v.x,
      y: acc.y + v.y,
      radius: acc.radius + v.radius,
    }),
    { x: 0, y: 0, radius: 0 }
  );

  return {
    x: sum.x / buffer.length,
    y: sum.y / buffer.length,
    radius: sum.radius / buffer.length,
  };
}

  function drawHeadCircle(hc) {
    if (!hc) return;
    p.noFill();
    p.stroke(250, 250, 0);
    p.strokeWeight(3);
    p.circle(hc.x, hc.y, hc.radius * 2);
  }

  let startTime = null;
  let frozenPhaseStart = null;
  let frozenPose = null;
  let frozenHeadCircle = null;
  let matterEngine = null;
  let boneBodies = [];
  let headBoundaryBodies = [];

  p.setup = () => {
    p.createCanvas(W, H);

    bodyPose = ml5.bodyPose("MoveNet", { flipped: true }, () => {
      modelReady = true;
      statusMessage = cameraReady ? "" : statusMessage;
      if (cameraReady) bodyPose.detectStart(video, (results) => { poses = results; });
    });

    video = p.createCapture(p.VIDEO, { flipped: true }, () => {
      // console.log(video.size)
      cameraReady = true;
      statusMessage = "Loading model...";
      if (modelReady) bodyPose.detectStart(video, (results) => { poses = results; });
    });
    video.size(W, H);
    video.hide();
  };

  function drawSkeleton(pose) {
    if (!pose) return;
    p.stroke(255);
    p.strokeWeight(4);
    for (const [a, b] of SKELETON_CONNECTIONS) {
      const kpA = pose.keypoints[a];
      const kpB = pose.keypoints[b];
      if (kpA.confidence > 0.5 && kpB.confidence > 0.5) {
        p.line(kpA.x, kpA.y, kpB.x, kpB.y);
      }
    }
    p.fill(57, 255, 20);
    p.noStroke();
    for (const kp of pose.keypoints) {
      if (kp.confidence > 0.5) p.circle(kp.x, kp.y, 12);
    }
  }

  p.draw = () => {
    p.background(20);
    if (cameraReady) {
      p.push();
      // p.translate(W, 0);
      // p.scale(1, 1);
      p.image(video, 0, 0, W, H);
      p.filter(p.GRAY);
      p.filter(p.ERODE);
      p.pop();
    }

    updateBodyStats(poses[0] ?? null);
    for (const pose of poses) drawSkeleton(pose);

    drawHeadCircle(smoothedHeadCircle);

      if (!cameraReady || statusMessage) {
        p.fill(255);
        p.noStroke();
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(18);
        p.text(statusMessage || "Waiting for camera...", W / 2, H / 2);
      }
      p.fill(255);

      //some stats for monitoring latency
    p.textSize(12);
    p.text(`fps: ${Math.round(p.frameRate())}`, 20, 30);
    p.text(`poses: ${poses.length}`, 20, 55);
    }
});
