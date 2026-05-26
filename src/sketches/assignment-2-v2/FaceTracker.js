import ml5 from 'ml5';
import { SignalSmoother } from './SignalSmoother.js';

// Implements the InputSource interface:
//   start()  — begin detection
//   update() — call each frame
//   state    — { x, y, velX, velY, accelX, noSignal }
export class FaceTracker {
  #video;
  #faces   = [];
  #state   = null;
  #smoother = new SignalSmoother();

  constructor(video) {
    this.#video = video;
  }

  start() {
    const mesh = ml5.faceMesh({ maxFaces: 1, flipped: true }, () => {
      mesh.detectStart(this.#video, (results) => { this.#faces = results; });
    });
  }

  update() {
    if (!this.#faces.length) {
      if (this.#state) this.#state = { ...this.#state, noSignal: true };
      return;
    }

    const face = this.#faces[0];
    const rawX = face.box.xMin + face.box.width  / 2;
    const rawY = face.box.yMin + face.box.height / 2;

    this.#state = this.#smoother.process(rawX, rawY);
  }

  get state() { return this.#state; }
}
