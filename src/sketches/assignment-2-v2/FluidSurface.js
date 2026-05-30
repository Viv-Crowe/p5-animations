// Wraps the dli/fluid FLIP simulation as a drop-in layer.
// Requires the fluid/*.js scripts loaded as <script> tags before this module.
// Creates its own WebGL canvas behind the p5 canvas.

import { HairCellLayer } from './HairCellLayer.js';

const GRID_WIDTH  = 111;
const GRID_HEIGHT = 2;
const GRID_DEPTH  = 38;
const PARTICLES_PER_CELL = 3; // default; overridden by params.particlesPerCell
const GRID_CELL_DENSITY  = 0.5;
const FOV = Math.PI / 3;

// Camera above the box; box top at ~33% from screen top, bottom at ~44%.
// elev=0.5 (~29°), orbitY=-2: verified via view-matrix projection.
const CAM_DIST = 29;
const CAM_ELEV = 0.5;   // radians (~29°) above horizontal — camera clearly above box

// Otolith palette — 16 colours visually sampled from the SEM microscopy image.
// Mauve/purple, sage green, and warm cream tones.
const PALETTE_N = 16;
// prettier-ignore
const PALETTE_RGBA = new Uint8Array([
  200, 175, 200, 255,  // light mauve
  175, 148, 182, 255,  // medium purple
  152, 122, 158, 255,  // dark mauve
  185, 165, 192, 255,  // soft lavender
  165, 185, 155, 255,  // sage green
  143, 168, 138, 255,  // medium sage
  182, 200, 170, 255,  // light sage
  155, 175, 145, 255,  // muted sage
  228, 215, 168, 255,  // warm cream
  210, 200, 150, 255,  // amber cream
  236, 226, 178, 255,  // pale cream
  195, 178, 132, 255,  // ochre
  192, 168, 185, 255,  // dusty rose
  168, 152, 172, 255,  // gray purple
  185, 200, 175, 255,  // pale sage
  145, 115, 152, 255,  // deep mauve
]);

export class FluidSurface {
  params = {
    timeStep:        0.003,
    flipness:        0.03,
    forceMultiplier: 2.0,
    // Box position — camera orbit target (real-time, no rebuild needed)
    orbitX: 49,
    orbitY: -9.8,
    orbitZ: 20,
    // Box size — requires rebuild()
    gridWidth:       GRID_WIDTH,
    gridHeight:      GRID_HEIGHT,
    gridDepth:       GRID_DEPTH,
    particlesPerCell: PARTICLES_PER_CELL,
    // Crystal shape (index into CRYSTAL_GEOMETRIES, no rebuild needed)
    crystalIndex: 0,
  };

  #canvas;
  #wgl;
  #projectionMatrix;
  #camera;
  #simRend;
  #hairLayer;
  #loaded = false;

  get simulator() { return this.#simRend?.simulator ?? null; }
  get renderer()  { return this.#simRend?.renderer  ?? null; }
  get hairLayer() { return this.#hairLayer; }

  constructor() {
    this.#canvas = document.createElement('canvas');
    this.#canvas.id = 'fluid-canvas';
    Object.assign(this.#canvas.style, {
      position: 'fixed', top: '0', left: '0',
      display: 'block', zIndex: '0',
    });
    this.#canvas.width  = window.innerWidth;
    this.#canvas.height = window.innerHeight;
    document.body.insertBefore(this.#canvas, document.body.firstChild);

    this.#wgl = new WrappedGL(this.#canvas); // eslint-disable-line no-undef
    window.wgl = this.#wgl; // renderer.js references wgl as a global

    this.#projectionMatrix = Utilities.makePerspectiveMatrix( // eslint-disable-line no-undef
      new Float32Array(16), FOV, this.#canvas.width / this.#canvas.height, 0.1, 100.0
    );
    this.#camera = new Camera(this.#canvas, [this.params.orbitX, this.params.orbitY, this.params.orbitZ]); // eslint-disable-line no-undef

    this.#simRend = new SimulatorRenderer( // eslint-disable-line no-undef
      this.#canvas, this.#wgl, this.#projectionMatrix, this.#camera,
      [GRID_WIDTH, GRID_HEIGHT, GRID_DEPTH],
      () => this.#start()
    );

    this.#hairLayer = new HairCellLayer(
      this.#canvas, this.#wgl,
      GRID_WIDTH, GRID_HEIGHT, GRID_DEPTH
    );
  }

  #start() {
    // Low angle camera
    this.#camera.elevation = CAM_ELEV;
    this.#camera.azimuth   = 0;
    this.#camera.distance  = CAM_DIST;
    this.#camera.recomputeViewMatrix();
    this.#camera.setBounds(0.02, Math.PI / 3);

    this.#simRend.simulator.flipness = this.params.flipness;

    // Load crystal from library if available, otherwise keep simple fallback
    if (window.CRYSTAL_GEOMETRIES?.length) {
      this.setCrystal(this.params.crystalIndex);
    }

    // Apply hardcoded otolith palette immediately
    this.#applyPalette(PALETTE_RGBA, PALETTE_N);

