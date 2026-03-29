import p5 from "p5";
import Fish from "./Fish.js";
import Droplet from "./Droplet.js";
import Food from "./Food.js";

const nFish = 300;
const school = [];
const water = [];
const food = [];

new p5((p) => {
  p.setup = () => {
    p.createCanvas(800, 400);
    for (let i = 0; i < nFish; i++) {
        school.push(new Fish(p));
    }
  };

  p.draw = () => {
    p.background(135, 187, 168);

    for (const fish of school) {
      fish.flock(school);
      fish.eat(food);
      fish.hunt(food);
      fish.update();
      fish.show();
    }
    for (const droplet of water) {
      droplet.update();
      droplet.show();
    }
    for (const flake of food) {
      flake.show();
    }
    for (let i = water.length - 1; i >= 0; i--) {
        if (water[i].isFinished()) {
            water.splice(i, 1);
        }
    }

    if (Math.random() < 0.1) {
        water.push(new Droplet(p, Math.random() * p.width, Math.random() * p.height))
    };
    if (Math.random() < 0.1) {
        food.push(new Food(p, Math.random() * p.width, Math.random() * p.height))
    };
    };
});