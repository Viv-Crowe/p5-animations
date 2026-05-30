const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');
if (!gl) { document.body.textContent = 'WebGL not supported'; throw new Error(); }

const instExt = gl.getExtension('ANGLE_instanced_arrays');
if (!instExt) { document.body.textContent = 'ANGLE_instanced_arrays required'; throw new Error(); }

// ─── mat4 (column-major, matches WebGL/GLSL) ────────────────────────────────

function m4() { return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); }

function perspective(out, fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  out[0]=f/aspect; out[1]=out[2]=out[3]=0;
  out[4]=0; out[5]=f; out[6]=out[7]=0;
  out[8]=out[9]=0; out[10]=(far+near)*nf; out[11]=-1;
  out[12]=out[13]=0; out[14]=2*far*near*nf; out[15]=0;
}

function lookAt(out, eye, center, up) {
  let z0=eye[0]-center[0], z1=eye[1]-center[1], z2=eye[2]-center[2];
  let len=1/Math.sqrt(z0*z0+z1*z1+z2*z2);
  z0*=len; z1*=len; z2*=len;
  let x0=up[1]*z2-up[2]*z1, x1=up[2]*z0-up[0]*z2, x2=up[0]*z1-up[1]*z0;
  len=Math.sqrt(x0*x0+x1*x1+x2*x2);
  if(len){len=1/len;x0*=len;x1*=len;x2*=len;}
  let y0=z1*x2-z2*x1, y1=z2*x0-z0*x2, y2=z0*x1-z1*x0;
  out[0]=x0;out[1]=y0;out[2]=z0;out[3]=0;
  out[4]=x1;out[5]=y1;out[6]=z1;out[7]=0;
  out[8]=x2;out[9]=y2;out[10]=z2;out[11]=0;
  out[12]=-(x0*eye[0]+x1*eye[1]+x2*eye[2]);
  out[13]=-(y0*eye[0]+y1*eye[1]+y2*eye[2]);
  out[14]=-(z0*eye[0]+z1*eye[1]+z2*eye[2]);
  out[15]=1;
}

function multiply(out, a, b) {
  const a0=a[0],a1=a[1],a2=a[2],a3=a[3];
  const a4=a[4],a5=a[5],a6=a[6],a7=a[7];
  const a8=a[8],a9=a[9],a10=a[10],a11=a[11];
  const a12=a[12],a13=a[13],a14=a[14],a15=a[15];
  for(let i=0;i<4;i++){
    const b0=b[i*4],b1=b[i*4+1],b2=b[i*4+2],b3=b[i*4+3];
    out[i*4]=b0*a0+b1*a4+b2*a8+b3*a12;
    out[i*4+1]=b0*a1+b1*a5+b2*a9+b3*a13;
    out[i*4+2]=b0*a2+b1*a6+b2*a10+b3*a14;
    out[i*4+3]=b0*a3+b1*a7+b2*a11+b3*a15;
  }
}

function invert(out, a) {
  const a0=a[0],a1=a[1],a2=a[2],a3=a[3];
  const a4=a[4],a5=a[5],a6=a[6],a7=a[7];
  const a8=a[8],a9=a[9],a10=a[10],a11=a[11];
  const a12=a[12],a13=a[13],a14=a[14],a15=a[15];
  const b0=a0*a5-a1*a4,b1=a0*a6-a2*a4,b2=a0*a7-a3*a4;
  const b3=a1*a6-a2*a5,b4=a1*a7-a3*a5,b5=a2*a7-a3*a6;
  const b6=a8*a13-a9*a12,b7=a8*a14-a10*a12,b8=a8*a15-a11*a12;
  const b9=a9*a14-a10*a13,b10=a9*a15-a11*a13,b11=a10*a15-a11*a14;
  let det=b0*b11-b1*b10+b2*b9+b3*b8-b4*b7+b5*b6;
  if(!det)return;
  det=1/det;
  out[0]=(a5*b11-a6*b10+a7*b9)*det;
  out[1]=(a2*b10-a1*b11-a3*b9)*det;
  out[2]=(a13*b5-a14*b4+a15*b3)*det;
  out[3]=(a10*b4-a9*b5-a11*b3)*det;
  out[4]=(a6*b8-a4*b11-a7*b7)*det;
  out[5]=(a0*b11-a2*b8+a3*b7)*det;
  out[6]=(a14*b2-a12*b5-a15*b1)*det;
  out[7]=(a8*b5-a10*b2+a11*b1)*det;
  out[8]=(a4*b10-a5*b8+a7*b6)*det;
  out[9]=(a1*b8-a0*b10-a3*b6)*det;
  out[10]=(a12*b4-a13*b2+a15*b0)*det;
  out[11]=(a9*b2-a8*b4-a11*b0)*det;
  out[12]=(a5*b7-a4*b9-a6*b6)*det;
  out[13]=(a0*b9-a1*b7+a2*b6)*det;
  out[14]=(a13*b1-a12*b3-a14*b0)*det;
  out[15]=(a8*b3-a9*b1+a10*b0)*det;
}

