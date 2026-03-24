import p5 from "p5";

export default class Fish {
  constructor(p) {
    this.p = p;
    this.position = p.createVector(Math.random() * p.width, Math.random() * p.height);
    this.velocity = p5.Vector.random2D();
    this.velocity.setMag(1);
    this.acceleration = p.createVector(0,0);
    this.maxForce = 0.1;
    this.maxSpeed = 3;
  }

  flock(school) {
    const alignment = this.align(school).mult(1.0);
    const cohesion = this.cohere(school).mult(0.7);
    const separation = this.separate(school).mult(1.5);

    this.acceleration.add(alignment);
    this.acceleration.add(cohesion);
    this.acceleration.add(separation);
  }

  align(school) {
    return this.steerFromNeighbors(school, 40, (neighbors) => {
      const avgVelocity = this.p.createVector(0, 0);
      for (const neighbor of neighbors) {
        avgVelocity.add(neighbor.velocity);
      }
      return avgVelocity.div(neighbors.length);
    });
  }

  cohere(school) {
    return this.steerFromNeighbors(school, 50, (neighbors) => {
      const center = this.p.createVector(0, 0);
      for (const neighbor of neighbors) {
        center.add(neighbor.position);
      }
      center.div(neighbors.length);
      return center.sub(this.position);
    });
  }

  separate(school) {
    return this.steerFromNeighbors(school, 20, (neighbors) => {
      const away = this.p.createVector(0, 0);
      for (const neighbor of neighbors) {
        away.add(p5.Vector.sub(this.position, neighbor.position));
      }
      return away.div(neighbors.length);
    });
  }

  getNeighbors(school, radius) {
    return school.filter(
      (otherFish) =>
        otherFish !== this &&
        this.position.dist(otherFish.position) < radius
    );
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }
  show() {
    this.p.strokeWeight(6);
    this.p.stroke(255);
    this.p.point(this.position.x, this.position.y);
  }

  steerFromNeighbors(school, radius, accumulator) {
    const neighbors = this.getNeighbors(school, radius);
    if (neighbors.length === 0) {
      return this.p.createVector(0, 0);
    }

    const desired = accumulator(neighbors);
    desired.setMag(this.maxSpeed);
    const steering = desired.sub(this.velocity);
    steering.limit(this.maxForce);
    return steering;
  }
}