    // Also try to load the image from assets for true random sampling
    this.#tryLoadImage('./assets/stones/otoliths.jpg');

    // Fill entire grid volume so the particle box matches the containing box exactly
    this.#beginSim([
      new BoxEditor.AABB([0, 0, 0], [this.params.gridWidth, this.params.gridHeight, this.params.gridDepth]), // eslint-disable-line no-undef
    ]);

    this.#loaded = true;
  }

  #applyPalette(rgbaUint8, n) {
    const tex = this.#wgl.buildTexture(
      this.#wgl.RGBA, this.#wgl.UNSIGNED_BYTE, n, 1, rgbaUint8,
      this.#wgl.CLAMP_TO_EDGE, this.#wgl.CLAMP_TO_EDGE,
      this.#wgl.NEAREST, this.#wgl.NEAREST
    );
    if (this.#simRend?.renderer) {
      this.#simRend.renderer.paletteTexture = tex;
      this.#simRend.renderer.paletteSize    = n;
    }
  }

  #tryLoadImage(src) {
    const img = new Image();
    img.onload = () => {
      const c   = document.createElement('canvas');
      c.width   = img.naturalWidth;
      c.height  = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;

      // Collect non-transparent, non-white pixels
      const visible = [];
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 128 && d[i] + d[i + 1] + d[i + 2] < 720) visible.push(i);
      }
      if (!visible.length) return;

      const rgba = new Uint8Array(PALETTE_N * 4);
      for (let i = 0; i < PALETTE_N; i++) {
        const idx  = visible[Math.floor(Math.random() * visible.length)];
        rgba[i * 4]     = d[idx];
        rgba[i * 4 + 1] = d[idx + 1];
        rgba[i * 4 + 2] = d[idx + 2];
        rgba[i * 4 + 3] = 255;
      }
      this.#applyPalette(rgba, PALETTE_N);
    };
    img.src = src;
  }

  #beginSim(boxes) {
    const GW = this.params.gridWidth;
    const GH = this.params.gridHeight;
    const GD = this.params.gridDepth;
    const gridCells = GW * GH * GD * GRID_CELL_DENSITY;
    const gy = Math.ceil(Math.pow(gridCells / 2, 1 / 3));
    const gz = gy, gx = gy * 2;
    const gridSize       = [GW, GH, GD];
    const gridResolution = [gx, gy, gz];
    const sphereRadius   = 7.0 / gx;

    const totalVol = boxes.reduce((s, b) => s + b.computeVolume(), 0);
    const fraction = totalVol / (GW * GH * GD);
    const desired  = fraction * gx * gy * gz * this.params.particlesPerCell;

    const pw = 512;
    const ph = Math.ceil(desired / pw);
    const particleCount = pw * ph;

    const positions = [];
    let made = 0;
    for (let i = 0; i < boxes.length; i++) {
      const n = i < boxes.length - 1
        ? Math.floor(particleCount * boxes[i].computeVolume() / totalVol)
        : particleCount - made;
      for (let j = 0; j < n; j++) positions.push(boxes[i].randomPoint());
      made += n;
    }

    this.#simRend.reset(pw, ph, positions, gridSize, gridResolution, this.params.particlesPerCell, sphereRadius);
  }

  // Swap crystal shape live — no sim restart needed
  setCrystal(index) {
    if (!this.#loaded || !window.CRYSTAL_GEOMETRIES?.length) return;
    this.params.crystalIndex = index;
    const geo = window.CRYSTAL_GEOMETRIES[index % window.CRYSTAL_GEOMETRIES.length];
    this.#simRend?.renderer?.setCrystal(geo);
  }

  // Apply orbit changes live — no sim restart needed
  applyCamera() {
    if (!this.#camera) return;
    this.#camera.orbitPoint[0] = this.params.orbitX;
    this.#camera.orbitPoint[1] = this.params.orbitY;
    this.#camera.orbitPoint[2] = this.params.orbitZ;
    this.#camera.recomputeViewMatrix();
  }

  // Restart the simulation with current gridWidth/Height/Depth
  rebuild() {
    if (!this.#loaded) return;
    this.#beginSim([
      new BoxEditor.AABB([0, 0, 0], [this.params.gridWidth, this.params.gridHeight, this.params.gridDepth]), // eslint-disable-line no-undef
    ]);
  }

  update(signal) {
    if (!this.#loaded) return;

    if (signal && !signal.noSignal) {
      this.#simRend.mouseX = (signal.x / this.#canvas.width) * 2 - 1;
      this.#simRend.mouseY = -signal.accelX * this.params.forceMultiplier * 0.05;
    }

    this.#simRend.update(this.params.timeStep);
    this.#hairLayer.update(signal);
    this.#hairLayer.draw(this.#projectionMatrix, this.#camera.getViewMatrix());
  }

  resize(w, h) {
    this.#canvas.width  = w;
    this.#canvas.height = h;
    Utilities.makePerspectiveMatrix(this.#projectionMatrix, FOV, w / h, 0.1, 100.0); // eslint-disable-line no-undef
    this.#simRend.onResize();
  }
}
