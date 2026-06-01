// Renders a firing action-potential wave on a packed RGB neuron PNG.
// R channel = shape mask (white=inside). G channel = travel map (bright=fires first).
//
// Each animation play-through has three fixed phases (durations never change):
//   0 → FIRE_DUR   : wave sweeps soma (high G) → axon tips (low G)
//   +CLEAR_DUR      : trailing band clears off the axon tips
//   +FLASH_DUR      : G-channel pattern flashes inside the shape
// After that the neuron is invisible until the next Poisson-sampled fire event.
// The ISI (inter-fire interval) is what changes with acceleration, not the wave speed.

const BAND_W    = 0.15;               // lit band width in G-space (0–1)
const FIRE_DUR  = 0.8;               // seconds for wave to traverse neuron
const CLEAR_DUR = BAND_W * FIRE_DUR; // time for trailing edge to clear
const FLASH_DUR = 0.35;              // duration of the G-channel flash after the wave

const VS = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 vUV;
void main() {
  vUV = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// BAND_W injected so JS and GLSL values stay in sync.
const FS = `
precision mediump float;
uniform sampler2D uNeuron;
uniform float uT;         // 0→1+ firing/clearing; 1.5 invisible
uniform float uFlash;     // 0 = wave mode, 1 = G-channel flash mode
uniform float uFlashAlpha;
uniform vec3  uTint;
varying vec2 vUV;

const float BAND_W   = ${BAND_W.toFixed(4)};
const float FADE_IN  = 0.01;
const float FADE_OUT = 0.05;

void main() {
  vec4  tex  = texture2D(uNeuron, vUV);
  float mask = tex.r;
  if (mask < 0.1) discard;

  float g = tex.g;

  if (uFlash > 0.5) {
    // Flash: alpha = flashAlpha × R × G (premultiplied)
    float a = uFlashAlpha * mask * g;
    gl_FragColor = vec4(uTint * a, a);
    return;
  }

  // Wave front descends from 1 (bright soma fires first) to 0 (dark axon fires last).
  // Band trails BEHIND the front: covers g in [front, front + BAND_W].
  float front = 1.0 - uT;
  float band  = smoothstep(front, front + FADE_IN, g)
              * (1.0 - smoothstep(front + BAND_W, front + BAND_W + FADE_OUT, g));

  gl_FragColor = vec4(uTint * band, band);
}
`;

export class NeuronLayer {
  #canvas;
  #gl;
  #prog;
  #locs = {};
  #buf;
  #texture1;  #ready1 = false;
  #texture2;  #ready2 = false;
  #texW = 1;
  #texH = 1;

  // Per-neuron fire state: when to next fire, and when the current wave started.
  #fire = [
    { nextFire: 0, waveStart: -Infinity },
    { nextFire: 0, waveStart: -Infinity },
  ];

  params = {
    visible:         true,
    tintColor:       { r: 51, g: 255, b: 229 },
    basePeriod:      1.0,     // mean ISI in seconds — how often the animation fires
    accelMax:        5.0,     // signal.accelX value treated as maximum
    modulationDepth: 0.7,     // ln-scale: 0=no effect, 0.7≈2× range, 1.4≈4× range
    flashAlpha:      0.2,     // G-channel flash alpha_param (alpha = flashAlpha × R × G)
    x1:              0.35,    // normalised screen X for neuron1 (future fluid sampling)
    x2:              0.65,    // normalised screen X for neuron2
  };

  constructor(containerEl, w, h) {
    this.#canvas = document.createElement('canvas');
    Object.assign(this.#canvas.style, {
      position: 'fixed', top: '0', left: '0',
      zIndex: '2', pointerEvents: 'none',
    });
    containerEl.appendChild(this.#canvas);

    const gl = this.#canvas.getContext('webgl');
    this.#gl = gl;

    this.#prog = this.#buildProgram(VS, FS);
    this.#cacheLocs();
    this.#buf = gl.createBuffer();
    this.#texture1 = this.#loadTexture('./assets/nerves/nueron1.png', 1);
    this.#texture2 = this.#loadTexture('./assets/nerves/nueron2.png', 2);

    // Stagger initial fire times so the two neurons don't sync on load
    const p = this.params.basePeriod;
    this.#fire[0].nextFire = Math.random() * p;
    this.#fire[1].nextFire = Math.random() * p;

    this.resize(w, h);
  }

  // Sample next inter-spike interval from Exp(mean) distribution, modulated by accelX.
  #sampleISI(signal) {
    const ax   = signal?.accelX ?? 0;
    const norm = Math.max(-1, Math.min(1, ax / this.params.accelMax));
    const mean = this.params.basePeriod * Math.exp(-norm * this.params.modulationDepth);
    return Math.max(0.03, -mean * Math.log(Math.random()));
  }

  // Returns { uT, flash } for the current elapsed time since a wave started.
  #getDrawState(now, waveStart) {
    const e = now - waveStart;
    if (e < FIRE_DUR + CLEAR_DUR)                    return { uT: e / FIRE_DUR, flash: 0 };
    if (e < FIRE_DUR + CLEAR_DUR + FLASH_DUR)        return { uT: 1.5,          flash: 1 };
    return                                                   { uT: 1.5,          flash: 0 };
  }

  #buildProgram(vsSrc, fsSrc) {
    const gl = this.#gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        console.error('NeuronLayer shader:', gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      console.error('NeuronLayer link:', gl.getProgramInfoLog(prog));
    return prog;
  }

  #cacheLocs() {
    const gl = this.#gl;
    const p  = this.#prog;
    this.#locs = {
      a_pos:      gl.getAttribLocation(p,  'a_pos'),
      a_uv:       gl.getAttribLocation(p,  'a_uv'),
      uNeuron:    gl.getUniformLocation(p, 'uNeuron'),
      uT:         gl.getUniformLocation(p, 'uT'),
      uFlash:     gl.getUniformLocation(p, 'uFlash'),
      uFlashAlpha:gl.getUniformLocation(p, 'uFlashAlpha'),
      uTint:      gl.getUniformLocation(p, 'uTint'),
    };
  }

  #loadTexture(src, slot) {
    const gl  = this.#gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]));

    const img = new Image();
    img.src = src;
    img.onload = () => {
      if (slot === 1) { this.#texW = img.naturalWidth; this.#texH = img.naturalHeight; }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (slot === 1) { this.#ready1 = true; this.#updateQuad(); }
      if (slot === 2)   this.#ready2 = true;
    };
    img.onerror = () => console.error('NeuronLayer: failed to load', src);
    return tex;
  }

  // Quad covering the same screen rect as p.image(nerveImg, 0, height-imgH, width, imgH).
  // UV (0,0) = image top-left (soma, bright G), UV (1,1) = bottom-right (axon, dark G).
  #updateQuad() {
    const gl   = this.#gl;
    const W    = this.#canvas.width;
    const H    = this.#canvas.height;
    const imgH = this.#texH > 0 ? W * this.#texH / this.#texW : H;
    const yTop = -1.0 + 2.0 * imgH / H;

    const verts = new Float32Array([
      -1, -1,    0, 1,   // BL → image bottom-right = axon tips
       1, -1,    1, 1,   // BR
      -1, yTop,  0, 0,   // TL → image top-left = soma
       1, yTop,  1, 0,   // TR
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
  }

  resize(w, h) {
    this.#canvas.width  = w;
    this.#canvas.height = h;
    this.#gl.viewport(0, 0, w, h);
    this.#updateQuad();
  }

  update(signal) {
    const gl = this.#gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!this.params.visible || (!this.#ready1 && !this.#ready2)) return;

    const now = performance.now() / 1000;

    // Advance Poisson fire events for each neuron
    for (const f of this.#fire) {
      if (now >= f.nextFire) {
        f.waveStart = now;
        f.nextFire  = now + this.#sampleISI(signal);
      }
    }

    const L = this.#locs;
    const c = this.params.tintColor;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.#prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.#buf);
    const STRIDE = 4 * Float32Array.BYTES_PER_ELEMENT;
    const OFFSET = 2 * Float32Array.BYTES_PER_ELEMENT;
    gl.enableVertexAttribArray(L.a_pos);
    gl.vertexAttribPointer(L.a_pos, 2, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(L.a_uv);
    gl.vertexAttribPointer(L.a_uv,  2, gl.FLOAT, false, STRIDE, OFFSET);

    gl.uniform3f(L.uTint, c.r / 255, c.g / 255, c.b / 255);
    gl.uniform1f(L.uFlashAlpha, this.params.flashAlpha);
    gl.uniform1i(L.uNeuron, 0);
    gl.activeTexture(gl.TEXTURE0);

    const textures = [this.#texture1, this.#texture2];
    const ready    = [this.#ready1,   this.#ready2];
    for (let i = 0; i < 2; i++) {
      if (!ready[i]) continue;
      const { uT, flash } = this.#getDrawState(now, this.#fire[i].waveStart);
      gl.bindTexture(gl.TEXTURE_2D, textures[i]);
      gl.uniform1f(L.uT,     uT);
      gl.uniform1f(L.uFlash, flash);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
}
