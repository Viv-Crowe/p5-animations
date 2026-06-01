// Renders firing action-potential waves on a set of packed RGB neuron PNGs.
// R channel = shape mask (white=inside). G channel = travel map (bright=fires first).
//
// Each animation play-through has three fixed phases (durations never change):
//   0 → FIRE_DUR   : wave sweeps soma (high G) → axon tips (low G)
//   +CLEAR_DUR      : trailing band clears off the axon tips
//   +FLASH_DUR      : G-channel pattern flashes inside the shape
// After that the neuron is invisible until the next Poisson-sampled fire event.
// The ISI (inter-fire interval) is what changes with acceleration, not the wave speed.

const BAND_W    = 0.15;
const FIRE_DUR  = 1.6;
const CLEAR_DUR = BAND_W * FIRE_DUR;
const FLASH_DUR = 0.7;

const NEURON_COUNT = 12;
const PATHS = Array.from({ length: NEURON_COUNT }, (_, i) =>
  `./assets/nerves/nueron${i + 1}.png`
);

const VS = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 vUV;
void main() {
  vUV = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FS = `
precision mediump float;
uniform sampler2D uNeuron;
uniform float uT;
uniform float uFlash;
uniform float uFlashAlpha;
uniform float uAlpha;
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
    float a = uFlashAlpha * mask * g;
    gl_FragColor = vec4(uTint * a, a);
    return;
  }

  float front = 1.0 - uT;
  float band  = smoothstep(front, front + FADE_IN, g)
              * (1.0 - smoothstep(front + BAND_W, front + BAND_W + FADE_OUT, g));
  float a = band * uAlpha;
  gl_FragColor = vec4(uTint * a, a);
}
`;

export class NeuronLayer {
  #canvas;
  #gl;
  #prog;
  #locs = {};
  #buf;
  #textures = [];
  #ready    = [];
  #alphas   = [];   // per-neuron alpha, randomised once at construction
  #texW = 1;
  #texH = 1;

  // Per-neuron fire state
  #fire = PATHS.map(() => ({ nextFire: 0, waveStart: -Infinity }));

  params = {
    visible:         true,
    tintColor:       { r: 175, g: 30, b: 50 },
    basePeriod:      14.0,
    velMax:        5.0,
    velSensitivity: 1.0,
    modulationDepth: 0.7,
    flashAlpha:      0.2,
    showFlash:       true,
    x1:              0.35,
    x2:              0.65,
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

    PATHS.forEach((path, i) => {
      this.#textures.push(this.#loadTexture(path, i));
      this.#ready.push(false);
      this.#alphas.push(0.4 + Math.random() * 0.4);
    });

    // Stagger initial fire times across the full base period
    const p = this.params.basePeriod;
    this.#fire.forEach((f, i) => {
      f.nextFire = (i / NEURON_COUNT) * p + Math.random() * (p / NEURON_COUNT);
    });

    this.resize(w, h);
  }

  #sampleISI(signal) {
    const ax   = (signal?.velX ?? 0) * this.params.velSensitivity;
    const norm = Math.max(-1, Math.min(1, ax / this.params.velMax));
    const mean = this.params.basePeriod * Math.exp(-norm * this.params.modulationDepth);
    return Math.max(0.03, -mean * Math.log(Math.random()));
  }

  #getDrawState(now, waveStart) {
    const e = now - waveStart;
    if (e < FIRE_DUR + CLEAR_DUR)             return { uT: e / FIRE_DUR, flash: 0 };
    if (e < FIRE_DUR + CLEAR_DUR + FLASH_DUR) return { uT: 1.5, flash: this.params.showFlash ? 1 : 0 };
    return                                           { uT: 1.5,          flash: 0 };
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
      a_pos:       gl.getAttribLocation(p,  'a_pos'),
      a_uv:        gl.getAttribLocation(p,  'a_uv'),
      uNeuron:     gl.getUniformLocation(p, 'uNeuron'),
      uT:          gl.getUniformLocation(p, 'uT'),
      uFlash:      gl.getUniformLocation(p, 'uFlash'),
      uFlashAlpha: gl.getUniformLocation(p, 'uFlashAlpha'),
      uAlpha:      gl.getUniformLocation(p, 'uAlpha'),
      uTint:       gl.getUniformLocation(p, 'uTint'),
    };
  }

  #loadTexture(src, index) {
    const gl  = this.#gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]));

    const img = new Image();
    img.src = src;
    img.onload = () => {
      const firstLoad = this.#texW === 1;
      if (firstLoad) { this.#texW = img.naturalWidth; this.#texH = img.naturalHeight; }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.#ready[index] = true;
      if (firstLoad) this.#updateQuad();
    };
    img.onerror = () => console.error('NeuronLayer: failed to load', src);
    return tex;
  }

  #updateQuad() {
    const gl   = this.#gl;
    const W    = this.#canvas.width;
    const H    = this.#canvas.height;
    const imgH = this.#texH > 0 ? W * this.#texH / this.#texW : H;
    const yTop = -1.0 + 2.0 * imgH / H;

    const verts = new Float32Array([
      -1, -1,    0, 1,
       1, -1,    1, 1,
      -1, yTop,  0, 0,
       1, yTop,  1, 0,
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

    if (!this.params.visible || !this.#ready.some(Boolean)) return;

    const now = performance.now() / 1000;

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

    for (let i = 0; i < this.#textures.length; i++) {
      if (!this.#ready[i]) continue;
      const { uT, flash } = this.#getDrawState(now, this.#fire[i].waveStart);
      gl.bindTexture(gl.TEXTURE_2D, this.#textures[i]);
      gl.uniform1f(L.uT,     uT);
      gl.uniform1f(L.uFlash, flash);
      gl.uniform1f(L.uAlpha, this.#alphas[i]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
}
