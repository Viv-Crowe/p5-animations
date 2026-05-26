export class Crystal {
  #p;
  #img;
  #baseX;
  #y;
  #dispX = 0;
  #depthFactor;
  #w;
  #h;
  #rotation;
  #phase;

  constructor(p, img, x, y, depthFactor) {
    this.#p = p;
    this.#img = img;
    this.#baseX = x;
    this.#y = y;
    this.#depthFactor = depthFactor;

    const size = p.random(20, 70) * (0.4 + 0.6 * depthFactor);
    this.#w = size;
    this.#h = (img && img.width > 0) ? size * (img.height / img.width) : size;
    this.#rotation = p.random(p.TWO_PI);
    this.#phase = p.random(p.TWO_PI);
  }

  update(lateralDisp) {
    const target = lateralDisp * this.#depthFactor;
    this.#dispX += (target - this.#dispX) * 0.08;
  }

  draw() {
    const p = this.#p;
    const drift = Math.sin(p.frameCount * 0.007 + this.#phase) * 1.2;
    p.push();
    p.translate(this.#baseX + this.#dispX + drift, this.#y);
    p.rotate(this.#rotation);
    p.imageMode(p.CENTER);
    if (this.#img) {
      p.image(this.#img, 0, 0, this.#w, this.#h);
    } else {
      p.fill(240, 235, 220, 180);
      p.noStroke();
      p.ellipse(0, 0, this.#w, this.#h * 0.6);
    }
    p.pop();
  }
}
