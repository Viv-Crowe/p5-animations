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

    const appFolder = gui.addFolder('Input / Debug');
    appFolder.add(appParams, 'inputSource', ['face', 'mouse', 'hand'])
      .name('Input Source')
      .onChange(switchInput);
    appFolder.add(appParams, 'showDebugOverlay').name('Show Debug Overlay');
    // ── Input → gel mapping ───────────────────────────────────────────
    appFolder.add(waveSurface.params, 'useVelocity')
      .name('Use Velocity (not Accel)');
    appFolder.add(waveSurface.params, 'responseAlpha', 0.5, 0.99, 0.01)
      .name('Response EMA');

    const waveFolder = gui.addFolder('Gel Surface').close();
    waveFolder.add(waveSurface.params, 'amplitudeScale', 0,   1000, 10 ).name('Amplitude Scale');
    waveFolder.add(waveSurface.params, 'muScale',        0,   5000, 50 ).name('Peak Position Scale');
    waveFolder.add(waveSurface.params, 'sigma',          10,  400,  5  ).name('Bell Width (σ)');
    waveFolder.add(waveSurface.params, 'asymmetryScale', 0,   1,    0.05).name('Asymmetry');
    waveFolder.add(waveSurface.params, 'bgAmplitude',    0,   20,   0.5 ).name('Idle Wave Amp');
    waveFolder.add(waveSurface.params, 'bgSpeed',        0,   2,    0.05).name('Idle Wave Speed');
    waveFolder.add(waveSurface.params, 'bgFreq',         0,   0.03, 0.001).name('Idle Wave Freq');

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

    if (appParams.showDebugOverlay) debugOverlay.draw(signal, { video, activeInput });

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
