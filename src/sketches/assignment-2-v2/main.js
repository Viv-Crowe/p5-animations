import p5 from 'p5';
import { FaceTracker } from './FaceTracker.js';
import { CrystalLayer } from './CrystalLayer.js';
import { GelLayer } from './GelLayer.js';
import { NerveLayer } from './NerveLayer.js';

// --- Update these paths to match your asset filenames ---
const TEXTURE_PATH = './assets/crystal-texture.jpg'; // not yet available
const SPRITE_PATHS = [
  './assets/crystal-1.png',
  './assets/crystal-2.png',
  './assets/crystal-3.png',
];

new p5((p) => {
  let video;
  let faceTracker;
  let crystalLayer, gelLayer, nerveLayer;
  let texture;
  let sprites = [];

  p.preload = () => {
    texture = p.loadImage(TEXTURE_PATH, () => {}, () => {
      console.warn('crystal-texture not found — using solid colour');
      texture = null;
    });
    for (const path of SPRITE_PATHS) {
      const img = p.loadImage(path, () => {}, () => {
        console.warn(`sprite not found: ${path}`);
      });
      sprites.push(img);
    }
  };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.pixelDensity(1);
    buildLayers();

    video = p.createCapture(p.VIDEO, { flipped: true }, () => {
      faceTracker = new FaceTracker(video);
      faceTracker.start();
    });
    video.hide();
  };

  function buildLayers() {
    const W       = p.width;
    const H       = p.height;
    const crystalH = H * 0.67;
    const gelY     = H * 0.67;
    const gelH     = H * 0.16;
    const nerveY   = H * 0.83;
    const nerveH   = H * 0.17;

    crystalLayer = new CrystalLayer(p, texture, sprites, 0, crystalH);
    gelLayer     = new GelLayer(p, gelY, gelH);
    nerveLayer   = new NerveLayer(p, nerveY, nerveH);
  }

  p.draw = () => {
    p.background(10, 5, 20);

    if (faceTracker) faceTracker.update();
    const face = faceTracker?.state ?? null;

    crystalLayer.update(face);
    gelLayer.update(face);
    nerveLayer.update(face);

    crystalLayer.draw();
    gelLayer.draw();
    nerveLayer.draw();

    // HUD
    p.fill(255, 255, 255, 180);
    p.noStroke();
    p.textSize(13);
    p.text(`fps: ${Math.round(p.frameRate())}`, 12, 20);
    if (face && !face.noFace) {
      p.text(`x:${face.x.toFixed(0)}  vx:${face.velX.toFixed(2)}  ax:${face.accelX.toFixed(3)}`, 12, 38);
    } else {
      p.text('no face', 12, 38);
    }
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    buildLayers();
  };
});
