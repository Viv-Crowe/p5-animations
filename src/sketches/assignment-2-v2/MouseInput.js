import { SignalSmoother } from './SignalSmoother.js';

// Mouse-based input source for testing without a camera.
// Implements the same InputSource interface as FaceTracker and HandInput:
//   start()  — no-op
//   update() — call each frame
//   state    — { x, y, velX, velY, accelX, noSignal }
export class MouseInput {
  #p;
  #state    = null;
  #smoother = new SignalSmoother();

  constructor(p) {
    this.#p = p;
  }

  start() {}

  update() {
    const p = this.#p;
    const noSignal = p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height;

    if (noSignal) {
      if (this.#state) this.#state = { ...this.#state, noSignal: true };
      return;
    }

    this.#state = this.#smoother.process(p.mouseX, p.mouseY);
  }

  get state() { return this.#state; }
}
