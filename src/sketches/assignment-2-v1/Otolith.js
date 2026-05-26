export class Otolith {
  #p;
  #verts;
  #displacement = 0;
  #targetDisp = 0;

  constructor(p, x, y) {
    this.#p = p;
    this.center = p.createVector(x, y);

    const numVerts = 5 + Math.floor(Math.random() * 2);
    const size = 5 + Math.random() * 9;
    this.#verts = [];
    for (let i = 0; i < numVerts; i++) {
      const angle = (i / numVerts) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const r = size * (0.6 + Math.random() * 0.4);
      this.#verts.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
  }

  update(colDisplacement) {
    this.#targetDisp = colDisplacement * 0.7;
    this.#displacement += (this.#targetDisp - this.#displacement) * 0.04;
  }

  draw() {
    const p = this.#p;
    p.push();
    p.translate(this.center.x + this.#displacement, this.center.y);
    p.fill(240, 235, 210);
    p.stroke(180, 175, 160);
    p.strokeWeight(1);
    p.beginShape();
    for (const [vx, vy] of this.#verts) {
      p.vertex(vx, vy);
    }
    p.endShape(p.CLOSE);
    p.pop();
  }
}
