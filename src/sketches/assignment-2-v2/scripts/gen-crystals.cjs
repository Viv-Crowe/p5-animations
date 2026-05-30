'use strict';
// Run from assignment-2-v2/: node scripts/gen-crystals.js
// Outputs: crystal-library.js  (global var CRYSTAL_GEOMETRIES)

const fs   = require('fs');
const path = require('path');

// ─── PRNG (mulberry32, seeded) ───────────────────────────────────────────────
function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function uni(rng, lo, hi)       { return lo + rng() * (hi - lo); }
function logNorm(rng, mu, sig, lo, hi) {
    const u1 = Math.max(1e-9, rng()), u2 = rng();
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(lo, Math.min(hi, mu * Math.exp(sig * z)));
}

// ─── Geometry helpers ────────────────────────────────────────────────────────
function cross(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function normalize(v) {
    const l = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
    return l < 1e-12 ? [0,1,0] : [v[0]/l, v[1]/l, v[2]/l];
}
function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }

// Distance from origin to hexagonal boundary at angle θ,
// circumradius R, interpolated toward a circle by (1-hexness).
function hexRadius(theta, R, hexness) {
    const sector = Math.PI / 3;          // 60° per side
    const t = ((theta % sector) + sector) % sector;
    const hexR = R * Math.cos(Math.PI/6) / Math.cos(t - sector/2);
    return hexR * hexness + R * (1 - hexness);
}

// ─── Crystal generator ───────────────────────────────────────────────────────
function generateCrystal(seed) {
    const rng = makeRng(seed);

    // Randomised parameters
    const aspect     = logNorm(rng, 2.2, 0.15, 1.6, 3.2);   // L:W
    const bulge      = uni(rng, 0.04, 0.13);                  // face convexity
    const capFrac    = uni(rng, 0.15, 0.28);                  // cap height / halfH
    const trunc      = uni(rng, 0.40, 0.62);                  // flat-end radius fraction
    const polarAsym  = uni(rng, 0.82, 1.00);                  // top-cap scale vs bottom
    const waist      = uni(rng, 0.010, 0.035);                // shoulder inward offset
    const hexness    = uni(rng, 0.15, 0.80);                  // 0=circle, 1=hex prism

    const N         = 6;                          // hexagonal
    const halfH     = 1.0;                        // total half-height (apex at ±halfH)
    const maxR      = halfH / aspect;             // equatorial radius

    const topCapH   = halfH * capFrac;
    const botCapH   = halfH * capFrac * polarAsym;
    const topBodyH  = halfH - topCapH;            // body ends here (top)
    const botBodyH  = halfH - botCapH;            // body ends here (bottom)

    const endR      = maxR * trunc * 0.55;        // radius of flat end disk
    const topEndR   = endR;
    const botEndR   = endR * polarAsym;

    // ── Profile rings: [{y, r, hx}] bottom→top ──────────────────────────────
    // We build 9 rings so the shape has: flat-end → cap → shoulder → body × 3 → shoulder → cap → flat-end
    const rings = [];

    // Bottom flat end
    rings.push({ y: -halfH,    r: botEndR,                   hx: hexness * 0.30 });
    // Bottom cap (trapezoid from end to shoulder)
    rings.push({ y: -botBodyH, r: maxR * (1 - waist),        hx: hexness * 0.65 });
    // Body − 4 height slices with cosine bulge & waist pinch
    const bodySpan = topBodyH + botBodyH;
    for (let i = 0; i <= 4; i++) {
        const t  = i / 4;
        const y  = -botBodyH + bodySpan * t;
        const bm = 1 + bulge * Math.sin(Math.PI * t);
        const wm = 1 - waist * Math.pow(1 - Math.sin(Math.PI * t), 2);
        rings.push({ y, r: maxR * bm * wm, hx: hexness });
    }
    // Top cap
    rings.push({ y: topBodyH,  r: maxR * (1 - waist),        hx: hexness * 0.65 });
    // Top flat end
    rings.push({ y: halfH,     r: topEndR,                   hx: hexness * 0.30 });

    // ── Tessellate ───────────────────────────────────────────────────────────
    const vertices = [];
    const normals  = [];
    const indices  = [];
    let   idx      = 0;

    const angles = Array.from({ length: N }, (_, k) => k * Math.PI * 2 / N);

    // Vertex at ring ri, side k
    function rv(ring, k) {
        const θ = angles[k];
        const r = hexRadius(θ, ring.r, ring.hx);
        return [r * Math.cos(θ), ring.y, r * Math.sin(θ)];
    }

    function addTri(v0, v1, v2) {
        const n = normalize(cross(sub(v1, v0), sub(v2, v0)));
        for (const v of [v0, v1, v2]) {
            vertices.push(v[0], v[1], v[2]);
            normals.push(n[0], n[1], n[2]);
            indices.push(idx++);
        }
    }

    // Lateral quads between adjacent rings
    // Winding (verified): addTri(A[k], B[k], A[k+1]) + addTri(B[k], B[k+1], A[k+1])
    // gives outward-facing normals for CCW ring vertex order (angles increasing).
    for (let ri = 0; ri < rings.length - 1; ri++) {
        const rA = rings[ri], rB = rings[ri + 1];
        for (let k = 0; k < N; k++) {
            const k1 = (k + 1) % N;
            addTri(rv(rA, k), rv(rB, k), rv(rA, k1));
            addTri(rv(rB, k), rv(rB, k1), rv(rA, k1));
        }
    }

    // Bottom flat end cap — faces downward (−Y)
    const botEnd = [0, -halfH, 0];
    const botRing = rings[0];
    for (let k = 0; k < N; k++) {
        addTri(botEnd, rv(botRing, k), rv(botRing, (k + 1) % N));
    }

    // Top flat end cap — faces upward (+Y)
    const topEnd  = [0, halfH, 0];
    const topRing = rings[rings.length - 1];
    for (let k = 0; k < N; k++) {
        addTri(topEnd, rv(topRing, (k + 1) % N), rv(topRing, k));
    }

    return {
        vertices,
        normals,
        indices,
        meta: { seed, aspect: +aspect.toFixed(2), bulge: +bulge.toFixed(3),
                capFrac: +capFrac.toFixed(3), trunc: +trunc.toFixed(3),
                polarAsym: +polarAsym.toFixed(3), waist: +waist.toFixed(3),
                hexness: +hexness.toFixed(3) }
    };
}

