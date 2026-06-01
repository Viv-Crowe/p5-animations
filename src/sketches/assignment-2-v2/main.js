import p5 from 'p5';
import GUI from 'lil-gui';
import { FaceTracker }  from './FaceTracker.js';
import { MouseInput }   from './MouseInput.js';
import { HandInput }    from './HandInput.js';
import { DevUI } from './DevUI.js';
import { FluidSurface } from './FluidSurface.js';
import { NeuronLayer } from './NeuronLayer.js';

new p5((p) => {
  let video;
  let faceTracker, mouseInput, handInput, activeInput;

  let fluidSurface, neuronLayer, devUI;
  let nerveImg;
  let gui;

  const appParams = {
    inputSource:      'face',
    showDevUI: true,
    showNerveLayer: true,
    nerveR: true,
    nerveG: true,
    nerveB: true,
  };

  p.preload = () => {
    nerveImg = p.loadImage('./assets/nerves/bg_neural_layer.png');
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
    if (!fluidSurface)  fluidSurface  = new FluidSurface();
    if (!neuronLayer)   neuronLayer   = new NeuronLayer(document.body, p.width, p.height);
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
    boxFolder.add(pos, 'gridHeight', 0.1, 4, 0.1).name('Height');
    boxFolder.add(pos, 'gridDepth',   5, 100, 1).name('Depth');
    boxFolder.add(pos, 'particlesPerCell', 1, 40, 1).name('Particles/Cell');
    boxFolder.add({ rebuild: () => fluidSurface.rebuild() }, 'rebuild').name('Rebuild Sim');

    const nerveFolder = gui.addFolder('Nerve Layer').close();
    nerveFolder.add(appParams, 'showNerveLayer').name('Visible');
    nerveFolder.add(appParams, 'nerveR').name('Red channel');
    nerveFolder.add(appParams, 'nerveG').name('Green channel');
    nerveFolder.add(appParams, 'nerveB').name('Blue channel');

    const np = neuronLayer.params;
    const neuronFolder = gui.addFolder('Neuron').close();
    neuronFolder.add(np, 'visible').name('Visible');
    neuronFolder.addColor(np, 'tintColor').name('Tint');
    neuronFolder.add(np, 'basePeriod',      0.1,  5.0,  0.05).name('Fire interval (s)');
    neuronFolder.add(np, 'accelMax',         0.1, 20.0, 0.1 ).name('Accel cap');
    neuronFolder.add(np, 'modulationDepth',  0,   2.0,  0.05).name('Modulation depth');
    neuronFolder.add(np, 'flashAlpha',       0,   1.0,  0.01).name('Flash alpha');

    const hp = fluidSurface.hairLayer.params;
    const rebuild = () => fluidSurface.hairLayer.rebuild();
    const hairFolder = gui.addFolder('Hair Cells').close();
    hairFolder.add(hp, 'clumpCount',     1,    20,   1   ).name('Clusters').onChange(rebuild);
    hairFolder.add(hp, 'rows',           2,     6,   1   ).name('Rows').onChange(rebuild);
    hairFolder.add(hp, 'colsPerRow',     3,    14,   1   ).name('Cols / Row').onChange(rebuild);
    hairFolder.add(hp, 'hairLength',     0.05,  0.30, 0.01).name('Hair Length').onChange(rebuild);
    hairFolder.add(hp, 'paddleWidth',    0.3,   3.0,  0.05).name('Paddle Width').onChange(rebuild);
    hairFolder.add(hp, 'paddleDepth',    0.05,  1.0,  0.05).name('Paddle Depth').onChange(rebuild);
    hairFolder.add(hp, 'staircaseMin',   0.2,   0.9,  0.05).name('Staircase Min').onChange(rebuild);
    hairFolder.add(hp, 'deflectionScale', 0.0,  2.0,  0.1 ).name('Deflection');
    hairFolder.add(hp, 'baseY',         -15.0,  0.0,  0.5 ).name('Base Y');
    hairFolder.add(hp, 'frontFraction',  0.1,   1.0,  0.05).name('Front Fraction').onChange(rebuild);
    hairFolder.add(hp, 'visible').name('Visible');
    hairFolder.add(hp, 'showDomes').name('Show Domes');
  }

  p.draw = () => {
    if (activeInput) activeInput.update();
    const signal = activeInput?.state ?? null;

    // 1 — step fluid (renders to its own background canvas)
    fluidSurface.update(signal);

    // 2 — clear p5 canvas to transparent so fluid canvas shows through
    p.clear();

    // 3 — nerve layer image at bottom of screen
    if (appParams.showNerveLayer && nerveImg) {
      const imgH = p.width / (nerveImg.width / nerveImg.height);
      const r = appParams.nerveR ? 255 : 0;
      const g = appParams.nerveG ? 255 : 0;
      const b = appParams.nerveB ? 255 : 0;
      p.tint(r, g, b);
      p.image(nerveImg, 0, p.height - imgH, p.width, imgH);
      p.noTint();
    }

    // 4 — neuron firing animation (own WebGL canvas, z=2, above p5)
    neuronLayer.update(signal);

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
    neuronLayer.resize(p.windowWidth, p.windowHeight);
    gui.destroy();
    buildLayers();
    buildGUI();
  };
});
