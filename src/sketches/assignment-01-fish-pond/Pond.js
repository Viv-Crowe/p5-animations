import Fish from "./Fish.js";

const AVOIDANCE = 1;
const RADIUS = 200;
const WATER_COLOR = [135, 187, 168];

export default class Pond {
  constructor(p) {
    this.p = p;
    this.center = p.createVector(p.width/2, p.height/2);
    this.radius = RADIUS;
    this.school = [];
  }
    show() {
    this.p.fill(WATER_COLOR);
    this.p.noStroke();
    this.p.circle(this.center.x, this.center.y, RADIUS * 2);
    }

    distToPondWall(position){
        // Positive if inside the pond, negative if outside.
        return this.radius - this.center.dist(position);
    }

    addNFish(nFish) {
        for (let i = 0; i < nFish; i++) {
            let x, y;
            do {
                x = Math.random() * this.p.width; 
                y = Math.random() * this.p.height;
            } while (this.distToPondWall(this.p.createVector(x, y)) < 0);
            const fish = new Fish(this.p, x, y);
            this.school.push(fish);
        }
    }

    isInsidePond(position) {
        return this.distToPondWall(position) > 0;
    }
}
