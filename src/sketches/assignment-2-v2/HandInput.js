import ml5 from 'ml5';
import { SignalSmoother } from './SignalSmoother.js';

// Tracks the index finger tip (MediaPipe landmark #8) via ml5 HandPose.
// Implements the same InputSource interface as FaceTracker and MouseInput:
//   start()  — begin detection
//   update() — call each frame
//   state    — { x, y, velX, velY, accelX, noSignal }
export class HandInput {
  #video;
  #hands    = [];
  #state    = null;
  #smoother = new SignalSmoother();

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

    this.#state = this.#smoother.process(tip.x, tip.y);
  }

  get state()  { return this.#state; }
  get hands()  { return this.#hands; }
}
