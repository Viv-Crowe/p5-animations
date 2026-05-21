const LENGTH = 1;
const LENGTH_TO_WIDTH_RATIO = 2;

export default class Otolith {
  constructor(p, x, y) {
    this.p = p;
    this.center = p.createVector(x, y);
    this.length = Math.random() * LENGTH
    this.width = this.length*LENGTH_TO_WIDTH_RATIO
  }

    show() {
        


}
