// Cascaded EMA smoother with per-stage deadzones.
// Each derivative (velocity, acceleration) is smoothed independently
// rather than being a raw frame difference — this is what keeps
// accelX usable as a control signal.
//
// Stage alphas and deadzones are tuned for 60fps face/hand tracking:
//   position : α=0.15, dz=1.5px       — removes detection jitter
//   velocity : α=0.20, dz=0.08px/f    — smooths rapid direction changes
//   accel    : α=0.25, dz=0.008px/f²  — kills noise on the second derivative
export class SignalSmoother {
  #x      = null;
  #y      = null;
  #velX   = null;
  #velY   = null;
  #accelX = null;

  // EMA alpha per stage
  #aPos   = 0.15;
  #aVel   = 0.20;
  #aAccel = 0.25;

  // Deadzone per stage — changes smaller than this are ignored
  #dzPos   = 1.5;   // px
  #dzVel   = 0.08;  // px/frame
  #dzAccel = 0.008; // px/frame²

  #ema(prev, curr, alpha, dz) {
    if (prev === null) return curr;
    const diff = curr - prev;
    if (Math.abs(diff) < dz) return prev;
    return prev + diff * alpha;
  }

  // Feed a raw (x, y) reading; returns smoothed state object.
  process(rawX, rawY) {
    const x = this.#ema(this.#x, rawX, this.#aPos,   this.#dzPos);
    const y = this.#ema(this.#y, rawY, this.#aPos,   this.#dzPos);

    const rawVelX = this.#x !== null ? x - this.#x : 0;
    const rawVelY = this.#y !== null ? y - this.#y : 0;

    const velX = this.#ema(this.#velX   ?? 0, rawVelX,          this.#aVel,   this.#dzVel);
    const velY = this.#ema(this.#velY   ?? 0, rawVelY,          this.#aVel,   this.#dzVel);
    const accelX = this.#ema(this.#accelX ?? 0, velX - (this.#velX ?? 0), this.#aAccel, this.#dzAccel);

    this.#x      = x;
    this.#y      = y;
    this.#velX   = velX;
    this.#velY   = velY;
    this.#accelX = accelX;

    return { x, y, velX, velY, accelX, noSignal: false };
  }

  reset() {
    this.#x = this.#y = this.#velX = this.#velY = this.#accelX = null;
  }
}
