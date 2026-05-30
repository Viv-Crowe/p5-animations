// Renders stereocilia clumps below the crystal box, concentrated toward the front.
// One instanced draw call per frame — all hairs across all clumps.
// Each hair is a view-space billboard quad (always faces camera).

// Instance buffer layout (5 floats = 20 bytes per hair):
//   [0-1] baseXZ    (vec2)  world X,Z of base
//   [2]   height    (float)
//   [3]   deflection(float) world-space X offset of tip
//   [4]   radius    (float) view-space half-width

export class HairCellLayer {
  params = {
    clumpCount:      10,
    hairsPerClump:   6,
    hairLength:      0.20,  // fraction of gridHeight
    clumpSize:       0.8,   // XZ spread radius
    kinociliumScale: 2.0,   // multiplier on maxH
    deflectionScale: 0.5,
    baseY:          -4.0,   // world-space Y of hair base (below crystal box at y=0)
    frontFraction:   0.5,   // fraction of Z range used — 0.5 = front half only
  };

  #canvas; #wgl;
  #program = null;
  #quadBuf;
  #instanceBuf;
  #instanceData = null;
  #totalHairs = 0;
  #loaded = false;
  #gridW; #gridH; #gridD;

  // per-hair spring state (used in update())
  #deflections = null;
  #hairHeights = null;
  #phases = null;

  constructor(canvas, wgl, gridW, gridH, gridD) {
    this.#canvas = canvas;
    this.#wgl    = wgl;
    this.#gridW  = gridW;
    this.#gridH  = gridH;
    this.#gridD  = gridD;

    this.#quadBuf = wgl.createBuffer();
    wgl.bufferData(this.#quadBuf, wgl.ARRAY_BUFFER,
      new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]),
      wgl.STATIC_DRAW);

    this.#instanceBuf = wgl.createBuffer();

    wgl.createProgramFromFiles(
      'shaders/hair.vert',
      'shaders/hair.frag',
      { a_position: 0, a_baseXZ: 1, a_height: 2, a_deflection: 3, a_radius: 4 },
      (program) => {
        this.#program = program;
        this.#buildInstances();
        this.#loaded = true;
      }
    );
  }

  #buildInstances() {
    const { clumpCount, hairsPerClump, hairLength, clumpSize, kinociliumScale } = this.params;
    const maxH       = hairLength * this.#gridH;
    const totalHairs = clumpCount * (hairsPerClump + 1); // +1 kinocilium per clump

    this.#totalHairs  = totalHairs;
    this.#deflections = new Float32Array(totalHairs);
    this.#hairHeights = new Float32Array(totalHairs);
    this.#phases      = Array.from({ length: totalHairs }, () => 0.85 + Math.random() * 0.12);

    const data = new Float32Array(totalHairs * 5);
    let hi = 0;

    const zMin = this.#gridD * (1 - this.params.frontFraction) + 2;
    const zMax = this.#gridD - 2;

    for (let c = 0; c < clumpCount; c++) {
      const cx = 2 + Math.random() * (this.#gridW - 4);
      const cz = zMin + Math.random() * (zMax - zMin);

      for (let j = 0; j < hairsPerClump; j++) {
        const angle = (j / hairsPerClump) * Math.PI * 2 + Math.random() * 0.5;
        const r     = Math.random() * clumpSize * 0.6;
        const bx    = cx + Math.cos(angle) * r;
        const bz    = cz + Math.sin(angle) * r;

        // staircase heights: 0.7–1.0 × maxH
        const t    = hairsPerClump > 1 ? j / (hairsPerClump - 1) : 0.5;
        const h    = maxH * (0.7 + t * 0.3);
        const rad  = maxH * 0.18;
        const tilt = (Math.random() - 0.5) * h * 0.08;

        this.#hairHeights[hi] = h;
        const i5 = hi * 5;
        data[i5]     = bx;
        data[i5 + 1] = bz;
        data[i5 + 2] = h;
        data[i5 + 3] = tilt;
        data[i5 + 4] = rad;
        hi++;
      }

      // kinocilium — taller, near clump centre
      const kbx  = cx + (Math.random() - 0.5) * clumpSize * 0.3;
      const kbz  = cz + (Math.random() - 0.5) * clumpSize * 0.3;
      const kh   = maxH * kinociliumScale;
      const krad = maxH * 0.22;
      const ktilt = (Math.random() - 0.5) * kh * 0.04;

      this.#hairHeights[hi] = kh;
      const i5 = hi * 5;
      data[i5]     = kbx;
      data[i5 + 1] = kbz;
      data[i5 + 2] = kh;
      data[i5 + 3] = ktilt;
      data[i5 + 4] = krad;
      hi++;
    }

    this.#instanceData = data;
    this.#wgl.bufferData(
      this.#instanceBuf, this.#wgl.ARRAY_BUFFER,
      data, this.#wgl.DYNAMIC_DRAW
    );
  }

  rebuild() {
    if (this.#program) this.#buildInstances();
  }

  update(signal) {
    if (!this.#loaded || !this.#instanceData) return;

    const { deflectionScale } = this.params;
    const target = signal && !signal.noSignal
      ? (signal.accelX ?? 0) * deflectionScale
      : 0;

    const data = this.#instanceData;
    let changed = false;

    for (let hi = 0; hi < this.#totalHairs; hi++) {
      const h    = this.#hairHeights[hi];
      const lerp = this.#phases[hi] * 0.10;
      let defl   = this.#deflections[hi];
      defl += (target - defl) * lerp;

      // clamp to ±30° lean
      const maxDefl = h * 0.577; // tan(30°)
      if (defl >  maxDefl) defl =  maxDefl;
      if (defl < -maxDefl) defl = -maxDefl;

      if (defl !== this.#deflections[hi]) {
        this.#deflections[hi] = defl;
        data[hi * 5 + 3] = defl;
        changed = true;
      }
    }

    if (changed) {
      this.#wgl.bufferData(
        this.#instanceBuf, this.#wgl.ARRAY_BUFFER,
        data, this.#wgl.DYNAMIC_DRAW
      );
    }
  }

  draw(projMatrix, viewMatrix) {
    if (!this.#loaded) return;
    const wgl = this.#wgl;
    if (!wgl.instancedExt) return;

    const ds = wgl.createDrawState()
      .bindFramebuffer(null)
      .viewport(0, 0, this.#canvas.width, this.#canvas.height)
      .enable(wgl.DEPTH_TEST)
      .useProgram(this.#program)

      .vertexAttribPointer(this.#quadBuf, 0, 2, wgl.FLOAT, false, 0, 0)

      .vertexAttribPointer(this.#instanceBuf, 1, 2, wgl.FLOAT, false, 20,  0)
      .vertexAttribDivisorANGLE(1, 1)
      .vertexAttribPointer(this.#instanceBuf, 2, 1, wgl.FLOAT, false, 20,  8)
      .vertexAttribDivisorANGLE(2, 1)
      .vertexAttribPointer(this.#instanceBuf, 3, 1, wgl.FLOAT, false, 20, 12)
      .vertexAttribDivisorANGLE(3, 1)
      .vertexAttribPointer(this.#instanceBuf, 4, 1, wgl.FLOAT, false, 20, 16)
      .vertexAttribDivisorANGLE(4, 1)

      .uniformMatrix4fv('u_projectionMatrix', false, projMatrix)
      .uniformMatrix4fv('u_viewMatrix', false, viewMatrix)
      .uniform1f('u_baseY', this.params.baseY);

    wgl.drawArraysInstancedANGLE(ds, wgl.TRIANGLE_STRIP, 0, 4, this.#totalHairs);
  }
}
