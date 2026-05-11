const ALIGNMENT_RATE = 0.2;
const COHESION_RATE = 0.2;
const SEPARATION_RATE = 4;

const WALL_TOLERANCE = 100;
const ALLOWED_OVERLAP = -5;
const OUTSIDE_RECOVERY_MARGIN = 30;

class Fish {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = p5.Vector.random2D();
    this.velocity.setMag(1);
    this.acceleration = createVector(0, 0);
    this.maxForce = 0.1;
    this.maxSpeed = 1.0;
  }

  flock(school) {
    const alignment = this.align(school).mult(ALIGNMENT_RATE);
    // const cohesion = this.cohere(school).mult(COHESION_RATE);
    const separation = this.separate(school).mult(SEPARATION_RATE);

    this.acceleration.add(alignment);
    // this.acceleration.add(cohesion);
    this.acceleration.add(separation);

    const randomSteering = p5.Vector.random2D().mult(0.2);
    this.acceleration.add(randomSteering);
  }

  align(school) {
    return this.steerFromNeighbors(school, 40, (neighbors) => {
      const avgVelocity = createVector(0, 0);
      for (const neighbor of neighbors) {
        avgVelocity.add(neighbor.velocity);
      }
      return avgVelocity.div(neighbors.length);
    });
  }

  cohere(school) {
    return this.steerFromNeighbors(school, 50, (neighbors) => {
      const center = createVector(0, 0);
      for (const neighbor of neighbors) {
        center.add(neighbor.position);
      }
      center.div(neighbors.length);
      return center.sub(this.position);
    });
  }

  separate(school) {
    return this.steerFromNeighbors(school, 20, (neighbors) => {
      const away = createVector(0, 0);
      for (const neighbor of neighbors) {
        away.add(p5.Vector.sub(this.position, neighbor.position));
      }
      return away.div(neighbors.length);
    });
  }

  eat(food) {
    for (let i = food.length - 1; i >= 0; i--) {
      if (this.position.dist(food[i].position) < 5) {
        food.splice(i, 1);
      }
    }
  }

  hunt(food) {
    if (food.length === 0) {
      return;
    }

    const closestFood = food.reduce(
      (closest, f) => {
        const d = this.position.dist(f.position);
        if (d < closest.distance) {
          return { food: f, distance: d };
        }
        return closest;
      },
      { food: null, distance: Infinity }
    ).food;

    if (closestFood) {
      const desired = p5.Vector.sub(closestFood.position, this.position);
      desired.setMag(this.maxSpeed);
      const steering = desired.sub(this.velocity);
      steering.limit(this.maxForce);
      this.acceleration.add(steering);
    }
  }

  avoidWall(pond) {
    const toFish = p5.Vector.sub(this.position, pond.center);
    const centerDistance = toFish.mag();
    const maxDistance = pond.radius + ALLOWED_OVERLAP;
    const outsideAmount = centerDistance - maxDistance;

    if (outsideAmount > OUTSIDE_RECOVERY_MARGIN) {
      toFish.setMag(maxDistance);
      this.position = p5.Vector.add(pond.center, toFish);
    }

    if (pond.distToPondWall(this.position) < WALL_TOLERANCE) {
      const normal = p5.Vector.sub(this.position, pond.center).normalize();

      const tangent1 = createVector(-normal.y, normal.x);
      const tangent2 = createVector(normal.y, -normal.x);
      const tangent =
        this.velocity.dot(tangent1) > this.velocity.dot(tangent2)
          ? tangent1
          : tangent2;

      const inwardStrength = outsideAmount > 0 ? 0.6 + outsideAmount * 0.02 : 0.3;
      const inward = normal.copy().mult(-inwardStrength);

      const desired = tangent.add(inward);
      const steering = desired.setMag(this.maxSpeed).sub(this.velocity);
      steering.limit(this.maxForce);

      this.acceleration.add(steering);
    }
  }

  getNeighbors(school, radius) {
    return school.filter(
      (otherFish) =>
        otherFish !== this && this.position.dist(otherFish.position) < radius
    );
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  show() {
    strokeWeight(12);
    stroke(255);
    point(this.position.x, this.position.y);
  }

  steerFromNeighbors(school, radius, accumulator) {
    const neighbors = this.getNeighbors(school, radius);
    if (neighbors.length === 0) {
      return createVector(0, 0);
    }

    const desired = accumulator(neighbors);
    desired.setMag(this.maxSpeed);
    const steering = desired.sub(this.velocity);
    steering.limit(this.maxForce);
    return steering;
  }
}
