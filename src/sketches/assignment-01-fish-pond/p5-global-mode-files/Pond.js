const RADIUS = 200;
const WATER_COLOR = [135, 187, 168];

class Pond {
  constructor() {
    this.center = createVector(width / 2, height / 2);
    this.radius = RADIUS;
    this.school = [];
  }

  show() {
    fill(WATER_COLOR);
    noStroke();
    circle(this.center.x, this.center.y, this.radius * 2);
  }

  distToPondWall(position) {
    return this.radius - this.center.dist(position);
  }

  addNFish(nFish) {
    for (let i = 0; i < nFish; i++) {
      let x, y;
      do {
        x = random(width);
        y = random(height);
      } while (this.distToPondWall(createVector(x, y)) < 0);

      this.school.push(new Fish(x, y));
    }
  }

  isInsidePond(position) {
    return this.distToPondWall(position) > 0;
  }
}
