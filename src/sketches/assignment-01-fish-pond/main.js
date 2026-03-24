import p5 from "p5";
import Fish from "./Fish.js";

const nFish = 300;
const school = [];

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
      fish.update();
      fish.show();
    }
  };
});