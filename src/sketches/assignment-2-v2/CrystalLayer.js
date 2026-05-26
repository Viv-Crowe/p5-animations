import { Crystal } from './Crystal.js';

const CRYSTAL_COUNT  = 80;
const PARALLAX_SCALE = 0.2;  // fraction of (faceX - centreX) applied as max displacement

export class CrystalLayer {
  #p;
  #texture;
  #crystals = [];
  #texOffsetX = 0;
  #driftPhase = 0;
  #y;
  #h;

  constructor(p, texture, sprites, y, h) {
    this.#p = p;
    this.#texture = texture;
    this.#y = y;
    this.#h = h;

    for (let i = 0; i < CRYSTAL_COUNT; i++) {
      const x           = p.random(p.width);
      const cy          = y + p.random(h);
      const depthFactor = p.random(0.3, 1.0);
      const img         = sprites.length ? sprites[Math.floor(p.random(sprites.length))] : null;
      this.#crystals.push(new Crystal(p, img, x, cy, depthFactor));
    }
  }

  update(face) {
    const p = this.#p;

    if (face && !face.noFace) {
      const lateralDisp  = (face.x - p.width / 2) * PARALLAX_SCALE;
      const targetOffset = face.accelX * -25;
      this.#texOffsetX  += (targetOffset - this.#texOffsetX) * 0.06;
      for (const c of this.#crystals) c.update(lateralDisp);
    } else {
      this.#driftPhase  += 0.003;
      this.#texOffsetX   = Math.sin(this.#driftPhase) * 3;
      for (const c of this.#crystals) c.update(0);
    }
  }

  draw() {
    const p   = this.#p;
    const ctx = p.drawingContext;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.#y, p.width, this.#h);
    ctx.clip();

    if (this.#texture) {
      const scale    = this.#h / this.#texture.height;
      const scaledW  = this.#texture.width * scale;
      const offset   = ((this.#texOffsetX % scaledW) + scaledW) % scaledW;
      for (let x = -scaledW + offset; x < p.width + scaledW; x += scaledW) {
        p.image(this.#texture, x, this.#y, scaledW, this.#h);
      }
    } else {
      p.push();
      p.fill(10, 5, 20);
      p.noStroke();
      p.rect(0, this.#y, p.width, this.#h);
      p.pop();
    }

    for (const c of this.#crystals) c.draw();

    ctx.restore();
  }
}
