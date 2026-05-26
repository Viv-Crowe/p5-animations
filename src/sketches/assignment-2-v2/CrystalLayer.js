import { Crystal } from './Crystal.js';

// ── Adjustable parameters ──────────────────────────────────────────────────
// parallaxScale  (0–1)   : how far crystals shift relative to face position offset.
//                          0 = no parallax, 1 = crystals track face 1:1.
// depthFade      bool    : darken/fade crystals with low depthFactor (far away).
// visible        bool    : render this layer at all.
// ──────────────────────────────────────────────────────────────────────────
const CRYSTAL_COUNT = 200;

export class CrystalLayer {
  #p;
  #texture;
  #crystals    = [];
  #texOffsetX  = 0;
  #driftPhase  = 0;
  #y;
  #h;          // full crystal placement height (may extend into gel zone)
  #textureH;   // dark background clip height (crystal field only)

  params = {
    visible:       true,
    parallaxScale: 0.2,
    depthFade:     true,
  };

  // textureH: how far the dark background extends (defaults to h).
  // Pass a smaller textureH to stop the background at the crystal/gel boundary
  // while still placing crystals further down into the gel.
  constructor(p, texture, sprites, y, h, textureH = h) {
    this.#p        = p;
    this.#texture  = texture;
    this.#y        = y;
    this.#h        = h;
    this.#textureH = textureH;

    for (let i = 0; i < CRYSTAL_COUNT; i++) {
      const x           = p.random(p.width);
      const cy          = y + p.random(h);
      const depthFactor = p.random(0.3, 1.0);
      const img         = sprites.length ? sprites[Math.floor(p.random(sprites.length))] : null;
      this.#crystals.push(new Crystal(p, img, x, cy, depthFactor));
    }
  }

  update(signal) {
    const p = this.#p;

    if (signal && !signal.noSignal) {
      const lateralDisp  = (signal.x - p.width / 2) * this.params.parallaxScale;
      const targetOffset = signal.accelX * -25;
      this.#texOffsetX  += (targetOffset - this.#texOffsetX) * 0.06;
      for (const c of this.#crystals) c.update(lateralDisp);
    } else {
      this.#driftPhase += 0.003;
      this.#texOffsetX  = Math.sin(this.#driftPhase) * 3;
      for (const c of this.#crystals) c.update(0);
    }
  }

  // Draw only the dark background / texture — call this before the gel layer.
  drawBackground() {
    if (!this.params.visible) return;

    const p   = this.#p;
    const ctx = p.drawingContext;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.#y, p.width, this.#textureH);
    ctx.clip();

    if (this.#texture) {
      const scale   = this.#textureH / this.#texture.height;
      const scaledW = this.#texture.width * scale;
      const offset  = ((this.#texOffsetX % scaledW) + scaledW) % scaledW;
      for (let x = -scaledW + offset; x < p.width + scaledW; x += scaledW) {
        p.image(this.#texture, x, this.#y, scaledW, this.#textureH);
      }
    } else {
      p.push();
      p.fill(10, 5, 20);
      p.noStroke();
      p.rect(0, this.#y, p.width, this.#textureH);
      p.pop();
    }

    ctx.restore();
  }

  // Draw crystal sprites — call this after the gel layer so crystals sit on top.
  // No clip applied: sprites near the boundary won't be cut off.
  drawCrystals() {
    if (!this.params.visible) return;
    for (const c of this.#crystals) c.draw(this.params.depthFade);
  }
}
