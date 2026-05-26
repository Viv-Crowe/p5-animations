const N_COLS  = 60;
const SPRING  = 0.04;
const DAMPING = 0.82;

export class GelLayer {
  #p;
  #y;
  #h;
  #disps;
  #vels;
  #restPhase = 0;

  constructor(p, y, h) {
    this.#p    = p;
    this.#y    = y;
    this.#h    = h;
    this.#disps = new Float32Array(N_COLS);
    this.#vels  = new Float32Array(N_COLS);
  }

  #colX(i) { return (i / (N_COLS - 1)) * this.#p.width; }

  update(face) {
    this.#restPhase += 0.012;

    for (let i = 0; i < N_COLS; i++) {
      const rest = Math.sin(this.#restPhase + i * 0.18) * 3;
      let target = rest;

      if (face && !face.noFace) {
        const t = i / (N_COLS - 1);
        target += face.velX * 10 * Math.sin(t * Math.PI);
      }

      const force     = (target - this.#disps[i]) * SPRING;
      this.#vels[i]   = (this.#vels[i] + force) * DAMPING;
      this.#disps[i] += this.#vels[i];
    }
  }

  draw() {
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
