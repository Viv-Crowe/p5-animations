const nFish = 6;
const water = [];
const food = [];
const BACKGROUND_COLOR = [255, 255, 255];
const dropletProbability = 0.01;

let pond;

function setup() {
  createCanvas(1200, 800);

  pond = new Pond();
  pond.addNFish(nFish);
}

function draw() {
  background(BACKGROUND_COLOR);
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

  if (random() < dropletProbability) {
    let x, y;
    do {
      x = random(width);
      y = random(height);
    } while (!pond.isInsidePond(createVector(x, y)));

    water.push(new Droplet(x, y));
  }
}

function mousePressed() {
  food.push(new Food(mouseX, mouseY));
}
