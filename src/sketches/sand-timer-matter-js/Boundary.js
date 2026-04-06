import Matter from "matter-js";

export default class Boundary {
  constructor(p, x, y, w, h) {
    this.p = p;
    let options = {
      friction: 1,
      restitution: 0,
      isStatic: true,
    };
    this.col = p.color(200, 200, 200);
    this.body = Matter.Bodies.rectangle(x, y, w, h, options);
    Matter.Composite.add(p.engine.world, [this.body]);
  }

  show() {
    this.p.noStroke();
    this.p.fill(this.col);
    this.p.beginShape();
    for (let a of this.body.vertices) {
      this.p.vertex(a.x, a.y);
    }
    this.p.endShape(this.p.CLOSE);
  }
}
