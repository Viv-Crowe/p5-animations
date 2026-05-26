import p5 from 'p5';
import GUI from 'lil-gui';
import { FaceTracker }  from './FaceTracker.js';
import { MouseInput }   from './MouseInput.js';
import { HandInput }    from './HandInput.js';
import { DebugOverlay } from './DebugOverlay.js';
import { WaveSurface }  from './WaveSurface.js';
import { NerveLayer }   from './NerveLayer.js';

const SPRITE_PATHS = [
  './assets/crystal-1.png',
  './assets/crystal-2.png',
  './assets/crystal-3.png',
];

new p5((p) => {
  let video;
  let faceTracker, mouseInput, handInput, activeInput;

  let waveSurface, nerveLayer, debugOverlay;
  let waveGfx;   // WEBGL graphics buffer for the wave surface
  let gui;

  let sprites = [];

  const appParams = {
    inputSource:      'face',
    showDebugOverlay: true,
  };

  p.preload = () => {
    for (const path of SPRITE_PATHS) {
      sprites.push(p.loadImage(path, () => {}, () => {
        console.warn(`sprite not found: ${path}`);
      }));
    }
  };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.pixelDensity(1);

    buildLayers();
    buildGUI();

    mouseInput  = new MouseInput(p);
    activeInput = mouseInput;

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
    // WEBGL buffer — wave surface renders into this
    if (waveGfx) waveGfx.remove();
    waveGfx = p.createGraphics(p.width, p.height, p.WEBGL);
    waveGfx.pixelDensity(1);

    waveSurface = new WaveSurface(sprites);
    waveSurface.initCrystals(waveGfx);

    const nerveY = p.height * 0.83;
    const nerveH = p.height * 0.17;
    nerveLayer   = new NerveLayer(p, nerveY, nerveH);

    debugOverlay = new DebugOverlay(p);
  }

  function buildGUI() {
    gui = new GUI({ title: 'Parameters' });

    const appFolder = gui.addFolder('Input / Debug').close();
    appFolder.add(appParams, 'inputSource', ['face', 'mouse', 'hand'])
      .name('Input Source')
      .onChange(switchInput);
    appFolder.add(appParams, 'showDebugOverlay').name('Show Debug Overlay');

    const waveFolder = gui.addFolder('Wave Surface');
    waveFolder.add(waveSurface.params, 'ampLinear',      0,     30,    0.5  ).name('Amp Linear');
    waveFolder.add(waveSurface.params, 'ampRadial',      0,     60,    0.5  ).name('Amp Radial');
    waveFolder.add(waveSurface.params, 'radialDecay',    0.3,   1.0,   0.05 ).name('Radial Decay');
    waveFolder.add(waveSurface.params, 'kLinear',        0.005, 0.04,  0.001).name('k Linear');
    waveFolder.add(waveSurface.params, 'omegaLinear',    0.2,   3.0,   0.1  ).name('Omega Linear');
    waveFolder.add(waveSurface.params, 'accelBoostScale',0,     1000,  10   ).name('Accel → Radial Boost');

    const nerveFolder = gui.addFolder('Nerve Layer').close();
    nerveFolder.add(nerveLayer.params, 'visible').name('Visible');
  }

  p.draw = () => {
    if (activeInput) activeInput.update();
    const signal = activeInput?.state ?? null;

    const t = p.millis() / 1000;

    // 1 — update wave
    waveSurface.update(signal, p.width);

    // 2 — render wave into WEBGL buffer
    waveSurface.draw(waveGfx, t);

    // 3 — blit wave buffer to 2D main canvas
    p.image(waveGfx, 0, 0);

    // 4 — 2D overlays on top
    nerveLayer.update(signal);
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
