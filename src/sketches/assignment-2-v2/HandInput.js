import ml5 from 'ml5';

// Tracks the index finger tip (MediaPipe landmark #8) via ml5 HandPose.
// Implements the same InputSource interface as FaceTracker and MouseInput:
//   start()  — begin detection
//   update() — call each frame
//   state    — { x, y, velX, velY, accelX, noSignal }
export class HandInput {
  #video;
  #hands = [];
  #state = null;
  #alpha = 0.18;

  constructor(video) {
    this.#video = video;
  }

  start() {
    const handPose = ml5.handPose({ maxHands: 1, flipped: true }, () => {
      handPose.detectStart(this.#video, (results) => { this.#hands = results; });
    });
  }

  update() {
    if (!this.#hands.length) {
      if (this.#state) this.#state = { ...this.#state, noSignal: true };
      return;
    }

    // Keypoint 8 = index_finger_tip in MediaPipe Hand Landmarker
    const tip = this.#hands[0].keypoints[8];
    if (!tip) {
      if (this.#state) this.#state = { ...this.#state, noSignal: true };
      return;
    }

    const prev   = this.#state;
    const a      = this.#alpha;
    const x      = prev ? prev.x + (tip.x - prev.x) * a : tip.x;
    const y      = prev ? prev.y + (tip.y - prev.y) * a : tip.y;
    const velX   = prev ? x - prev.x : 0;
    const velY   = prev ? y - prev.y : 0;
    const accelX = prev ? velX - prev.velX : 0;

    this.#state = { x, y, velX, velY, accelX, noSignal: false };
  }

  get state() { return this.#state; }
}