// ─── Generate 30 crystals ────────────────────────────────────────────────────
const COUNT = 30;
const crystals = [];
for (let i = 0; i < COUNT; i++) {
    crystals.push(generateCrystal(i * 1000 + 42));
}

// ─── Serialise to JS ─────────────────────────────────────────────────────────
function fmt(arr) {
    return '[' + arr.map(v => +v.toFixed(5)).join(',') + ']';
}

const lines = [
    '// Auto-generated by scripts/gen-crystals.js — delete any entries you don\'t want.',
    '// Each entry has id, vertices (flat Float32-ready), normals, indices, meta.',
    '// CRYSTAL_GEOMETRIES.length === ' + COUNT,
    'var CRYSTAL_GEOMETRIES = [',
];

crystals.forEach((c, i) => {
    const comma = i < crystals.length - 1 ? ',' : '';
    lines.push(
        `  { id: 'crystal-${String(i).padStart(2,'0')}',` +
        ` meta: ${JSON.stringify(c.meta)},` +
        ` vertices: ${fmt(c.vertices)},` +
        ` normals:  ${fmt(c.normals)},` +
        ` indices:  [${c.indices.join(',')}] }${comma}`
    );
});

lines.push('];');

const outPath = path.join(__dirname, '..', 'crystal-library.js');
fs.writeFileSync(outPath, lines.join('\n'));
console.log(`Wrote ${COUNT} crystals → ${outPath}`);
console.log(`File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
console.log('Vertex counts per crystal:',
    crystals.map(c => c.indices.length / 3 + ' tris').join(', '));
