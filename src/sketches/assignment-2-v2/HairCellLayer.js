// Renders stereocilia bundles and cell body domes.
// Bundles: flat staircase paddle — rows × cols grid, wide X thin Z, per-clump spring.
// Domes: billboard ellipse per clump, drawn before hairs.
//
// Hair instance buffer (5 floats = 20 bytes per hair):
//   [0-1] baseXZ    (vec2)  world X,Z of base
//   [2]   height    (float)
//   [3]   deflection(float) world-space X offset of tip
//   [4]   radius    (float) view-space half-width
//
// Dome instance buffer (4 floats = 16 bytes per clump):
//   [0-1] baseXZ    (vec2)
//   [2]   radius    (float)
//   [3]   flatness  (float) Y scale (< 1 squashes to ellipse)

export class HairCellLayer {
  params = {
    clumpCount:     7,
    rows:           4,
    colsPerRow:     8,
    hairLength:     0.20,     // fraction of gridHeight
    paddleWidth:    1.2,      // X spread of bundle (world units)
    paddleDepth:    0.25,     // Z spread of bundle (world units)
    staircaseMin:   0.45,     // height multiplier for front row
    deflectionScale: 0.5,
    baseY:          -4.0,
    frontFraction:  0.35,
    showDomes:      true,
  };

  #canvas; #wgl;
  #hairProgram = null;
  #domeProgram = null;
  #quadBuf;
  #hairBuf;
  #domeBuf;
  #hairData   = null;
  #domeData   = null;
  #totalHairs = 0;
  #loaded     = 0; // bit 0 = hair prog, bit 1 = dome prog
  #gridW; #gridH; #gridD;

  // per-clump spring state
  #clumpDeflections = null;
  #clumpPhases      = null;
  // per-hair height cache (for clamping)
  #hairHeights = null;
  // mapping: hair index → clump index
  #hairClump = null;

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

    this.#hairBuf = wgl.createBuffer();
    this.#domeBuf = wgl.createBuffer();

    wgl.createProgramFromFiles(
      'shaders/hair.vert',
      'shaders/hair.frag',
      { a_position: 0, a_baseXZ: 1, a_height: 2, a_deflection: 3, a_radius: 4 },
      (prog) => {
        this.#hairProgram = prog;
        this.#loaded |= 1;
        if (this.#loaded === 3) this.#buildInstances();
      }
    );

    wgl.createProgramFromFiles(
      'shaders/celldome.vert',
      'shaders/celldome.frag',
      { a_position: 0, a_baseXZ: 1, a_radius: 2, a_flatness: 3 },
      (prog) => {
        this.#domeProgram = prog;
        this.#loaded |= 2;
        if (this.#loaded === 3) this.#buildInstances();
      }
    );
  }

  #buildInstances() {
    const { clumpCount, rows, colsPerRow, hairLength, paddleWidth, paddleDepth,
            staircaseMin } = this.params;

    const maxH      = hairLength * this.#gridH;
    const hairsPerClump = rows * colsPerRow;
    const totalHairs    = clumpCount * hairsPerClump;

    this.#totalHairs      = totalHairs;
    this.#clumpDeflections = new Float32Array(clumpCount);
    this.#clumpPhases      = Array.from({ length: clumpCount },
                               () => 0.85 + Math.random() * 0.12);
    this.#hairHeights      = new Float32Array(totalHairs);
    this.#hairClump        = new Int32Array(totalHairs);

    const hairData = new Float32Array(totalHairs * 5);
    const domeData = new Float32Array(clumpCount * 4);

    const zMin = this.#gridD * (1 - this.params.frontFraction) + 2;
    const zMax = this.#gridD - 2;

    let hi = 0;

    for (let c = 0; c < clumpCount; c++) {
      const cx  = 2 + Math.random() * (this.#gridW - 4);
      const cz  = zMin + Math.random() * (zMax - zMin);
      const yaw = Math.random() * Math.PI * 2;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      // dome instance
      const d4 = c * 4;
      domeData[d4]     = cx;
      domeData[d4 + 1] = cz;
      domeData[d4 + 2] = paddleWidth * 0.55;  // dome radius spans the bundle footprint
      domeData[d4 + 3] = 0.55;          // flatness: squash into dome

      for (let r = 0; r < rows; r++) {
        const rowT = rows > 1 ? r / (rows - 1) : 0.5;   // 0=front(short), 1=back(tall)
        const h    = maxH * (staircaseMin + rowT * (1.0 - staircaseMin));
        const rad  = maxH * 0.08;

        for (let col = 0; col < colsPerRow; col++) {
          const colT  = colsPerRow > 1 ? col / (colsPerRow - 1) - 0.5 : 0;
          const localX = colT   * paddleWidth;
          const localZ = (rowT - 0.5) * paddleDepth;

          const bx = cx + localX * cosY - localZ * sinY;
          const bz = cz + localX * sinY + localZ * cosY;

          // tiny organic micro-tilt
          const tilt = (Math.random() - 0.5) * h * 0.04;

          this.#hairHeights[hi] = h;
          this.#hairClump[hi]   = c;

          const i5 = hi * 5;
          hairData[i5]     = bx;
          hairData[i5 + 1] = bz;
          hairData[i5 + 2] = h;
          hairData[i5 + 3] = tilt;
          hairData[i5 + 4] = rad;
          hi++;
        }
      }
    }

    this.#hairData = hairData;
    this.#domeData = domeData;

    this.#wgl.bufferData(this.#hairBuf, this.#wgl.ARRAY_BUFFER,
      hairData, this.#wgl.DYNAMIC_DRAW);
    this.#wgl.bufferData(this.#domeBuf, this.#wgl.ARRAY_BUFFER,
      domeData, this.#wgl.STATIC_DRAW);
  }

