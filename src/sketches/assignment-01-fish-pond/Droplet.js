const WAVE_PROPAGATION_SPEED = 0.75;
const WAVE_PERIOD_LENGTH = 6;
const INITIAL_RADIUS = 0.1;
const MAX_RADIUS = 50;

export default class Droplet {
  constructor(p, x, y) {
    this.p = p;
    this.center = p.createVector(x, y);
    this.waveRadii = [INITIAL_RADIUS];
    this.nextWaveAt = INITIAL_RADIUS + WAVE_PERIOD_LENGTH;
  }

  update() {
    for (let i = 0; i < this.waveRadii.length; i++) {
      this.waveRadii[i] += WAVE_PROPAGATION_SPEED;
    }

    const newestWave = this.waveRadii[this.waveRadii.length - 1];
    if (newestWave >= this.nextWaveAt) {
      this.waveRadii.push(INITIAL_RADIUS);
      this.nextWaveAt += WAVE_PERIOD_LENGTH;
    }

    this.waveRadii = this.waveRadii.filter((r) => r <= MAX_RADIUS);
  }

    show() {
    this.p.noFill();

    for (const wave of this.waveRadii) {
        const thickness = Math.max(0.2, 2 - wave * 0.1);

        this.p.stroke(0);
        this.p.strokeWeight(thickness);
        this.p.circle(this.center.x, this.center.y, wave * 2);
    }
    }

    isFinished() {
        return this.waveRadii.length === 0;
    }
}
