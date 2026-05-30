import p5 from 'p5';
import GUI from 'lil-gui';
import { FaceTracker }  from './FaceTracker.js';
import { MouseInput }   from './MouseInput.js';
import { HandInput }    from './HandInput.js';
import { DevUI } from './DevUI.js';
import { FluidSurface } from './FluidSurface.js';
import { NerveLayer }   from './NerveLayer.js';

new p5((p) => {
  let video;
  let faceTracker, mouseInput, handInput, activeInput;

  let fluidSurface, nerveLayer, devUI;
  let gui;

  const appParams = {
    inputSource:      'face',
    showDevUI: true,
  };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.pixelDensity(1);

    // Sit on top of the fluid WebGL canvas
    Object.assign(p.canvas.style, {
      position: 'fixed', top: '0', left: '0', zIndex: '1',
    });

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
    if (!fluidSurface) fluidSurface = new FluidSurface();

    const nerveY = p.height * 0.83;
    const nerveH = p.height * 0.17;
    nerveLayer   = new NerveLayer(p, nerveY, nerveH);

    devUI = new DevUI(p);
  }

  function buildGUI() {
    gui = new GUI({ title: 'Parameters' });

    const appFolder = gui.addFolder('Dev UI');
    appFolder.add(appParams, 'inputSource', ['face', 'mouse', 'hand'])
      .name('Input Source')
      .onChange(switchInput);
    appFolder.add(appParams, 'showDevUI').name('Show Dev UI');

    const fluidFolder = gui.addFolder('Fluid').close();
    fluidFolder.add(fluidSurface.params, 'flipness', 0.001, 0.05, 0.001)
      .name('Fluidity')
      .onChange(v => { if (fluidSurface.simulator) fluidSurface.simulator.flipness = v; });
    fluidFolder.add(fluidSurface.params, 'timeStep', 0, 0.0055, 0.0001).name('Speed');
    fluidFolder.add(fluidSurface.params, 'forceMultiplier', 0, 10, 0.1).name('Force Scale');

    const boxFolder = gui.addFolder('Box').close();
    const pos = fluidSurface.params;
    const onOrbit = () => fluidSurface.applyCamera();
    boxFolder.add(pos, 'orbitX', 0, 100, 0.5).name('Position X').onChange(onOrbit);
    boxFolder.add(pos, 'orbitY', -20, 20, 0.1).name('Position Y').onChange(onOrbit);
    boxFolder.add(pos, 'orbitZ', 0, 80, 0.5).name('Position Z').onChange(onOrbit);
    boxFolder.add(pos, 'gridWidth',  10, 150, 1).name('Width');
    boxFolder.add(pos, 'gridHeight', 0.1, 2, 0.1).name('Height');
    boxFolder.add(pos, 'gridDepth',   5, 100, 1).name('Depth');
    boxFolder.add(pos, 'particlesPerCell', 1, 40, 1).name('Particles/Cell');
    boxFolder.add({ rebuild: () => fluidSurface.rebuild() }, 'rebuild').name('Rebuild Sim');

    const nerveFolder = gui.addFolder('Nerve Layer').close();
    nerveFolder.add(nerveLayer.params, 'visible').name('Visible');
  }

  p.draw = () => {
    if (activeInput) activeInput.update();
    const signal = activeInput?.state ?? null;

    // 1 — step fluid (renders to its own background canvas)
    fluidSurface.update(signal);

    // 2 — clear p5 canvas to transparent so fluid canvas shows through
    p.clear();

    // 3 — 2D overlays
    nerveLayer.update(signal);
    nerveLayer.draw();

    if (appParams.showDevUI) devUI.draw(signal, { video, activeInput });

    // fps counter
    p.fill(255, 255, 255, 120);
    p.noStroke();
    p.textSize(11);
    p.textAlign(p.LEFT, p.BOTTOM);
    p.text(`${Math.round(p.frameRate())} fps`, 8, p.height - 6);
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    fluidSurface.resize(p.windowWidth, p.windowHeight);
    gui.destroy();
    buildLayers();
    buildGUI();
  };
});
