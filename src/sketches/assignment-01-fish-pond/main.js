import p5 from "p5";

new p5((p) => {
  p.setup = () => {
    p.createCanvas(400, 400);
  };

  p.draw = () => {
    p.background(220);
    p.circle(210, 200, 50);
  };
});