import { Otolith } from "./Otolith.js";
import { HairCell } from "./HairCell.js";

const STRIP_H = 70;
const N_COLS = 50;
const SIGMA = 120;
const TILT_SENSITIVITY = 80;

function getTilt(pose) {
  const kp = pose.keypoints;
  const ok = i => kp[i].confidence > 0.5;
  if (ok(3) && ok(4)) return Math.atan2(kp[4].y - kp[3].y, kp[4].x - kp[3].x);
  if (ok(5) && ok(6)) return Math.atan2(kp[6].y - kp[5].y, kp[6].x - kp[5].x);
  return 0;
}

export class GelStrip {
  #p;
  #W;
  #stripY;
  #displacements;
  #targetDisps;
  #crystals;
  #hairCells;

  constructor(p, W, H) {
    this.#p = p;
    this.#W = W;
    this.#stripY = H * 0.40;

    this.#displacements = new Float32Array(N_COLS);
    this.#targetDisps = new Float32Array(N_COLS);

    this.#crystals = [];
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * W;
      const y = this.#stripY + (Math.random() - 0.5) * STRIP_H * 0.6;
      this.#crystals.push(new Otolith(p, x, y));
    }

    this.#hairCells = [];
    for (let i = 0; i < 35; i++) {
      const x = (i + 0.5) * W / 35 + (Math.random() - 0.5) * 8;
      const length = 40 + Math.random() * 20;
      this.#hairCells.push(new HairCell(p, x, this.#stripY + STRIP_H / 2, length));
    }
  }

  #colX(i) {
    return i * this.#W / (N_COLS - 1);
  }

  update(poses) {
    this.#targetDisps.fill(0);

    for (const pose of poses) {
      if (pose.keypoints[0].confidence < 0.3) continue;
      const tilt = getTilt(pose);
      const disp = tilt * TILT_SENSITIVITY;
      const personX = pose.keypoints[0].x;

      for (let i = 0; i < N_COLS; i++) {
        const dx = this.#colX(i) - personX;
        this.#targetDisps[i] += disp * Math.exp(-(dx * dx) / (2 * SIGMA * SIGMA));
      }
    }

    for (let i = 0; i < N_COLS; i++) {
      this.#displacements[i] += (this.#targetDisps[i] - this.#displacements[i]) * 0.1;
    }

    for (const hair of this.#hairCells) {
      const ci = Math.max(0, Math.min(N_COLS - 1, Math.round((hair.x / this.#W) * (N_COLS - 1))));
      hair.update(this.#displacements[ci]);
    }

    for (const crystal of this.#crystals) {
      const ci = Math.max(0, Math.min(N_COLS - 1, Math.round((crystal.center.x / this.#W) * (N_COLS - 1))));
      crystal.update(this.#displacements[ci]);
    }
  }

  draw() {
    const p = this.#p;
    const sy = this.#stripY;

    p.push();
    p.fill(255, 120, 0, 160);
    p.stroke(220, 80, 0);
    p.strokeWeight(2);
    p.beginShape();
    for (let i = 0; i < N_COLS; i++) {
      p.vertex(this.#colX(i), sy - STRIP_H / 2 + this.#displacements[i]);
    }
    p.vertex(this.#W, sy + STRIP_H / 2);
    p.vertex(0, sy + STRIP_H / 2);
    p.endShape(p.CLOSE);
    p.pop();

    for (const crystal of this.#crystals) crystal.draw();
    for (const hair of this.#hairCells) hair.draw();
  }
}
