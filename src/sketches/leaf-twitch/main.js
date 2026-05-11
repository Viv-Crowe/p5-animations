import p5 from "p5";
import leafSrc from "./gum_leaf_1.png";

new p5((p) => {
  let leafImage;
  let loadFailed = false;

  p.preload = async () => {
    try {
      leafImage = await p.loadImage(leafSrc);
    } catch (err) {
      loadFailed = true;
      console.error("Failed to load leaf image:", err);
    }
  };

  p.setup = () => {
    const width = leafImage?.width || 400;
    const height = leafImage?.height || 800;
    p.createCanvas(width, height);
  };

  p.draw = () => {
    // White base lets transparent pixels in the PNG read as white.
    p.background(255);

    if (leafImage) {
      p.image(leafImage, 0, 0, p.width, p.height);
      return;
    }

    p.fill(80);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(16);
    p.text(loadFailed ? "Leaf image failed to load" : "Loading leaf image...", p.width / 2, p.height / 2);
  };

  p.windowResized = () => {
    if (leafImage && (p.width !== leafImage.width || p.height !== leafImage.height)) {
      p.resizeCanvas(leafImage.width, leafImage.height);
    }
  };
});