function translation(tx, ty, tz) {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, tx,ty,tz,1]);
}

// ─── Shader utilities ────────────────────────────────────────────────────────

function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    console.error(gl.getShaderInfoLog(s), src);
  return s;
}

function makeProgram(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    console.error(gl.getProgramInfoLog(p));
  return p;
}

// ─── Shader sources ──────────────────────────────────────────────────────────

const GRASS_VS = `
attribute vec4 position;
attribute vec4 bladeId;
uniform mat4 worldViewProjection;
uniform mat4 world;
uniform mat4 viewInverse;
uniform float time;
uniform float bladeWidth;
uniform float topWidth;
uniform float bladeSpacing;
uniform float heightRange;
uniform float xWorldMult;
uniform float zWorldMult;
uniform float xTimeMult;
uniform float zTimeMult;
uniform float rand1Mult;
uniform float rand2Mult;
uniform float swayRange;
uniform float elevationPeriod1;
uniform float elevationPeriod2;
uniform float elevationPointX;
uniform float elevationPointZ;
uniform float elevationRange;
uniform float bladeHeight;
varying vec4 v_color;

vec4 brightColor = vec4(175.0/255.0, 218.0/255.0, 44.0/255.0, 1.0);
vec4 darkColor   = vec4(53.0/255.0,  85.0/255.0,   7.0/255.0, 1.0);
vec4 darkerColor = vec4(53.0/255.0,  85.0/255.0,   7.0/255.0, 1.0) * 0.5;

float circleWave(vec4 center, vec4 pos, float period) {
  vec4 d = pos - center;
  return sin(sqrt(d.x*d.x + d.z*d.z) * period);
}

void main() {
  float lerp = position.y;  // 0→1 for taper and color
  float worldY = position.y * bladeHeight;  // actual world-space height
  mat4 vm = mat4(viewInverse[0], viewInverse[1], viewInverse[2], vec4(0,0,0,1));
  float width = mix(bladeWidth, topWidth, lerp);
  vec4 pt = vm * vec4(position.x * width, 0.0, 0.0, 1.0)
           + vec4(0.0, worldY, 0.0, 0.0);

  float xbase = bladeId.x;
  float zbase = bladeId.y;
  float rand1 = bladeId.z;
  float rand2 = bladeId.w;

  float worldOff = world[3][0] * xWorldMult * world[3][2] * zWorldMult;
  float xoff = sin(time * xTimeMult + rand1 + worldOff + xbase * 0.3 + sin(zbase)) * swayRange;
  float zoff = sin(time * zTimeMult + rand2 + worldOff + zbase * 0.1 + cos(xbase) * 1.3) * swayRange;
  float effect = 1.0 - cos(3.14159 * 0.5 * lerp);

  vec4 p = vec4(
    pt.x + xbase * bladeSpacing + xoff * effect + rand1 * bladeSpacing,
    pt.y + rand1 * heightRange,
    pt.z + zbase * bladeSpacing + zoff * effect + rand1 * bladeSpacing,
    1.0);

  vec4 wp = world * p;
  rand1 = mod(rand1 + wp.x * rand1Mult + wp.z * rand2Mult, 1.0);
  rand2 = mod(rand2 + wp.z * rand1Mult + wp.x * rand2Mult, 1.0);

  float eb1 = circleWave(vec4(0,0,0,0), wp, elevationPeriod1);
  float eb2 = circleWave(vec4(elevationPointX, 0.0, elevationPointZ, 0.0), wp, elevationPeriod2);
  vec4 nextP = vec4(wp.x + bladeSpacing, wp.y, wp.z + bladeSpacing, 1.0);
  float eb3 = circleWave(vec4(0,0,0,0), nextP, elevationPeriod1);
  float eb4 = circleWave(vec4(elevationPointX, 0.0, elevationPointZ, 0.0), nextP, elevationPeriod2);
  float elevBasis = eb2 - eb1;
  float elevBasisNext = eb4 - eb3;

  vec4 clipPos = worldViewProjection * vec4(p.x, p.y + elevBasis * elevationRange, p.z, 1.0);
  gl_Position = clipPos;

  vec4 color = mix(darkColor, brightColor, lerp);
  vec4 randColor = vec4(rand2 * 0.2, rand2 * 0.2, rand2 * 0.2, 0.0);
  float l = dot(
    vec3(0.18814417367671946, 0.9407208683835973, 0.28221626051507914),
    normalize(vec3(0.06, elevBasis * elevationRange - elevBasisNext * elevationRange, 0.06)));
  float depthMix = (clipPos.z / clipPos.w + 1.0) * 0.5;
  v_color = vec4((randColor + mix(color, darkerColor, l)).xyz, depthMix);
}
`;

