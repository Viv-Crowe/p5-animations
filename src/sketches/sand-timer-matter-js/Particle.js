
const SIZE = 10;
import Matter from "matter-js";
let Composite = Matter.Composite;
let Bodies = Matter.Bodies;


export default class Particle {
  constructor(p, x, y, size, colour) {
    this.p = p;
    this.size = size || SIZE;
    this.colour = colour || p.color(255);
    let options = {
      restitution: 0,
      friction: 1.2,
      frictionStatic: 1.0,
      frictionAir: 0.02,
      slop: 0.0005,
      density: 0.002
    }
    this.body = Bodies.rectangle(x, y, this.size, this.size, options);
    // add the body to the world
    Composite.add(p.engine.world, [this.body]);
  }

  show() {
    let pos = this.body.position;
    this.p.push();
    this.p.translate(pos.x, pos.y);
    this.p.rectMode(this.p.CENTER);
    this.p.noStroke();
    this.p.fill(this.colour); 
    this.p.rect(0, 0, this.size, this.size);
    this.p.pop();
  }

}
