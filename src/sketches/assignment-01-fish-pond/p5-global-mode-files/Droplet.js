const WAVE_PROPAGATION_SPEED = 0.1;
const WAVE_PERIOD_LENGTH = 6;
const INITIAL_RADIUS = 0.1;
const MAX_RADIUS = 50;

class Droplet {
  constructor(x, y) {
    this.center = createVector(x, y);
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
    noFill();

    for (const wave of this.waveRadii) {
      const thickness = Math.max(0.05, 2 - wave * 0.1);
      stroke(255, 255, 255);
      strokeWeight(thickness);
      circle(this.center.x, this.center.y, wave * 2);
    }
  }

  isFinished() {
    return this.waveRadii.length === 0;
  }
}
