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
    // Gel surface physics
    amplitudeScale:  300,   // rolling |input| × this → surface height
    muScale:         1500,  // rolling input × this → peak X world position
    sigma:           180,   // bell half-width in world units
    asymmetryScale:  0.5,   // 0 = symmetric Gaussian, 1 = strong gamma-like tail
    responseAlpha:   0.95,  // EMA factor (0.99 = sluggish, 0.8 = snappy)
    // Toggle: which signal drives amplitude and peak position
    useVelocity:     false, // false = accelX, true = velX
    // Idle background undulation (always present)
    bgAmplitude:     2.5,
    bgSpeed:         0.4,
    bgFreq:          0.008,
  };

  #crystalImgs;
  #crystals = [];
  #heights;
  #muEMA  = 0;   // EMA of signed input  (direction + magnitude)
  #ampEMA = 0;   // EMA of |input|        (magnitude only)

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

  // Each frame: feed smoothed signal, pick accelX or velX based on toggle.
  update(signal, _canvasW) {
    if (signal && !signal.noSignal) {
      const input = this.params.useVelocity ? signal.velX : signal.accelX;
      const a     = this.params.responseAlpha;
      this.#muEMA  = this.#muEMA  * a + input          * (1 - a);
      this.#ampEMA = this.#ampEMA * a + Math.abs(input) * (1 - a);
    }
  }

  // Asymmetric bell (gamma-like) + gentle background roll.
  //
  // The bell's peak sits at mu = muEMA × muScale.
  // Amplitude = ampEMA × amplitudeScale.
  // The side facing the direction of displacement is steeper (smaller σ);
  // the trailing side has a longer tail (larger σ) — mimicking gel drag.
  #waveHeight(wx, wz, t) {
    const p  = this.params;
    const mu = this.#muEMA  * p.muScale;
    const A  = this.#ampEMA * p.amplitudeScale;

    const d       = wx - mu;
    const dir     = Math.sign(this.#muEMA); // +1 right, -1 left, 0 at rest
    // Leading edge (same side as displacement): steeper. Trailing: wider.
    const sigmaEff = p.sigma * Math.max(0.1,
      1 - p.asymmetryScale * 0.45 * dir * Math.sign(d));
    const bell = A * Math.exp(-(d * d) / (2 * sigmaEff * sigmaEff));

    // Gentle background wave rolls in the Z direction for idle visual interest
    const bg = p.bgAmplitude * Math.sin(p.bgFreq * wz - p.bgSpeed * t);

    return bell + bg;
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

    const EPS = 2.0; // world-unit step for finite-difference normal

    for (const c of this.#crystals) {
      const wy  = this.#waveHeight(c.wx, c.wz, t);
      const dhx = (this.#waveHeight(c.wx + EPS, c.wz, t) - wy) / EPS;
      const dhz = (this.#waveHeight(c.wx, c.wz + EPS, t) - wy) / EPS;

      // Inward surface normal is (dhx, 1, dhz); align crystal's Y-axis with it.
      // tiltAngle = atan(slope), rotation axis = (dhz, 0, -dhx) normalised.
      const sl = Math.sqrt(dhx * dhx + dhz * dhz);

      gfx.push();
      gfx.translate(c.wx, -wy, c.wz);
      if (sl > 1e-6) {
        gfx.rotate(Math.atan2(sl, 1), [dhz / sl, 0, -dhx / sl]);
      }
      gfx.rotateY(c.rotY);
      gfx.texture(c.img);
      gfx.plane(c.sz, c.sz * c.aspect);
      gfx.pop();
    }

    gfx.drawingContext.depthMask(true);
  }
}