const GRASS_FS = `
precision mediump float;
varying vec4 v_color;
void main() { gl_FragColor = v_color; }
`;

const QUAD_VS = `
attribute vec4 position;
attribute vec2 texCoord;
varying vec2 v_uv;
void main() { v_uv = texCoord; gl_Position = position; }
`;

const SKY_VS = `
attribute vec4 position;
varying float v_y;
void main() { v_y = position.y; gl_Position = position; }
`;

const SKY_FS = `
precision mediump float;
varying float v_y;
void main() {
  float t = (v_y + 1.0) * 0.5;
  vec3 top    = vec3(0.94, 0.97, 0.91);  // near-white overcast sky
  vec3 bottom = vec3(0.12, 0.68, 0.04);  // bright lime ground
  gl_FragColor = vec4(mix(bottom, top, t), 1.0);
}
`;

const BLUR_FS = `
precision mediump float;
varying vec2 v_uv;
uniform vec2 blurSize;
uniform sampler2D mainSampler;
void main() {
  vec4 s = vec4(0.0);
  s += texture2D(mainSampler, v_uv + blurSize * -4.0) * 0.05;
  s += texture2D(mainSampler, v_uv + blurSize * -3.0) * 0.09;
  s += texture2D(mainSampler, v_uv + blurSize * -2.0) * 0.12;
  s += texture2D(mainSampler, v_uv + blurSize * -1.0) * 0.15;
  s += texture2D(mainSampler, v_uv               )    * 0.16;
  s += texture2D(mainSampler, v_uv + blurSize *  1.0) * 0.15;
  s += texture2D(mainSampler, v_uv + blurSize *  2.0) * 0.12;
  s += texture2D(mainSampler, v_uv + blurSize *  3.0) * 0.09;
  s += texture2D(mainSampler, v_uv + blurSize *  4.0) * 0.05;
  gl_FragColor = s;
}
`;

