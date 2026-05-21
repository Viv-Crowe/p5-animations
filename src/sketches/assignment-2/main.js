import p5 from "p5";
import ml5 from "ml5";
import Matter from "matter-js";
import { HeadBubble } from "./HeadBubble.js";

new p5((p) => {
const W = 640;
const H = 480;

  // const VIDEO_W = 480; // use this small video for pose detection
  // const VIDEO_H = 240;

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

  let fullBodyInView = false;
  let bodyHeight = 0;

  function updateBodyStats(pose) {
    if (!pose) { fullBodyInView = false; bodyHeight = 0; return; }
    const kp = pose.keypoints;
    const confident = (i) => kp[i].confidence > 0.5;

    const hasHip = confident(11) || confident(12);
    const hasAnkle = confident(15) || confident(16);
    fullBodyInView = confident(0) && hasHip && hasAnkle;

    if (fullBodyInView) {
      const visibleAnkles = [15, 16].filter(confident);
      const ankleY = visibleAnkles.reduce((s, i) => s + kp[i].y, 0) / visibleAnkles.length;
      bodyHeight = ankleY - kp[0].y;
    } else {
      bodyHeight = 0;
    }

    headBubble.update(pose, bodyHeight);
  }

  let headBubble;
  let startTime = null;
  let frozenPhaseStart = null;
  let frozenPose = null;
  let frozenHeadCircle = null;
  let matterEngine = null;
  let boneBodies = [];
  let headBoundaryBodies = [];

  p.setup = () => {
    p.createCanvas(W, H);
    headBubble = new HeadBubble(p);

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

    for (const pose of poses) {
      updateBodyStats(pose);
      drawSkeleton(pose);
      headBubble.draw();
    }

      if (!cameraReady || statusMessage) {
        p.fill(255);
        p.noStroke();
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(18);
        p.text(statusMessage || "Waiting for camera...", W / 2, H / 2);
      }
      p.fill(255);

      //some stats for monitoring latency
    p.textSize(24);
    p.text(`fps: ${Math.round(p.frameRate())}`, 20, 30);
    p.text(`poses: ${poses.length}`, 20, 55);
    }
});
