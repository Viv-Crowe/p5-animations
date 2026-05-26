// Wave grid + floating crystal sprites rendered into a WEBGL graphics buffer.
// Usage:
//   const ws = new WaveSurface(crystalImgs);
//   ws.initCrystals(gfx);         // call once after gfx is created
//   ws.update(signal, canvasW);   // call each frame
//   ws.draw(gfx, t);              // call each frame

const GRID_X     = 60;
const GRID_Z     = 60;
const GRID_WIDTH = 800;
const GRID_DEPTH = 800;

const CAM_X  =   0, CAM_Y  = -30, CAM_Z  = -150;
const LOOK_X =   0, LOOK_Y = -30, LOOK_Z =  400;

const CRYSTAL_COUNT = 600;

const rand = (a, b) => a + Math.random() * (b - a);
const gmap = (v, a1, b1, a2, b2) => a2 + (v - a1) / (b1 - a1) * (b2 - a2);

export class WaveSurface {
  params = {
    ampLinear:      4,
    kLinear:        0.012,
    omegaLinear:    1.0,
    phaseLinear:    0,
    ampRadial:      9.5,
    kRadial:        0.025,
    omegaRadial:    1.8,
    radialDecay:    0.45,
    accelBoostScale: 300,  // maps |accelX| → extra ampRadial
  };

  #crystalImgs;
  #crystals = [];
  #heights;
  #inputX      = 0;
  #accelBoost  = 0;

  constructor(crystalImgs) {
    this.#crystalImgs = crystalImgs;
    this.#heights = Array.from({ length: GRID_Z }, () => new Float32Array(GRID_X));
  }

  initCrystals(gfx) {
    this.#crystals = [];
    for (let i = 0; i < CRYSTAL_COUNT; i++) {
      const img    = this.#crystalImgs[Math.floor(rand(0, this.#crystalImgs.length))];
      const sz     = rand(10, 38);
      const aspect = (img && img.width > 0) ? img.height / img.width : 1;
      this.#crystals.push({
        wx:   rand(-GRID_WIDTH / 2, GRID_WIDTH / 2),
        wz:   rand(0, GRID_DEPTH),
        sz, aspect, img,
        rotY: rand(0, Math.PI * 2),
      });
    }
    this.#crystals.sort((a, b) => b.wz - a.wz);
  }

  // Signal → wave input. canvasW used to remap x to world space.
  update(signal, canvasW) {
    if (signal && !signal.noSignal) {
      this.#inputX     = (signal.x / canvasW - 0.5) * GRID_WIDTH;
      this.#accelBoost = Math.abs(signal.accelX) * this.params.accelBoostScale;
    }
  }

  #waveHeight(wx, wz, t) {
    const p         = this.params;
    const ampRadial = p.ampRadial + this.#accelBoost;
    const inputX    = this.#inputX;

    const linear = p.ampLinear
      * Math.sin(p.kLinear * wx - p.omegaLinear * t + p.phaseLinear);

    const dx    = wx - inputX;
    const r     = Math.sqrt(dx * dx + wz * wz);
    const decay = 1.0 / Math.pow(Math.max(r, 0.5), p.radialDecay);
    const radial = ampRadial * decay
      * Math.sin(p.kRadial * r - p.omegaRadial * t);

    return linear + radial;
  }

  draw(gfx, t) {
    gfx.background(10, 15, 25);
    gfx.perspective(Math.PI / 3.5, gfx.width / gfx.height, 1, 5000);
    gfx.camera(CAM_X, CAM_Y, CAM_Z, LOOK_X, LOOK_Y, LOOK_Z, 0, 1, 0);

    // Pre-compute heights
    for (let j = 0; j < GRID_Z; j++) {
      const wz = gmap(j, 0, GRID_Z - 1, 0, GRID_DEPTH);
      for (let i = 0; i < GRID_X; i++) {
        const wx = gmap(i, 0, GRID_X - 1, -GRID_WIDTH / 2, GRID_WIDTH / 2);
        this.#heights[j][i] = this.#waveHeight(wx, wz, t);
      }
    }

    // Wireframe
    gfx.noFill();
    gfx.strokeWeight(0.5);

    for (let j = 0; j < GRID_Z - 1; j++) {
      const wz0  = gmap(j,     0, GRID_Z - 1, 0, GRID_DEPTH);
      const wz1  = gmap(j + 1, 0, GRID_Z - 1, 0, GRID_DEPTH);
      const alpha = gmap(wz0, 0, GRID_DEPTH, 180, 20);
      gfx.stroke(100, 180, 255, alpha);

      gfx.beginShape(gfx.TRIANGLE_STRIP);
      for (let i = 0; i < GRID_X; i++) {
        const wx = gmap(i, 0, GRID_X - 1, -GRID_WIDTH / 2, GRID_WIDTH / 2);
        gfx.vertex(wx, -this.#heights[j][i],     wz0);
        gfx.vertex(wx, -this.#heights[j + 1][i], wz1);
      }
      gfx.endShape();
    }

    // Crystal sprites (back-to-front, depthMask off for alpha blending)
    gfx.noStroke();
    gfx.fill(255);
    gfx.drawingContext.depthMask(false);

    for (const c of this.#crystals) {
      const wy = this.#waveHeight(c.wx, c.wz, t);
      gfx.push();
      gfx.translate(c.wx, -wy, c.wz);
      gfx.rotateY(c.rotY);
      gfx.texture(c.img);
      gfx.plane(c.sz, c.sz * c.aspect);
      gfx.pop();
    }

    gfx.drawingContext.depthMask(true);
  }
}
