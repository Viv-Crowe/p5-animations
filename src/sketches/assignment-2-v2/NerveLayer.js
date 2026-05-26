export class NerveLayer {
  #p;
  #y;
  #h;
  #branches = [];

  constructor(p, y, h) {
    this.#p = p;
    this.#y = y;
    this.#h = h;
    this.#generateBranches();
  }

  #generateBranches() {
    const p = this.#p;
    for (let i = 0; i < 10; i++) {
      this.#branch(p.random(p.width), this.#y, p.HALF_PI, p.random(30, 55), 5);
    }
  }

  #branch(x, y, angle, len, depth) {
    if (depth === 0 || len < 5) return;
    const endX = x + Math.cos(angle) * len;
    const endY = y + Math.sin(angle) * len;
    if (endY > this.#y + this.#h) return;
    this.#branches.push({ x1: x, y1: y, x2: endX, y2: endY });
    const spread = this.#p.random(0.3, 0.65);
    this.#branch(endX, endY, angle - spread, len * 0.68, depth - 1);
    this.#branch(endX, endY, angle + spread, len * 0.68, depth - 1);
  }

  update(_face) {}

  draw() {
    const p = this.#p;
    p.push();
    p.fill(5, 5, 15);
    p.noStroke();
    p.rect(0, this.#y, p.width, this.#h);

    p.stroke(100, 180, 255, 70);
    p.strokeWeight(0.8);
    for (const b of this.#branches) {
      p.line(b.x1, b.y1, b.x2, b.y2);
    }
    p.pop();
  }
}
