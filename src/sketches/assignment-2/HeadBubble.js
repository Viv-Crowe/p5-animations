export class HeadBubble {
  #p;
  #holdFrames;
  #maxMissing;
  #lastGoodHeadCircle = null;
  #smoothedHeadCircle = null;
  #missingFrames = 0;

  constructor(p, { holdFrames = 5, maxMissing = 30 } = {}) {
    this.#p = p;
    this.#holdFrames = holdFrames;
    this.#maxMissing = maxMissing;
  }

  // Call once per frame per pose. bodyHeight used as radius fallback when ears aren't visible.
  update(pose, bodyHeight = 0) {
    if (!pose) return this.#handleMissing();
    const kp = pose.keypoints;
    const confident = (i) => kp[i].confidence > 0.5;
    if (!confident(0)) return this.#handleMissing();

    const visibleEars = [3, 4].filter(confident);
    let radius;
    if (visibleEars.length === 2) {
      radius = Math.hypot(kp[3].x - kp[4].x, kp[3].y - kp[4].y) * 0.7;
    } else if (visibleEars.length === 1) {
      radius = Math.hypot(kp[0].x - kp[visibleEars[0]].x, kp[0].y - kp[visibleEars[0]].y) * 1.4;
    } else {
      radius = bodyHeight > 0 ? bodyHeight * 0.12 : 50;
    }

    this.#missingFrames = 0;
    this.#lastGoodHeadCircle = { x: kp[0].x, y: kp[0].y, radius };
    return this.#smoothToward(this.#lastGoodHeadCircle);
  }

  draw() {
    const hc = this.#smoothedHeadCircle;
    if (!hc) return;
    this.#p.noFill();
    this.#p.stroke(250, 250, 0);
    this.#p.strokeWeight(3);
    this.#p.circle(hc.x, hc.y, hc.radius * 2);
  }

  get circle() {
    return this.#smoothedHeadCircle;
  }

  #handleMissing() {
    this.#missingFrames++;
    if (this.#missingFrames <= this.#holdFrames) return this.#smoothedHeadCircle;
    if (this.#missingFrames <= this.#maxMissing && this.#lastGoodHeadCircle) return this.#smoothedHeadCircle;
    this.#smoothedHeadCircle = null;
    this.#lastGoodHeadCircle = null;
    return null;
  }

  #smoothToward(target) {
    if (!this.#smoothedHeadCircle) {
      this.#smoothedHeadCircle = { ...target };
      return this.#smoothedHeadCircle;
    }
    this.#smoothedHeadCircle.x = this.#smooth(this.#smoothedHeadCircle.x, target.x, 0.22, 3);
    this.#smoothedHeadCircle.y = this.#smooth(this.#smoothedHeadCircle.y, target.y, 0.22, 3);
    this.#smoothedHeadCircle.radius = this.#smooth(this.#smoothedHeadCircle.radius, target.radius, 0.12, 2);
    return this.#smoothedHeadCircle;
  }

  #smooth(previous, current, alpha, deadzone = 0) {
    if (!Number.isFinite(current)) return previous;
    if (previous == null) return current;
    const diff = current - previous;
    if (Math.abs(diff) < deadzone) return previous;
    return previous + diff * alpha;
  }
}
