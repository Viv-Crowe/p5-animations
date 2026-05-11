import p5 from "p5";
import ml5 from "ml5";
import Matter from "matter-js";

new p5((p) => {
  const W = 640;
  const H = 480;
  const COUNTDOWN_SECS = 30;
  const FROZEN_SECS = 5;
  const BONE_THICKNESS = 8;

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

  function updateBodyStats(pose) {
    if (!pose) { fullBodyInView = false; bodyHeight = 0; headCircle = null; return; }
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
      headCircle = { x: kp[0].x, y: kp[0].y, radius };
    } else {
      headCircle = null;
    }
  }

  function drawHeadCircle(hc) {
    if (!hc) return;
    p.noFill();
    p.stroke(255, 200, 0);
    p.strokeWeight(3);
    p.circle(hc.x, hc.y, hc.radius * 2);
  }

  // phase: 'countdown' | 'frozen' | 'physics'
  let phase = "countdown";
  let startTime = null;
  let frozenPhaseStart = null;
  let frozenPose = null;
  let frozenHeadCircle = null;
  let matterEngine = null;
  let boneBodies = [];
  let headBoundaryBodies = [];

  p.setup = () => {
    p.createCanvas(W, H);
    startTime = p.millis();

    bodyPose = ml5.bodyPose("MoveNet", { flipped: true }, () => {
      modelReady = true;
      statusMessage = cameraReady ? "" : statusMessage;
      if (cameraReady) bodyPose.detectStart(video, (results) => { poses = results; });
    });

    video = p.createCapture(p.VIDEO, { flipped: true }, () => {
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

  function initPhysics(pose, hc) {
    matterEngine = Matter.Engine.create();
    const world = matterEngine.world;

    const ground = Matter.Bodies.rectangle(W / 2, H + 25, W * 2, 50, { isStatic: true });
    Matter.Composite.add(world, ground);

    boneBodies = [];
    for (const [a, b] of SKELETON_CONNECTIONS) {
      const kpA = pose.keypoints[a];
      const kpB = pose.keypoints[b];
      if (kpA.confidence > 0.5 && kpB.confidence > 0.5) {
        const cx = (kpA.x + kpB.x) / 2;
        const cy = (kpA.y + kpB.y) / 2;
        const len = Math.hypot(kpB.x - kpA.x, kpB.y - kpA.y);
        const angle = Math.atan2(kpB.y - kpA.y, kpB.x - kpA.x);
        const body = Matter.Bodies.rectangle(cx, cy, len, BONE_THICKNESS, {
          angle,
          restitution: 0.3,
          friction: 0.5,
        });
        Matter.Composite.add(world, body);
        boneBodies.push(body);
      }
    }

    headBoundaryBodies = [];
    if (hc) {
      const SEGMENTS = 32;
      for (let i = 0; i < SEGMENTS; i++) {
        const a1 = (i / SEGMENTS) * Math.PI * 2;
        const a2 = ((i + 1) / SEGMENTS) * Math.PI * 2;
        const x1 = hc.x + Math.cos(a1) * hc.radius;
        const y1 = hc.y + Math.sin(a1) * hc.radius;
        const x2 = hc.x + Math.cos(a2) * hc.radius;
        const y2 = hc.y + Math.sin(a2) * hc.radius;
        const seg = Matter.Bodies.rectangle(
          (x1 + x2) / 2, (y1 + y2) / 2,
          Math.hypot(x2 - x1, y2 - y1), 4,
          { angle: Math.atan2(y2 - y1, x2 - x1), isStatic: true, restitution: 0.5, friction: 0.1 }
        );
        headBoundaryBodies.push(seg);
      }
      Matter.Composite.add(world, headBoundaryBodies);
    }
  }

  p.draw = () => {
    const now = p.millis();

    if (phase === "countdown") {
      const elapsed = (now - startTime) / 1000;
      const remaining = Math.max(0, Math.ceil(COUNTDOWN_SECS - elapsed));

      p.background(20);
      if (cameraReady) {
        p.push();
        p.translate(W, 0);
        p.scale(-1, 1);
        p.image(video, 0, 0, W, H);
        p.pop();
      }

      updateBodyStats(poses[0] ?? null);
      for (const pose of poses) drawSkeleton(pose);
      drawHeadCircle(headCircle);

      p.fill(255);
      p.noStroke();
      p.textSize(72);
      p.textAlign(p.LEFT, p.TOP);
      p.text(remaining, 20, 20);

      if (!cameraReady || statusMessage) {
        p.fill(255);
        p.noStroke();
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(18);
        p.text(statusMessage || "Waiting for camera...", W / 2, H / 2);
      }

      if (elapsed >= COUNTDOWN_SECS) {
        frozenPose = poses.length > 0 ? JSON.parse(JSON.stringify(poses[0])) : null;
        frozenHeadCircle = headCircle ? { ...headCircle } : null;
        frozenPhaseStart = now;
        phase = "frozen";
      }
    } else if (phase === "frozen") {
      p.background(0);
      drawSkeleton(frozenPose);
      drawHeadCircle(frozenHeadCircle);

      if ((now - frozenPhaseStart) / 1000 >= FROZEN_SECS) {
        if (frozenPose) initPhysics(frozenPose, frozenHeadCircle);
        phase = "physics";
      }
    } else if (phase === "physics") {
      Matter.Engine.update(matterEngine, p.deltaTime);

      p.background(0);
      p.fill(255);
      p.noStroke();
      for (const body of boneBodies) {
        p.beginShape();
        for (const v of body.vertices) p.vertex(v.x, v.y);
        p.endShape(p.CLOSE);
      }
      p.stroke(255, 200, 0);
      p.strokeWeight(3);
      p.noFill();
      for (const seg of headBoundaryBodies) {
        p.beginShape();
        for (const v of seg.vertices) p.vertex(v.x, v.y);
        p.endShape(p.CLOSE);
      }
    }
  };
});
