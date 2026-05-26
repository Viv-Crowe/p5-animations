// ── Adjustable parameters ──────────────────────────────────────────────────
// sensitivity (px)  : max top-edge displacement in response to face velX.
//                     Higher = gel reacts more violently to movement.
// spring      (0–1) : spring constant pulling each column toward its target.
//                     Higher = snappier recovery.
// damping     (0–1) : velocity multiplier per frame (1 = no damping, 0 = instant stop).
//                     Lower = more viscous, slower settling.
// visible     bool  : render this layer at all.
// ──────────────────────────────────────────────────────────────────────────
const N_COLS = 60;

export class GelLayer {
  #p;
  #y;
  #h;
  #disps;
  #vels;
  #restPhase = 0;

  params = {
    visible:     true,
    sensitivity: 10,
    spring:      0.04,
    damping:     0.82,
  };

  constructor(p, y, h) {
    this.#p    = p;
    this.#y    = y;
    this.#h    = h;
    this.#disps = new Float32Array(N_COLS);
    this.#vels  = new Float32Array(N_COLS);
  }

  #colX(i) { return (i / (N_COLS - 1)) * this.#p.width; }

  update(signal) {
    const { sensitivity, spring, damping } = this.params;
    this.#restPhase += 0.012;

    for (let i = 0; i < N_COLS; i++) {
      const rest = Math.sin(this.#restPhase + i * 0.18) * 3;
      let target = rest;

      if (signal && !signal.noSignal) {
        const t = i / (N_COLS - 1);
        target += signal.velX * sensitivity * Math.sin(t * Math.PI);
      }

      const force      = (target - this.#disps[i]) * spring;
      this.#vels[i]    = (this.#vels[i] + force) * damping;
      this.#disps[i]  += this.#vels[i];
    }
  }

  draw() {
    if (!this.params.visible) return;

    const p  = this.#p;
    const sy = this.#y;
    const ey = this.#y + this.#h;

    p.push();
    p.fill(255, 140, 20, 140);
    p.stroke(220, 100, 10, 200);
    p.strokeWeight(1.5);

    p.beginShape();
    p.vertex(0, ey);
    p.vertex(p.width, ey);
    for (let i = N_COLS - 1; i >= 0; i--) {
      p.vertex(this.#colX(i), sy + this.#disps[i]);
    }
    p.endShape(p.CLOSE);

    p.pop();
  }
}
