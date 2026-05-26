import ml5 from 'ml5';

export class FaceTracker {
  #faces = [];
  #state = null;
  #alpha = 0.18;

  constructor(video) {
    const faceMesh = ml5.faceMesh({ maxFaces: 1, flipped: true }, () => {
      faceMesh.detectStart(video, (results) => { this.#faces = results; });
    });
  }

  update() {
    if (!this.#faces.length) {
      if (this.#state) this.#state = { ...this.#state, noFace: true };
      return;
    }

    const face = this.#faces[0];
    const rawX = face.box.xMin + face.box.width  / 2;
    const rawY = face.box.yMin + face.box.height / 2;

    const prev = this.#state;
    const a    = this.#alpha;
    const x    = prev ? prev.x + (rawX - prev.x) * a : rawX;
    const y    = prev ? prev.y + (rawY - prev.y) * a : rawY;

    const velX   = prev ? x - prev.x : 0;
    const velY   = prev ? y - prev.y : 0;
    const accelX = prev ? velX - prev.velX : 0;

    this.#state = { x, y, velX, velY, accelX, noFace: false };
  }

  get state() { return this.#state; }
}
