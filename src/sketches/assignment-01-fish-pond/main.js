import p5 from "p5";
import Fish from "./Fish.js";
import Droplet from "./Droplet.js";
import Food from "./Food.js";
import Pond from "./Pond.js";

const nFish = 6;
const water = [];
const food = [];
const BACKGROUND_COLOR = [255, 255, 255];
const dropletProbability = 0.01;
let pond;


new p5((p) => {
  p.setup = () => {
    p.createCanvas(600, 600);

    pond = new Pond(p);
    pond.addNFish(nFish);

    p.mousePressed = () => {
      food.push(new Food(p, p.mouseX, p.mouseY));
    };
  };

  p.draw = () => {
    p.background(BACKGROUND_COLOR);
    pond.show();

    for (const fish of pond.school) {
        fish.avoidWall(pond);
        fish.flock(pond.school);
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

    if (Math.random() < dropletProbability) {
        let x, y;
        do {
            x = Math.random() * p.width;
            y = Math.random() * p.height;
        } while (!pond.isInsidePond(p.createVector(x, y)));
      water.push(new Droplet(p, x, y));
    }
  };

});