  rebuild() {
    if (this.#loaded === 3) this.#buildInstances();
  }

  update(signal) {
    if (this.#loaded !== 3 || !this.#hairData) return;

    const { deflectionScale } = this.params;
    const target = signal && !signal.noSignal
      ? (signal.accelX ?? 0) * deflectionScale
      : 0;

    const { clumpCount } = this.params;
    let changed = false;

    for (let c = 0; c < clumpCount; c++) {
      const lerp  = this.#clumpPhases[c] * 0.10;
      let defl    = this.#clumpDeflections[c];
      defl       += (target - defl) * lerp;

      // clamp to ±30° lean using average max height for this clump
      const maxDefl = this.#gridH * this.params.hairLength * 0.577;
      if (defl >  maxDefl) defl =  maxDefl;
      if (defl < -maxDefl) defl = -maxDefl;

      if (defl !== this.#clumpDeflections[c]) {
        this.#clumpDeflections[c] = defl;
        changed = true;
      }
    }

    if (changed) {
      const data = this.#hairData;
      for (let hi = 0; hi < this.#totalHairs; hi++) {
        data[hi * 5 + 3] = this.#clumpDeflections[this.#hairClump[hi]];
      }
      this.#wgl.bufferData(
        this.#hairBuf, this.#wgl.ARRAY_BUFFER, data, this.#wgl.DYNAMIC_DRAW);
    }
  }

  draw(projMatrix, viewMatrix) {
    if (this.#loaded !== 3) return;
    const wgl = this.#wgl;
    if (!wgl.instancedExt) return;

    // --- domes first — no depth write so they don't occlude hairs ---
    if (this.params.showDomes) {
      const ds = wgl.createDrawState()
        .bindFramebuffer(null)
        .viewport(0, 0, this.#canvas.width, this.#canvas.height)
        .enable(wgl.DEPTH_TEST)
        .depthMask(false)
        .enable(wgl.BLEND)
        .blendFuncSeparate(wgl.SRC_ALPHA, wgl.ONE_MINUS_SRC_ALPHA,
                           wgl.ONE, wgl.ONE_MINUS_SRC_ALPHA)
        .useProgram(this.#domeProgram)
        .vertexAttribPointer(this.#quadBuf, 0, 2, wgl.FLOAT, false, 0, 0)
        .vertexAttribPointer(this.#domeBuf, 1, 2, wgl.FLOAT, false, 16,  0)
        .vertexAttribDivisorANGLE(1, 1)
        .vertexAttribPointer(this.#domeBuf, 2, 1, wgl.FLOAT, false, 16,  8)
        .vertexAttribDivisorANGLE(2, 1)
        .vertexAttribPointer(this.#domeBuf, 3, 1, wgl.FLOAT, false, 16, 12)
        .vertexAttribDivisorANGLE(3, 1)
        .uniformMatrix4fv('u_projectionMatrix', false, projMatrix)
        .uniformMatrix4fv('u_viewMatrix',       false, viewMatrix)
        .uniform1f('u_baseY', this.params.baseY);

      wgl.drawArraysInstancedANGLE(ds, wgl.TRIANGLE_STRIP, 0, 4,
        this.params.clumpCount);
    }

    // --- hair quads (restore depth write) ---
    const ds = wgl.createDrawState()
      .bindFramebuffer(null)
      .viewport(0, 0, this.#canvas.width, this.#canvas.height)
      .enable(wgl.DEPTH_TEST)
      .depthMask(true)
      .disable(wgl.BLEND)
      .useProgram(this.#hairProgram)
      .vertexAttribPointer(this.#quadBuf, 0, 2, wgl.FLOAT, false, 0, 0)
      .vertexAttribPointer(this.#hairBuf, 1, 2, wgl.FLOAT, false, 20,  0)
      .vertexAttribDivisorANGLE(1, 1)
      .vertexAttribPointer(this.#hairBuf, 2, 1, wgl.FLOAT, false, 20,  8)
      .vertexAttribDivisorANGLE(2, 1)
      .vertexAttribPointer(this.#hairBuf, 3, 1, wgl.FLOAT, false, 20, 12)
      .vertexAttribDivisorANGLE(3, 1)
      .vertexAttribPointer(this.#hairBuf, 4, 1, wgl.FLOAT, false, 20, 16)
      .vertexAttribDivisorANGLE(4, 1)
      .uniformMatrix4fv('u_projectionMatrix', false, projMatrix)
      .uniformMatrix4fv('u_viewMatrix',       false, viewMatrix)
      .uniform1f('u_baseY', this.params.baseY);

    wgl.drawArraysInstancedANGLE(ds, wgl.TRIANGLE_STRIP, 0, 4, this.#totalHairs);
  }
}
