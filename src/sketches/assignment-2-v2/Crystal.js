export class Crystal {
  #p;
  #img;
  #baseX;
  #y;
  #dispX      = 0;
  #depthFactor;
  #w;
  #h;
  #rotation;
  #phase;

  constructor(p, img, x, y, depthFactor) {
    this.#p           = p;
    this.#img         = img;
    this.#baseX       = x;
    this.#y           = y;
    this.#depthFactor = depthFactor;

    // Smaller base size for far crystals; large variation for visual richness
    const size  = p.random(15, 65) * (0.35 + 0.65 * depthFactor);
    this.#w     = size;
    this.#h     = (img && img.width > 0) ? size * (img.height / img.width) : size;
    this.#rotation = p.random(p.TWO_PI);
    this.#phase    = p.random(p.TWO_PI);
  }

  update(lateralDisp) {
    const target = lateralDisp * this.#depthFactor;
    this.#dispX += (target - this.#dispX) * 0.08;
  }

  // depthFade: whether to darken/fade distant (small depthFactor) crystals
  draw(depthFade = true) {
    const p     = this.#p;
    const drift = Math.sin(p.frameCount * 0.007 + this.#phase) * 1.2;

    p.push();
    p.translate(this.#baseX + this.#dispX + drift, this.#y);
    p.rotate(this.#rotation);
    p.imageMode(p.CENTER);

    if (depthFade) {
      // Far crystals (low depthFactor): dark and nearly transparent
      // Near crystals (high depthFactor): bright and opaque
      const brightness = p.map(this.#depthFactor, 0.3, 1.0, 55, 255);
      const alpha      = p.map(this.#depthFactor, 0.3, 1.0, 70, 255);
      p.tint(brightness, alpha);
    }

    if (this.#img) {
      p.image(this.#img, 0, 0, this.#w, this.#h);
    } else {
      // Fallback ellipse when no sprite is loaded
      const brightness = depthFade ? p.map(this.#depthFactor, 0.3, 1.0, 55, 240) : 240;
      const alpha      = depthFade ? p.map(this.#depthFactor, 0.3, 1.0, 70, 200) : 200;
      p.fill(brightness, brightness * 0.97, brightness * 0.88, alpha);
      p.noStroke();
      p.ellipse(0, 0, this.#w, this.#h * 0.55);
    }

    p.noTint();
    p.pop();
  }
}
