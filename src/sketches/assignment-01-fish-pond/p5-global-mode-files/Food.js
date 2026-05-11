const FOOD_SIZE = 10;

class Food {
  constructor(x, y) {
    this.position = createVector(x, y);
  }

  show() {
    fill("orange");
    noStroke();
    square(this.position.x, this.position.y, FOOD_SIZE);
  }
}
