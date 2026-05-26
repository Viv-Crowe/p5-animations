const FIRE_THRESHOLD = 18;
const REFRACTORY_FRAMES = 45;

export class HairCell {
  #p;
  #displacement = 0;
  #pulses = [];
  #refractory = 0;

  constructor(p, x, baseY, length) {
    this.#p = p;
    this.x = x;
    this.baseY = baseY;
    this.length = length;
  }

  update(colDisplacement) {
    this.#displacement += (colDisplacement - this.#displacement) * 0.12;
    if (this.#refractory > 0) this.#refractory--;

    if (Math.abs(this.#displacement) > FIRE_THRESHOLD && this.#refractory === 0) {
      this.#pulses.push({ t: 0 });
      this.#refractory = REFRACTORY_FRAMES;
    }

    for (const pulse of this.#pulses) pulse.t += 1 / 30;
    this.#pulses = this.#pulses.filter(pulse => pulse.t < 1);
  }

  draw() {
    const p = this.#p;
    const { x, baseY, length } = this;
    const disp = this.#displacement;

    const rootX = x,   rootY = baseY;
    const tipX  = x + disp,   tipY  = baseY + length;
    const cpX   = x + disp * 0.6, cpY = baseY + length * 0.5;

    p.push();
    p.noFill();
    p.stroke(255);
    p.strokeWeight(1.5);
    p.bezier(rootX, rootY, cpX, cpY, cpX, cpY, tipX, tipY);

    p.noStroke();
    p.fill(120);
    p.circle(tipX, tipY, 6);

    for (const pulse of this.#pulses) {
      const t = pulse.t;
      const px = p.bezierPoint(rootX, cpX, cpX, tipX, t);
      const py = p.bezierPoint(rootY, cpY, cpY, tipY, t);
      const alpha = t > 0.7 ? p.map(t, 0.7, 1.0, 255, 0) : 255;
      p.fill(255, 40, 40, alpha);
      p.circle(px, py, 10);
    }
    p.pop();
  }
}
