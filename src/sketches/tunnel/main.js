import p5 from "p5";
import Branch from "./Branch";

new p5((p) => {
  const sketch = {
    canvas: {
      width: 400,
      height: 800,
    },
    color: {
      background: 0,
      stroke: 230,
    },
    branch: {
      count: 2,
      spread: {
        scale: 0.6,
      },
      length: {
        scale: 0.4,
        min: 10,
      },
      stroke: {
        trunkWeight: 2,
        taper: 0.5,
      },
    },
  };

  p.setup = () => {
    p.createCanvas(sketch.canvas.width, sketch.canvas.height);
    p.background(sketch.color.background);
    p.stroke(sketch.color.stroke);

    const trunk = new Branch({
      p,
      config: sketch.branch,
      start: p.createVector(p.width / 2, p.height),
      vector: p.createVector(0, -p.height / 4),
    });

      trunk.grow(13);
  };
});
