// ── Grid ─────────────────────────────────────────────────────────────────────
const GRID_X     = 60;    // vertices along x
const GRID_Z     = 60;    // vertices along z (depth)
const GRID_WIDTH = 800;   // world units, centred on x = 0
const GRID_DEPTH = 800;   // world units, z = 0 (near) → GRID_DEPTH (far)

// ── Camera ────────────────────────────────────────────────────────────────────
const CAM_X  =   0,  CAM_Y  = -80,  CAM_Z  = -60;
const LOOK_X =   0,  LOOK_Y =   0,  LOOK_Z = 400;

// ── Wave parameters ───────────────────────────────────────────────────────────
const IDLE_STATE = {
  ampLinear:   4,
  kLinear:     0.012,
  omegaLinear: 1.0,
  phaseLinear: 0,
  ampRadial:   9.5,
  kRadial:     0.025,
  omegaRadial: 1.8,
  radialDecay: 0.45,
  inputX:      0,
};

let PARAMS = { ...IDLE_STATE };

// ── Pre-allocated height cache ────────────────────────────────────────────────
const heights = Array.from({ length: GRID_Z }, () => new Float32Array(GRID_X));

// ── GUI state ─────────────────────────────────────────────────────────────────
const sliders = {};
const labels  = {};

// ─────────────────────────────────────────────────────────────────────────────
// Wave height function — single source of truth for renderer + physics.
//
// @param {number} wx      world x
// @param {number} wz      world z
// @param {number} t       time in seconds
// @param {number} inputX  disturbance source x (world units)
// @param {object} params  PARAMS object
// @returns {number}       y displacement (positive = up)
// ─────────────────────────────────────────────────────────────────────────────
function waveHeight(wx, wz, t, inputX, params) {
  // Planar wave: wavefronts are lines of constant z
  const linear = params.ampLinear
    * Math.sin(params.kLinear * wx - params.omegaLinear * t + params.phaseLinear);

  // Radial ripple: circular, decaying with distance from (inputX, 0)
  const dx    = wx - inputX;
  const r     = Math.sqrt(dx * dx + wz * wz);
  const decay = 1.0 / Math.pow(Math.max(r, 0.5), params.radialDecay);
  const radial = params.ampRadial
    * decay
    * Math.sin(params.kRadial * r - params.omegaRadial * t);

  return linear + radial;
}

// ─────────────────────────────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  perspective(PI / 3.5, width / height, 1, 5000);

  // ── GUI panel ──────────────────────────────────────────────────────────────
  const gui = createDiv('');
  gui.position(0, 0);
  gui.style('position',   'fixed');
  gui.style('top',        '10px');
  gui.style('left',       '10px');
  gui.style('background', 'rgba(0,5,15,0.70)');
  gui.style('padding',    '10px 14px 12px');
  gui.style('color',      '#8ab8f0');
  gui.style('font-family','monospace');
  gui.style('font-size',  '11px');
  gui.style('border',     '1px solid rgba(100,160,255,0.18)');
  gui.style('min-width',  '210px');
  gui.style('z-index',    '10');

  function addSlider(param, min, max, step, name) {
    const lbl = createP(name);
    lbl.parent(gui);
    lbl.style('margin', '6px 0 2px');
    const sl = createSlider(min, max, PARAMS[param], step);
    sl.parent(gui);
    sl.style('width', '185px');
    sliders[param] = sl;
    labels[param]  = { el: lbl, name };
  }

  addSlider('ampLinear',   0,     30,   0.5,   'Amp Linear');
  addSlider('ampRadial',   0,     60,   0.5,   'Amp Radial');
  addSlider('radialDecay', 0.3,   1.0,  0.05,  'Radial Decay');
  addSlider('kLinear',     0.005, 0.04, 0.001, 'k Linear');
  addSlider('omegaLinear', 0.2,   3.0,  0.1,   'Omega Linear');
}

// ─────────────────────────────────────────────────────────────────────────────
function draw() {
  background(10, 15, 25);

  // Lock camera every frame
  camera(CAM_X, CAM_Y, CAM_Z, LOOK_X, LOOK_Y, LOOK_Z, 0, 1, 0);

  // Sync params + update labels
  for (const [param, sl] of Object.entries(sliders)) {
    PARAMS[param] = sl.value();
    labels[param].el.html(labels[param].name + ': ' + Number(PARAMS[param]).toFixed(3));
  }

  const t = millis() / 1000;

  // Pre-compute all heights (each vertex shared by two strips)
  for (let j = 0; j < GRID_Z; j++) {
    const wz = map(j, 0, GRID_Z - 1, 0, GRID_DEPTH);
    for (let i = 0; i < GRID_X; i++) {
      const wx = map(i, 0, GRID_X - 1, -GRID_WIDTH / 2, GRID_WIDTH / 2);
      heights[j][i] = waveHeight(wx, wz, t, PARAMS.inputX, PARAMS);
    }
  }

  // Render wireframe — one TRIANGLE_STRIP per row pair, alpha fades with depth
  noFill();
  strokeWeight(0.5);

  for (let j = 0; j < GRID_Z - 1; j++) {
    const wz0   = map(j,     0, GRID_Z - 1, 0, GRID_DEPTH);
    const wz1   = map(j + 1, 0, GRID_Z - 1, 0, GRID_DEPTH);
    const alpha = map(wz0, 0, GRID_DEPTH, 180, 20);
    stroke(100, 180, 255, alpha);

    beginShape(TRIANGLE_STRIP);
    for (let i = 0; i < GRID_X; i++) {
      const wx = map(i, 0, GRID_X - 1, -GRID_WIDTH / 2, GRID_WIDTH / 2);
      // p5 WEBGL: negative y = up; wave height is positive = up
      vertex(wx, -heights[j][i],     wz0);
      vertex(wx, -heights[j + 1][i], wz1);
    }
    endShape();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  perspective(PI / 3.5, width / height, 1, 5000);
}

// ── Public API (for physics engine integration) ───────────────────────────────
window.getWaveHeight = function(wx, wz) {
  return waveHeight(wx, wz, millis() / 1000, PARAMS.inputX, PARAMS);
};

window.setWaveInputX = function(x) {
  PARAMS.inputX = x;
};
