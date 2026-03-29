const FOOD_SIZE = 10;

export default class Food {
  constructor(p, x, y) {
    this.p = p;
    this.position = p.createVector(x, y);
  }
  show() {
    this.p.fill("orange");
    this.p.noStroke();
    this.p.square(this.position.x, this.position.y, FOOD_SIZE);
  };
}