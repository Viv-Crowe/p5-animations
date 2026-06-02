'use strict';
// Run from assignment-2-v2/: node scripts/gen-crystal-pngs.cjs
// Outputs: assets/stones/crystal-00.png … crystal-29.png
// No npm deps — uses only Node.js built-ins (zlib for PNG compression).

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── Crystal generation (mirrors gen-crystals.cjs) ───────────────────────────
function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function uni(rng, lo, hi) { return lo + rng() * (hi - lo); }
function logNorm(rng, mu, sig, lo, hi) {
    const u1 = Math.max(1e-9, rng()), u2 = rng();
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(lo, Math.min(hi, mu * Math.exp(sig * z)));
}
function cross(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function norm3(v) {
    const l = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
    return l < 1e-12 ? [0,1,0] : [v[0]/l, v[1]/l, v[2]/l];
}
function sub3(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function hexRadius(theta, R, hexness) {
    const sector = Math.PI / 3;
    const t = ((theta % sector) + sector) % sector;
    const hexR = R * Math.cos(Math.PI / 6) / Math.cos(t - sector / 2);
    return hexR * hexness + R * (1 - hexness);
}

function generateCrystal(seed) {
    const rng       = makeRng(seed);
    const aspect    = logNorm(rng, 2.2, 0.15, 1.6, 3.2);
    const bulge     = uni(rng, 0.04, 0.13);
    const capFrac   = uni(rng, 0.15, 0.28);
    const trunc     = uni(rng, 0.40, 0.62);
    const polarAsym = uni(rng, 0.82, 1.00);
    const waist     = uni(rng, 0.010, 0.035);
    const hexness   = uni(rng, 0.15, 0.80);

    const N        = 6;
    const halfH    = 1.0;
    const maxR     = halfH / aspect;
    const topCapH  = halfH * capFrac;
    const botCapH  = halfH * capFrac * polarAsym;
    const topBodyH = halfH - topCapH;
    const botBodyH = halfH - botCapH;
    const endR     = maxR * trunc * 0.55;

    const rings = [];
    rings.push({ y: -halfH,    r: endR * polarAsym,   hx: hexness * 0.30 });
    rings.push({ y: -botBodyH, r: maxR * (1 - waist), hx: hexness * 0.65 });
    const bodySpan = topBodyH + botBodyH;
    for (let i = 0; i <= 4; i++) {
        const t  = i / 4;
        const y  = -botBodyH + bodySpan * t;
        const bm = 1 + bulge * Math.sin(Math.PI * t);
        const wm = 1 - waist * Math.pow(1 - Math.sin(Math.PI * t), 2);
        rings.push({ y, r: maxR * bm * wm, hx: hexness });
    }
    rings.push({ y: topBodyH, r: maxR * (1 - waist), hx: hexness * 0.65 });
    rings.push({ y: halfH,    r: endR,                hx: hexness * 0.30 });

    const verts   = [];
    const norms   = [];
    const angles  = Array.from({ length: N }, (_, k) => k * Math.PI * 2 / N);

    function rv(ring, k) {
        const θ = angles[k];
        const r = hexRadius(θ, ring.r, ring.hx);
        return [r * Math.cos(θ), ring.y, r * Math.sin(θ)];
    }
    function addTri(v0, v1, v2) {
        const n = norm3(cross(sub3(v1, v0), sub3(v2, v0)));
        verts.push(v0, v1, v2);
        norms.push(n);
    }

    for (let ri = 0; ri < rings.length - 1; ri++) {
        const rA = rings[ri], rB = rings[ri + 1];
        for (let k = 0; k < N; k++) {
            const k1 = (k + 1) % N;
            addTri(rv(rA, k), rv(rB, k), rv(rA, k1));
            addTri(rv(rB, k), rv(rB, k1), rv(rA, k1));
        }
    }
    const botRing = rings[0], topRing = rings[rings.length - 1];
    for (let k = 0; k < N; k++) {
        addTri([0, -halfH, 0], rv(botRing, k), rv(botRing, (k + 1) % N));
        addTri([0,  halfH, 0], rv(topRing, (k + 1) % N), rv(topRing, k));
    }

    return { verts, norms, maxR, aspect };
}

// ─── 3D math ─────────────────────────────────────────────────────────────────
function dot3(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

function rotXMat(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [1, 0, 0,  0, c, -s,  0, s, c];
}
function rotYMat(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [c, 0, s,  0, 1, 0,  -s, 0, c];
}
function mulMat3Vec(m, v) {
    return [
        m[0]*v[0] + m[1]*v[1] + m[2]*v[2],
        m[3]*v[0] + m[4]*v[1] + m[5]*v[2],
        m[6]*v[0] + m[7]*v[1] + m[8]*v[2],
    ];
}
function composeMat3(A, B) {
    const r = [];
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            r.push(A[i*3]*B[j] + A[i*3+1]*B[3+j] + A[i*3+2]*B[6+j]);
    return r;
}

// ─── Project palette (from FluidSurface.js PALETTE_RGBA) ─────────────────────
// prettier-ignore
const PALETTE = [
    [200,175,200],  // 0  light mauve
    [175,148,182],  // 1  medium purple
    [152,122,158],  // 2  dark mauve
    [185,165,192],  // 3  soft lavender
    [165,185,155],  // 4  sage green
    [143,168,138],  // 5  medium sage
    [182,200,170],  // 6  light sage
    [155,175,145],  // 7  muted sage
    [228,215,168],  // 8  warm cream
    [210,200,150],  // 9  amber cream
    [236,226,178],  // 10 pale cream
    [195,178,132],  // 11 ochre
    [192,168,185],  // 12 dusty rose
    [168,152,172],  // 13 gray purple
    [185,200,175],  // 14 pale sage
    [145,115,152],  // 15 deep mauve
];

// Opacity per crystal — varied to create depth (translucent → nearly opaque)
// prettier-ignore
const ALPHAS = [
    0.82, 0.68, 0.93, 0.75, 0.88, 0.65, 0.95, 0.78,
    0.85, 0.70, 0.90, 0.72, 0.88, 0.80, 0.65, 0.94,
    0.75, 0.87, 0.70, 0.95, 0.78, 0.83, 0.67, 0.91,
    0.76, 0.85, 0.72, 0.88, 0.68, 0.90,
];

function lerp3(a, b, t) {
    return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}

// Derive lit BASE, dark SHADOW, and specular SPEC from one palette entry.
function crystalColors(palEntry) {
    const white = [255, 255, 255];
    const cool  = [70, 60, 92];    // purple-grey for shadowed calcite
    const base   = lerp3(palEntry, white, 0.32);           // lighten 32%
    const darkPal = lerp3(palEntry, [0,0,0], 0.30);        // darken 30%
    const shadow  = lerp3(darkPal, cool, 0.28);            // cool-shift 28%
    const spec    = lerp3(palEntry, white, 0.88);          // near-white tint
    return { base, shadow, spec };
}

// ─── Shading ─────────────────────────────────────────────────────────────────
const LIGHT = norm3([0.55, 0.80, 0.70]);
const SPEC_H = norm3([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);  // Blinn half-vector

function shadeFace(viewNormal, colors, alpha) {
    const diff = Math.max(0, dot3(viewNormal, LIGHT));
    const spec = Math.pow(Math.max(0, dot3(viewNormal, SPEC_H)), 28) * 0.55;

    const { base, shadow, spec: specCol } = colors;
    const r0 = shadow[0] + (base[0] - shadow[0]) * diff;
    const g0 = shadow[1] + (base[1] - shadow[1]) * diff;
    const b0 = shadow[2] + (base[2] - shadow[2]) * diff;

    return [
        Math.round(Math.min(255, r0 + specCol[0] * spec)),
        Math.round(Math.min(255, g0 + specCol[1] * spec)),
        Math.round(Math.min(255, b0 + specCol[2] * spec)),
        Math.round(alpha * 255),
    ];
}

// ─── Rasterizer ──────────────────────────────────────────────────────────────
// Edge function: positive when p is to the left of edge a→b
function edgeFn(ax, ay, bx, by, px, py) {
    return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

function drawTri(buf, SIZE, ax, ay, bx, by, cx, cy, color) {
    const minX = Math.max(0,        Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(SIZE - 1, Math.ceil( Math.max(ax, bx, cx)));
    const minY = Math.max(0,        Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(SIZE - 1, Math.ceil( Math.max(ay, by, cy)));
    if (minX > maxX || minY > maxY) return;

    const area = edgeFn(ax, ay, bx, by, cx, cy);
    if (Math.abs(area) < 0.5) return;
    const cw = area > 0;   // clockwise winding?

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const e0 = edgeFn(ax, ay, bx, by, x, y);
            const e1 = edgeFn(bx, by, cx, cy, x, y);
            const e2 = edgeFn(cx, cy, ax, ay, x, y);
            const inside = cw
                ? (e0 >= 0 && e1 >= 0 && e2 >= 0)
                : (e0 <= 0 && e1 <= 0 && e2 <= 0);
            if (!inside) continue;
            const i = (y * SIZE + x) * 4;
            buf[i]     = color[0];
            buf[i + 1] = color[1];
            buf[i + 2] = color[2];
            buf[i + 3] = color[3];
        }
    }
}

// Render at 2× and box-downsample → smoother edges
function renderCrystal(geom, SIZE, colors, alpha) {
    const S2  = SIZE * 2;
    const buf = new Uint8Array(S2 * S2 * 4);

    // View rotation: tilt –28° X (see some depth), 22° Y (show one face + edge)
    const rot = composeMat3(rotXMat(-0.49), rotYMat(0.38));

    // Scale so ±1 height maps to ~42% of the image
    const scale = S2 * 0.42;
    const cx = S2 / 2, cy = S2 / 2;

    // Build and sort triangles back-to-front (painter's algorithm)
    const tris = [];
    for (let i = 0; i < geom.verts.length; i += 3) {
        const rv = idx => mulMat3Vec(rot, geom.verts[i + idx]);
        const rn = mulMat3Vec(rot, geom.norms[i / 3]);
        const v0 = rv(0), v1 = rv(1), v2 = rv(2);
        tris.push({ v0, v1, v2, n: rn, avgZ: (v0[2]+v1[2]+v2[2]) / 3 });
    }
    tris.sort((a, b) => a.avgZ - b.avgZ);

    for (const { v0, v1, v2, n } of tris) {
        if (n[2] < -0.15) continue;
        const color = shadeFace(n, colors, alpha);
        const ax = cx + v0[0]*scale, ay = cy - v0[1]*scale;
        const bx = cx + v1[0]*scale, by = cy - v1[1]*scale;
        const ccx = cx + v2[0]*scale, ccy = cy - v2[1]*scale;
        drawTri(buf, S2, ax, ay, bx, by, ccx, ccy, color);
    }

    // Box-downsample 2× → SIZE
    const out = new Uint8Array(SIZE * SIZE * 4);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let dy = 0; dy < 2; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                    const si = ((y*2+dy) * S2 + (x*2+dx)) * 4;
                    r += buf[si]; g += buf[si+1]; b += buf[si+2]; a += buf[si+3];
                }
            }
            const oi = (y * SIZE + x) * 4;
            out[oi] = r>>2; out[oi+1] = g>>2; out[oi+2] = b>>2; out[oi+3] = a>>2;
        }
    }
    return out;
}

// ─── PNG encoder (pure Node.js, no deps) ─────────────────────────────────────
const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c;
    }
    return t;
})();

