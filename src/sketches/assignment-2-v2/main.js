import p5 from 'p5';
import GUI from 'lil-gui';
import { FaceTracker } from './FaceTracker.js';
import { MouseInput }  from './MouseInput.js';
import { HandInput }   from './HandInput.js';
import { DebugOverlay } from './DebugOverlay.js';
import { CrystalLayer } from './CrystalLayer.js';
import { GelLayer }     from './GelLayer.js';
import { NerveLayer }   from './NerveLayer.js';

// ── Asset paths — update filenames here as assets are added ───────────────
const TEXTURE_PATH = './assets/crystal-texture.jpg';
const SPRITE_PATHS = [
  './assets/crystal-1.png',
  './assets/crystal-2.png',
  './assets/crystal-3.png',
];

new p5((p) => {
  let video;
  let faceTracker, mouseInput, handInput, activeInput;

  let crystalLayer, gelLayer, nerveLayer;
  let debugOverlay;
  let gui;

  let texture;
  let sprites = [];

  // ── App-level params (bound to GUI) ──────────────────────────────────────
  const appParams = {
    inputSource:      'face', // 'face' | 'mouse' | 'hand'
    showDebugOverlay: true,
  };

  p.preload = () => {
    texture = p.loadImage(TEXTURE_PATH, () => {}, () => {
      console.warn('crystal-texture not found — using solid colour placeholder');
      texture = null;
    });
    for (const path of SPRITE_PATHS) {
      sprites.push(p.loadImage(path, () => {}, () => {
        console.warn(`sprite not found: ${path}`);
      }));
    }
  };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.pixelDensity(1);

    debugOverlay = new DebugOverlay(p);
    buildLayers();
    buildGUI();

    mouseInput = new MouseInput(p);
    activeInput = mouseInput; // use mouse until camera is ready

    video = p.createCapture(p.VIDEO, { flipped: true }, () => {
      faceTracker = new FaceTracker(video);
      faceTracker.start();
      handInput = new HandInput(video);
      handInput.start();
      switchInput(appParams.inputSource);
    });
    video.hide();
  };

  function switchInput(source) {
    switch (source) {
      case 'face':  activeInput = faceTracker ?? mouseInput; break;
      case 'hand':  activeInput = handInput   ?? mouseInput; break;
      default:      activeInput = mouseInput;
    }
  }

  function buildLayers() {
    const H        = p.height;
    const crystalH = H * 0.67;
    const gelY     = H * 0.67;
    const gelH     = H * 0.16;
    const nerveY   = H * 0.83;
    const nerveH   = H * 0.17;

    crystalLayer = new CrystalLayer(p, texture, sprites, 0, crystalH);
    gelLayer     = new GelLayer(p, gelY, gelH);
    nerveLayer   = new NerveLayer(p, nerveY, nerveH);
  }

  function buildGUI() {
    gui = new GUI({ title: 'Parameters' });

    // ── App ────────────────────────────────────────────────────────────────
    const appFolder = gui.addFolder('Input / Debug').close();
    appFolder.add(appParams, 'inputSource', ['face', 'mouse', 'hand'])
      .name('Input Source')
      .onChange(switchInput);
    appFolder.add(appParams, 'showDebugOverlay').name('Show Debug Overlay');

    // ── Crystal Layer ──────────────────────────────────────────────────────
    const crystalFolder = gui.addFolder('Crystal Layer');
    crystalFolder.add(crystalLayer.params, 'visible').name('Visible');
    crystalFolder.add(crystalLayer.params, 'depthFade').name('Depth Fade');
    crystalFolder.add(crystalLayer.params, 'parallaxScale', 0, 0.6, 0.01)
      .name('Parallax Scale');

    // ── Gel Layer ──────────────────────────────────────────────────────────
    const gelFolder = gui.addFolder('Gel Layer');
    gelFolder.add(gelLayer.params, 'visible').name('Visible');
    gelFolder.add(gelLayer.params, 'sensitivity', 0, 40, 0.5)
      .name('Sensitivity (velX→disp)');
    gelFolder.add(gelLayer.params, 'spring', 0.01, 0.2, 0.005)
      .name('Spring stiffness');
    gelFolder.add(gelLayer.params, 'damping', 0.5, 0.99, 0.01)
      .name('Damping (viscosity)');

    // ── Nerve Layer ────────────────────────────────────────────────────────
    const nerveFolder = gui.addFolder('Nerve Layer').close();
    nerveFolder.add(nerveLayer.params, 'visible').name('Visible');
  }

  p.draw = () => {
    p.background(10, 5, 20);

    if (activeInput) activeInput.update();
    const signal = activeInput?.state ?? null;

    crystalLayer.update(signal);
    gelLayer.update(signal);
    nerveLayer.update(signal);

    crystalLayer.draw();
    gelLayer.draw();
    nerveLayer.draw();

    if (appParams.showDebugOverlay) debugOverlay.draw(signal);

    // fps counter
    p.fill(255, 255, 255, 120);
    p.noStroke();
    p.textSize(11);
    p.textAlign(p.LEFT, p.BOTTOM);
    p.text(`${Math.round(p.frameRate())} fps`, 8, p.height - 6);
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    gui.destroy();
    buildLayers();
    buildGUI();
  };
});
