// Debug overlay: live webcam with MediaPipe landmarks (left) +
// accelX scrolling time-series plot (right, axis grows as data accumulates).
export class DebugOverlay {
  #p;
  #accelHistory = [];
  #xHistory     = [];   // normalised position (signal.x / canvas width) [0–1]
  #timeHistory  = [];   // parallel ms timestamps
  #yMax = 0.005;        // auto-scales to peak accelX seen
  static H = 120;
  static #WINDOW_MS   = 30_000; // fixed 30-second rolling window
  static #MAX_SAMPLES = 2000;   // safety cap (~30 s at 60 fps)

  // MediaPipe hand skeleton connections
  static #HAND_CONN = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[0,17],[17,18],[18,19],[19,20],
  ];

  constructor(p) {
    this.#p = p;
  }

  // opts: { video, activeInput }
  draw(signal, opts = {}) {
    const { video, activeInput } = opts;
    const p   = this.#p;
    const W   = p.width;
    const H      = DebugOverlay.H;
    const WINDOW = DebugOverlay.#WINDOW_MS;
    const MAX    = DebugOverlay.#MAX_SAMPLES;

    // ── Accumulate history (fixed 30-second rolling window) ──────────
    const now = p.millis();
    if (signal && !signal.noSignal) {
      this.#accelHistory.push(signal.accelX);
      this.#xHistory.push(signal.x / W);       // normalise to [0, 1]
      this.#timeHistory.push(now);
      const abs = Math.abs(signal.accelX);
      if (abs > this.#yMax) this.#yMax = abs;
      else this.#yMax = Math.max(this.#yMax * 0.9995, 0.005);
    }
    // Trim samples older than the 30-second window
    let trim = 0;
    while (trim < this.#timeHistory.length && now - this.#timeHistory[trim] > WINDOW) trim++;
    if (trim > 0) {
      this.#accelHistory.splice(0, trim);
      this.#xHistory.splice(0, trim);
      this.#timeHistory.splice(0, trim);
    }
    if (this.#accelHistory.length > MAX) {
      this.#accelHistory.splice(0, 1);
      this.#xHistory.splice(0, 1);
      this.#timeHistory.splice(0, 1);
    }

    p.push();

    // ── Video panel ──────────────────────────────────────────────────
    const vW     = video?.elt?.videoWidth  || video?.width  || 640;
    const vH     = video?.elt?.videoHeight || video?.height || 480;
    const thumbW = Math.round(H * vW / vH);

    p.noStroke();
    p.fill(8, 12, 22);
    p.rect(0, 0, thumbW, H);

    if (video) {
      // Mirror the video so it matches the flipped ml5 coordinate space
      p.push();
      p.translate(thumbW, 0);
      p.scale(-1, 1);
      p.image(video, 0, 0, thumbW, H);
      p.pop();

      const sx = thumbW / vW;
      const sy = H      / vH;

      // ── Face landmarks ─────────────────────────────────────────────
      const faces = activeInput?.faces;
      if (faces?.length) {
        const box = faces[0].box;
        if (box) {
          p.noFill();
          p.stroke(55, 220, 95);
          p.strokeWeight(1.5);
          p.rect(box.xMin * sx, box.yMin * sy, box.width * sx, box.height * sy);

          p.noStroke();
          p.fill(255, 220, 0);
          p.circle((box.xMin + box.width / 2) * sx,
                   (box.yMin + box.height / 2) * sy, 6);
        }
      }

      // ── Hand skeleton ──────────────────────────────────────────────
      const hands = activeInput?.hands;
      if (hands?.length) {
        const kps = hands[0].keypoints;
        if (kps) {
          p.stroke(60, 140, 255, 200);
          p.strokeWeight(1);
          for (const [a, b] of DebugOverlay.#HAND_CONN) {
            if (kps[a] && kps[b]) {
              p.line(kps[a].x * sx, kps[a].y * sy,
                     kps[b].x * sx, kps[b].y * sy);
            }
          }
          p.noStroke();
          for (let i = 0; i < kps.length; i++) {
            if (!kps[i]) continue;
            const isIndex = i === 8;
            p.fill(isIndex ? p.color(255, 220, 0) : p.color(60, 180, 255));
            p.circle(kps[i].x * sx, kps[i].y * sy, isIndex ? 8 : 4);
          }
        }
      }

      // No-signal dimmer
      if (!signal || signal.noSignal) {
        p.fill(0, 0, 0, 110);
        p.noStroke();
        p.rect(0, 0, thumbW, H);
        p.fill(160);
        p.textSize(10);
        p.textAlign(p.CENTER, p.CENTER);
        p.text('no signal', thumbW / 2, H / 2);
      }
    }

    // Thumbnail border
    p.noFill();
    p.stroke(40, 60, 100);
    p.strokeWeight(1);
    p.rect(0, 0, thumbW, H);

    // ── accelX plot ──────────────────────────────────────────────────
    const plotX = thumbW;
    const plotW = W - thumbW;
    const n     = this.#accelHistory.length;

    p.noStroke();
    p.fill(5, 8, 18, 220);
    p.rect(plotX, 0, plotW, H);

    const tWindowStart = now - WINDOW;

    // Zero line — always full width
    p.stroke(35, 55, 90);
    p.strokeWeight(1);
    p.line(plotX, H / 2, plotX + plotW, H / 2);

    // Tick marks every 5 seconds
    p.stroke(30, 48, 80);
    p.strokeWeight(1);
    for (let s = 5; s < 30; s += 5) {
      const tx = plotX + (1 - s / 30) * plotW;
      p.line(tx, H / 2 - 4, tx, H / 2 + 4);
    }

    if (n > 1) {
      // ── Smoothed position trace (amber) — x spans bottom→top as 0→1 ──
      p.stroke(255, 165, 50, 130);
      p.strokeWeight(1.5);
      p.noFill();
      p.beginShape();
      for (let i = 0; i < n; i++) {
        const x = plotX + (this.#timeHistory[i] - tWindowStart) / WINDOW * plotW;
        const y = p.map(this.#xHistory[i], 0, 1, H - 6, 6);
        p.vertex(x, y);
      }
      p.endShape();

      // ── accelX trace (blue) — centred on zero ─────────────────────────
      p.stroke(90, 190, 255, 210);
      p.strokeWeight(1);
      p.noFill();
      p.beginShape();
      for (let i = 0; i < n; i++) {
        const x = plotX + (this.#timeHistory[i] - tWindowStart) / WINDOW * plotW;
        const y = p.map(this.#accelHistory[i], -this.#yMax, this.#yMax, H - 6, 6);
        p.vertex(x, y);
      }
      p.endShape();
    }

    // Time axis labels
    p.noStroke();
    p.textSize(8);
    p.fill(38, 58, 90);
    p.textAlign(p.LEFT, p.BOTTOM);
    p.text('30s ago', plotX + 3, H - 2);
    p.textAlign(p.RIGHT, p.BOTTOM);
    p.text('now', plotX + plotW - 3, H - 2);

    // Legend + live values
    p.noStroke();
    p.textSize(9);
    if (signal && !signal.noSignal) {
      p.fill(255, 165, 50);
      p.textAlign(p.LEFT, p.TOP);
      p.text(`x  ${(signal.x / W).toFixed(2)}`, plotX + 4, 3);

      p.fill(140, 190, 255);
      p.textAlign(p.LEFT, p.TOP);
      p.text(`ax ${signal.accelX.toFixed(4)}`, plotX + 58, 3);

      p.textSize(8);
      p.fill(50, 80, 120);
      p.textAlign(p.RIGHT, p.TOP);
      p.text(`±${this.#yMax.toFixed(3)}`, plotX + plotW - 3, 2);
    } else {
      p.fill(80);
      p.textAlign(p.LEFT, p.CENTER);
      p.text('no signal', plotX + 4, H / 2);
    }

    p.pop();
  }
}