function crc32(buf) {
    let crc = -1;
    for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
}

function u32be(n) {
    return [(n>>>24)&0xFF, (n>>>16)&0xFF, (n>>>8)&0xFF, n&0xFF];
}

function pngChunk(type, data) {
    const typeB = [...type].map(c => c.charCodeAt(0));
    const body  = [...typeB, ...data];
    return Buffer.from([...u32be(data.length), ...body, ...u32be(crc32(body))]);
}

function encodePNG(w, h, rgba) {
    // Build raw scanlines: each row = [0x00 (filter=None), R,G,B,A, ...]
    const raw = new Uint8Array(h * (1 + w * 4));
    for (let y = 0; y < h; y++) {
        const rowOff = y * (1 + w * 4);
        raw[rowOff] = 0; // filter byte
        raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), rowOff + 1);
    }
    const compressed = zlib.deflateSync(Buffer.from(raw), { level: 6 });

    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),   // PNG signature
        pngChunk('IHDR', [...u32be(w), ...u32be(h), 8, 6, 0, 0, 0]),
        pngChunk('IDAT', [...compressed]),
        pngChunk('IEND', []),
    ]);
}

// ─── Generate ─────────────────────────────────────────────────────────────────
const COUNT  = 30;
const SIZE   = 256;
const outDir = path.join(__dirname, '..', 'assets', 'stones');

console.log(`Generating ${COUNT} crystal PNGs (${SIZE}×${SIZE}) → ${outDir}`);

for (let i = 0; i < COUNT; i++) {
    const geom   = generateCrystal(i * 1000 + 42);
    const pal    = PALETTE[i % PALETTE.length];
    const colors = crystalColors(pal);
    const alpha  = ALPHAS[i];
    const rgba   = renderCrystal(geom, SIZE, colors, alpha);
    const png    = encodePNG(SIZE, SIZE, rgba);
    const name   = `crystal-${String(i).padStart(2, '0')}.png`;
    fs.writeFileSync(path.join(outDir, name), png);
    const palName = ['lgt-mauve','med-purple','dk-mauve','soft-lav','sage','med-sage',
        'lgt-sage','muted-sage','warm-cream','amber','pale-cream','ochre',
        'dusty-rose','gray-purp','pale-sage','deep-mauve'][i % 16];
    process.stdout.write(`  ${name}  aspect=${geom.aspect.toFixed(2)}  α=${alpha.toFixed(2)}  ${palName}\n`);
}

console.log('Done.');
