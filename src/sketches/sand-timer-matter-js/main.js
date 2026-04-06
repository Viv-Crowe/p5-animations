import p5 from "p5";
import Matter from "matter-js";
import Particle from "./Particle.js";
import Boundary from "./Boundary.js";


const TOTAL_TIME = 15 // in seconds
const FRAME_RATE = 60 // frames/sec
const CANVAS_WIDTH = 300
const CANVAS_HEIGHT = 600
const PARTICLE_SCALE_FACTOR = 100
const TOTAL_PARTICLES = CANVAS_WIDTH*CANVAS_HEIGHT/PARTICLE_SCALE_FACTOR;
const PARTICLE_SIZE = Math.round(Math.sqrt(CANVAS_WIDTH*CANVAS_HEIGHT/TOTAL_PARTICLES));
const PARTICLES_PER_FRAME = Math.round(TOTAL_PARTICLES/(TOTAL_TIME*FRAME_RATE));
const BACKGROUND_COLOR = [30, 30, 30];
const PARTICLE_COLOR = [200, 0, 0];
const WALL_THICKNESS = 40;

new p5((p) => {
  let particles = [];
  let boundaries = [];
  let remainingSeconds = TOTAL_TIME;

  p.setup = () => {
    p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    p.background(...BACKGROUND_COLOR);
    p.engine = Matter.Engine.create();
    remainingSeconds = TOTAL_TIME;
    
    // p.engine.gravity.scale = 1;
    boundaries = [
      new Boundary(p, p.width / 2, p.height + WALL_THICKNESS / 2, p.width + WALL_THICKNESS * 2, WALL_THICKNESS), // floor
      new Boundary(p, -WALL_THICKNESS / 2, p.height / 2, WALL_THICKNESS, p.height + WALL_THICKNESS * 2), // left wall
      new Boundary(p, p.width + WALL_THICKNESS / 2, p.height / 2, WALL_THICKNESS, p.height + WALL_THICKNESS * 2), // right wall
      new Boundary(p, p.width / 2, -WALL_THICKNESS / 2, p.width + WALL_THICKNESS * 2, WALL_THICKNESS), // ceiling
    ];
  };

  p.draw = () => {
    Matter.Engine.update(p.engine);
    p.background(...BACKGROUND_COLOR);

    remainingSeconds = Math.max(0, remainingSeconds - p.deltaTime / 1000);

    if (remainingSeconds > 0 && particles.length < TOTAL_PARTICLES) {
      const spawnMargin = PARTICLE_SIZE / 2 + 1;
      for (let i = 0; i < PARTICLES_PER_FRAME && particles.length < TOTAL_PARTICLES; i++) {
          const x = spawnMargin + Math.random() * (CANVAS_WIDTH - spawnMargin * 2);
          const y = spawnMargin;
          particles.push(new Particle(p, x, y, PARTICLE_SIZE, PARTICLE_COLOR));
      }
    };

    for (const boundary of boundaries) {
      boundary.show();
    }

    for (let particle of particles) {
      particle.show();
    }

    p.push();
    p.fill(255);
    p.noStroke();
    p.textAlign(p.CENTER, p.TOP);
    p.textSize(24);
    p.text(Math.ceil(remainingSeconds), p.width / 2, 12);
    p.pop();
  };

});