const DOF_FS = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D mainSampler;
uniform sampler2D blurSampler;
uniform float dof;
uniform float dofInnerRange;
uniform float dofOuterRange;
void main() {
  vec4 main_ = texture2D(mainSampler, v_uv);
  vec4 blur_ = texture2D(blurSampler, v_uv);
  float depth = main_.a;
  float mix_ = abs(dof - depth) - dofInnerRange;
  float blurRange = dofOuterRange - dofInnerRange;
  float amount = clamp(mix_ / blurRange, 0.0, 1.0);
  gl_FragColor = vec4(mix(main_.rgb, blur_.rgb, amount), 1.0);
}
`;

// ─── Programs ────────────────────────────────────────────────────────────────

const grassProg = makeProgram(GRASS_VS, GRASS_FS);
const skyProg   = makeProgram(SKY_VS,   SKY_FS);
const blurProg  = makeProgram(QUAD_VS,  BLUR_FS);
const dofProg   = makeProgram(QUAD_VS,  DOF_FS);

// ─── Fullscreen quad ─────────────────────────────────────────────────────────

const quadPosBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadPosBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1,-1,0,1,  1,-1,0,1,  -1,1,0,1,
   1,-1,0,1,  1, 1,0,1,  -1,1,0,1,
]), gl.STATIC_DRAW);

const quadUVBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadUVBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  0,0, 1,0, 0,1,
  1,0, 1,1, 0,1,
]), gl.STATIC_DRAW);

// ─── Blade template geometry ─────────────────────────────────────────────────
// 5 verts: base-left, base-right, mid-left, mid-right, tip
// x=±1 gets scaled by blade width; y=height (0→1); z=0 (flat)

const bladePosBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, bladePosBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, 0,   0, 1,
   1, 0,   0, 1,
  -1, 0.5, 0, 1,
   1, 0.5, 0, 1,
   0, 1,   0, 1,
]), gl.STATIC_DRAW);

const bladeIdxBuf = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bladeIdxBuf);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([
  0,1,2, 1,3,2, 2,3,4,
]), gl.STATIC_DRAW);

// ─── Blade instance data ─────────────────────────────────────────────────────

const COUNTS = [25, 50, 80, 120, 160]; // blades per row per setting
let numBlades = 0;
let currentCountIdx = 0;
const bladeIdBuf = gl.createBuffer();

function rebuildBladeIds(n) {
  numBlades = n * n;
  const data = new Float32Array(numBlades * 4);
  for (let i = 0, k = 0; i < n; i++) {
    for (let j = 0; j < n; j++, k += 4) {
      data[k]   = i;
      data[k+1] = j;
      data[k+2] = Math.random();
      data[k+3] = Math.random();
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, bladeIdBuf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
}
rebuildBladeIds(COUNTS[0]);

// ─── FBOs ─────────────────────────────────────────────────────────────────────

function makeFBO(w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const rb = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

let fbo1, fbo2;
function resizeFBOs() {
  fbo1 = makeFBO(canvas.width, canvas.height);
  fbo2 = makeFBO(canvas.width, canvas.height);
}

// ─── Params ───────────────────────────────────────────────────────────────────

const P = {
  bladeSpacing:    0.06,
  bladeWidth:      0.041,
  topWidth:        0.007,
  heightRange:     0.1,
  xWorldMult:      2.45,
  zWorldMult:      4.95,
  xTimeMult:       2.07,
  zTimeMult:       0.94,
  swayRange:       0.09,
  elevationPeriod1:2.37,
  elevationPeriod2:1.63,
  elevationPointX: 8.06,
  elevationPointZ: 5.02,
  elevationRange:  0.2,
  rand1Mult:       0.37,
  rand2Mult:       2.89,
  targetHeight:    0.91,
  targetRadius:    1.0,
  eyeHeight:       2.98,
  eyeRadius:       5.0,
  eyeSpeed:        0.1,
  patchesAcross:   3,
  dof:             0.79,
  dofInnerRange:   0.034,
  dofOuterRange:   0.078,
  bladeHeight:     3.0,
};

const RANGES = {
  bladeSpacing:    [0.01, 0.5,  0.001],
  bladeWidth:      [0,    0.5,  0.001],
  topWidth:        [0,    0.2,  0.001],
  heightRange:     [0,    0.5,  0.001],
  xWorldMult:      [0,    10,   0.01],
  zWorldMult:      [0,    10,   0.01],
  xTimeMult:       [0,    5,    0.01],
  zTimeMult:       [0,    5,    0.01],
  swayRange:       [0,    1,    0.001],
  elevationPeriod1:[0,    5,    0.01],
  elevationPeriod2:[0,    5,    0.01],
  elevationPointX: [0,    10,   0.01],
  elevationPointZ: [0,    10,   0.01],
  elevationRange:  [0,    3,    0.01],
  rand1Mult:       [0,    5,    0.01],
  rand2Mult:       [0,    5,    0.01],
  targetHeight:    [0,    5,    0.01],
  targetRadius:    [0,    5,    0.01],
  eyeHeight:       [0,    10,   0.01],
  eyeRadius:       [0,    20,   0.01],
  eyeSpeed:        [0,    1,    0.001],
  patchesAcross:   [1,    9,    1],
  dof:             [0,    1,    0.001],
  dofInnerRange:   [0,    0.5,  0.001],
  dofOuterRange:   [0,    0.5,  0.001],
  bladeHeight:     [0.5,  8,    0.1],
};

// ─── UI ───────────────────────────────────────────────────────────────────────

function buildUI() {
  const container = document.getElementById('uiContainer');
  container.innerHTML = '';
  for (const key of Object.keys(P)) {
    const r = RANGES[key];
    if (!r) continue;
    const row = document.createElement('div');
    row.className = 'slider-row';
    const labelRow = document.createElement('div');
    labelRow.className = 'label-row';
    const valSpan = document.createElement('span');
    valSpan.id = 'v_' + key;
    valSpan.textContent = P[key];
    labelRow.innerHTML = `<span>${key}</span>`;
    labelRow.appendChild(valSpan);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = r[0]; slider.max = r[1]; slider.step = r[2];
    slider.value = P[key];
    slider.addEventListener('input', () => {
      P[key] = parseFloat(slider.value);
      valSpan.textContent = P[key];
    });
    row.appendChild(labelRow);
    row.appendChild(slider);
    container.appendChild(row);
  }
}

['setCount0','setCount1','setCount2','setCount3','setCount4'].forEach((id, i) => {
  document.getElementById(id).addEventListener('click', () => {
    document.querySelectorAll('[id^=setCount]').forEach(el => el.style.color = '');
    document.getElementById(id).style.color = 'red';
    currentCountIdx = i;
    rebuildBladeIds(COUNTS[i]);
  });
});

let uiVisible = false;
document.getElementById('advanced').addEventListener('click', () => {
  uiVisible = !uiVisible;
  document.getElementById('uiContainer').style.display = uiVisible ? 'block' : 'none';
});

buildUI();

// ─── Resize ───────────────────────────────────────────────────────────────────

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  resizeFBOs();
}
window.addEventListener('resize', resize);
resize();

// ─── Uniform helpers ─────────────────────────────────────────────────────────

function u1f(prog, name, v) {
  const loc = gl.getUniformLocation(prog, name);
  if (loc) gl.uniform1f(loc, v);
}
function um4(prog, name, v) {
  const loc = gl.getUniformLocation(prog, name);
  if (loc) gl.uniformMatrix4fv(loc, false, v);
}

// ─── Cached matrices ─────────────────────────────────────────────────────────

const proj = m4(), view = m4(), viewInv = m4(), wvp = m4(), tmp = m4();

// ─── Render passes ───────────────────────────────────────────────────────────

function drawSky() {
  gl.useProgram(skyProg);
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  const posLoc = gl.getAttribLocation(skyProg, 'position');
  gl.bindBuffer(gl.ARRAY_BUFFER, quadPosBuf);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 4, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
}

function drawGrass(t) {
  gl.useProgram(grassProg);

  const posLoc    = gl.getAttribLocation(grassProg, 'position');
  const bladeIdLoc = gl.getAttribLocation(grassProg, 'bladeId');

  gl.bindBuffer(gl.ARRAY_BUFFER, bladePosBuf);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 4, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, bladeIdBuf);
  gl.enableVertexAttribArray(bladeIdLoc);
  gl.vertexAttribPointer(bladeIdLoc, 4, gl.FLOAT, false, 0, 0);
  instExt.vertexAttribDivisorANGLE(bladeIdLoc, 1);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bladeIdxBuf);

  // Set scalar uniforms
  u1f(grassProg, 'time', t);
  for (const [k, v] of Object.entries(P)) u1f(grassProg, k, v);

  // Camera
  const angle = t * P.eyeSpeed;
  const eye    = [Math.sin(angle)       * P.eyeRadius, P.eyeHeight, Math.cos(angle)       * P.eyeRadius];
  const target = [Math.sin(angle + 0.1) * P.targetRadius, P.targetHeight, Math.cos(angle + 0.1) * P.targetRadius];
  lookAt(view, eye, target, [0,1,0]);
  invert(viewInv, view);
  perspective(proj, Math.PI / 3, canvas.width / canvas.height, 0.1, 100);

  um4(grassProg, 'viewInverse', viewInv);

  // Draw patches
  const across = Math.max(1, Math.round(P.patchesAcross));
  const n = COUNTS[currentCountIdx];
  const patchSize = n * P.bladeSpacing;
  const half = (across - 1) / 2;

  for (let pi = 0; pi < across; pi++) {
    for (let pj = 0; pj < across; pj++) {
      const world = translation((pi - half) * patchSize, 0, (pj - half) * patchSize);
      multiply(tmp, view, world);
      multiply(wvp, proj, tmp);
      um4(grassProg, 'worldViewProjection', wvp);
      um4(grassProg, 'world', world);
      instExt.drawElementsInstancedANGLE(gl.TRIANGLES, 9, gl.UNSIGNED_SHORT, 0, numBlades);
    }
  }

  instExt.vertexAttribDivisorANGLE(bladeIdLoc, 0);
}

function drawQuad(prog, uniforms) {
  gl.useProgram(prog);
  gl.disable(gl.DEPTH_TEST);

  const posLoc = gl.getAttribLocation(prog, 'position');
  gl.bindBuffer(gl.ARRAY_BUFFER, quadPosBuf);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 4, gl.FLOAT, false, 0, 0);

  const uvLoc = gl.getAttribLocation(prog, 'texCoord');
  if (uvLoc >= 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadUVBuf);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);
  }

  let unit = 0;
  for (const [name, val] of Object.entries(uniforms)) {
    const loc = gl.getUniformLocation(prog, name);
    if (!loc) continue;
    if (typeof val === 'number') {
      gl.uniform1f(loc, val);
    } else if (Array.isArray(val)) {
      gl.uniform2f(loc, val[0], val[1]);
    } else if (val && val.tex) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, val.tex);
      gl.uniform1i(loc, unit);
      unit++;
    }
  }

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// ─── FPS ─────────────────────────────────────────────────────────────────────

let fpsFrames = 0, fpsLast = 0;
const fpsEl = document.getElementById('fps');

// ─── Main loop ───────────────────────────────────────────────────────────────

function loop(ts) {
  const t = ts / 1000;

  fpsFrames++;
  if (t - fpsLast >= 0.5) {
    fpsEl.textContent = Math.round(fpsFrames / (t - fpsLast));
    fpsFrames = 0;
    fpsLast = t;
  }

  const w = canvas.width, h = canvas.height;
  gl.viewport(0, 0, w, h);

  // Pass 1 — sky + grass → fbo1 (alpha = clip depth)
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1.fbo);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawSky();
  gl.enable(gl.DEPTH_TEST);
  drawGrass(t);

  // Pass 2 — blur fbo1 → fbo2
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo2.fbo);
  gl.clear(gl.COLOR_BUFFER_BIT);
  drawQuad(blurProg, {
    mainSampler: { tex: fbo1.tex },
    blurSize: [12 / w, 12 / h],
  });

  // Pass 3 — DOF composite → screen
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.clear(gl.COLOR_BUFFER_BIT);
  drawQuad(dofProg, {
    mainSampler: { tex: fbo1.tex },
    blurSampler: { tex: fbo2.tex },
    dof:           P.dof,
    dofInnerRange: P.dofInnerRange,
    dofOuterRange: P.dofOuterRange,
  });

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
