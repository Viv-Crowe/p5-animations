// ── Adjustable parameters ──────────────────────────────────────────────────
// sensitivity (px)   : peak displacement per unit of accelX. Higher = more
//                      violent reaction. accelX is small (~0.05–0.5 px/f²)
//                      so this needs to be large (100–400).
// bumpWidth   (0–1)  : Gaussian sigma as a fraction of canvas width.
//                      0.1 = tight spike, 0.3 = broad swell.
// spring      (0–1)  : stiffness pulling each column toward its target.
// damping     (0–1)  : velocity multiplier per frame. Lower = more viscous.
// visible     bool   : render this layer at all.
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
    sensitivity: 150,
    bumpWidth:   0.18,
    spring:      0.04,
    damping:     0.82,
  };

  constructor(p, y, h) {
    this.#p     = p;
    this.#y     = y;
    this.#h     = h;
    this.#disps = new Float32Array(N_COLS);
    this.#vels  = new Float32Array(N_COLS);
  }

  #colX(i) { return (i / (N_COLS - 1)) * this.#p.width; }

  // Gaussian bell centred at peakX with given sigma (px).
  // Returns value in [0, 1].
  #gauss(colX, peakX, sigma) {
    const d = colX - peakX;
    return Math.exp(-(d * d) / (2 * sigma * sigma));
  }

  update(signal) {
    const { sensitivity, bumpWidth, spring, damping } = this.params;
    const p = this.#p;
    this.#restPhase += 0.012;

    const hasFace = signal && !signal.noSignal;
    const peakX   = hasFace ? signal.x : p.width / 2;
    const sigma   = p.width * bumpWidth;

    for (let i = 0; i < N_COLS; i++) {
      const rest  = Math.sin(this.#restPhase + i * 0.18) * 3;
      let target  = rest;

      if (hasFace) {
        const shape = this.#gauss(this.#colX(i), peakX, sigma);
        target += signal.accelX * sensitivity * shape;
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
    p.fill(205, 192, 168, 65);
    p.stroke(178, 164, 142, 110);
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
