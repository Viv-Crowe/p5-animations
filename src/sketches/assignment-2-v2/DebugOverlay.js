// Draws a compact strip at the top of the canvas showing
// the two key interaction parameters: tracked X position and horizontal acceleration.
export class DebugOverlay {
  #p;
  static H = 36;

  constructor(p) {
    this.#p = p;
  }

  draw(signal) {
    const p  = this.#p;
    const W  = p.width;
    const H  = DebugOverlay.H;

    p.push();

    // Background
    p.noStroke();
    p.fill(0, 0, 0, 180);
    p.rect(0, 0, W, H);

    // Centre divider
    p.stroke(60);
    p.strokeWeight(1);
    p.line(W / 2, 0, W / 2, H);

    if (!signal || signal.noSignal) {
      p.fill(120);
      p.noStroke();
      p.textSize(11);
      p.textAlign(p.LEFT, p.CENTER);
      p.text('no signal', 10, H / 2);
      p.pop();
      return;
    }

    // ── Position rail (top half) ──────────────────────────────────
    const railY  = H * 0.28;
    const dotX   = p.map(signal.x, 0, W, 4, W - 4);

    p.stroke(50);
    p.strokeWeight(1);
    p.line(0, railY, W, railY);

    p.noStroke();
    p.fill(255, 230, 60);
    p.circle(dotX, railY, 8);

    // ── Acceleration bar (bottom half) ───────────────────────────
    const barY   = H * 0.72;
    const maxA   = 4;            // px/frame² treated as full-scale
    const barLen = p.map(Math.abs(signal.accelX), 0, maxA, 0, W * 0.45, true);
    const isRight = signal.accelX >= 0;
    const barX   = isRight ? W / 2 : W / 2 - barLen;

    p.fill(isRight ? p.color(80, 160, 255, 220) : p.color(255, 110, 60, 220));
    p.rect(barX, barY - 5, barLen, 10, 2);

    // ── Labels ───────────────────────────────────────────────────
    p.fill(180);
    p.noStroke();
    p.textSize(10);
    p.textAlign(p.RIGHT, p.CENTER);
    p.text(`x ${signal.x.toFixed(0)}`, W - 6, H * 0.28);
    p.textAlign(p.RIGHT, p.CENTER);
    p.text(`ax ${signal.accelX.toFixed(3)}`, W - 6, H * 0.72);

    p.pop();
  }
}
