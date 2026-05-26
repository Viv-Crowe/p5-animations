// Mouse-based input source for testing without a camera.
// Implements the same InputSource interface as FaceTracker:
//   start()  — no-op
//   update() — call each frame
//   state    — { x, y, velX, velY, accelX, noSignal }
export class MouseInput {
  #p;
  #state = null;
  #alpha = 0.25; // lighter smoothing than face — mouse is already deliberate

  constructor(p) {
    this.#p = p;
  }

  start() {}

  update() {
    const p    = this.#p;
    const rawX = p.mouseX;
    const rawY = p.mouseY;
    const a    = this.#alpha;
    const prev = this.#state;

    const x      = prev ? prev.x + (rawX - prev.x) * a : rawX;
    const y      = prev ? prev.y + (rawY - prev.y) * a : rawY;
    const velX   = prev ? x - prev.x : 0;
    const velY   = prev ? y - prev.y : 0;
    const accelX = prev ? velX - prev.velX : 0;

    // noSignal when mouse is outside the canvas
    const noSignal = rawX < 0 || rawX > p.width || rawY < 0 || rawY > p.height;
    this.#state = { x, y, velX, velY, accelX, noSignal };
  }

  get state() { return this.#state; }
}
