export default class Branch {
	constructor({ p, config, start, vector }) {
		this.p = p;
		this.config = config;
		this.start = start;
		this.vector = vector;
	}

	get end() {
		return this.start.copy().add(this.vector);
	}

	get length() {
		return this.vector.mag();
	}

	getBranchCount() {
		const maxBranchCount = Math.max(1, Math.floor(this.config.count));
		return this.p.floor(this.p.random(1, maxBranchCount + 1));
	}

	getStrokeWeight(depth) {
		return this.p.max(
			1,
			this.config.stroke.trunkWeight * Math.pow(this.config.stroke.taper, depth),
		);
	}

	shouldGrow(depth) {
		return depth > 0;
	}

	createChild(angleDeg) {
		return new Branch({
			p: this.p,
			config: this.config,
			start: this.end,
			vector: this.vector
				.copy()
				.rotate(this.p.radians(angleDeg))
				.mult(this.config.length.scale),
		});
	}

	grow(depth, currentDepth = 0) {
		this.p.strokeWeight(this.getStrokeWeight(currentDepth));
		this.p.line(this.start.x, this.start.y, this.end.x, this.end.y);

		if (!this.shouldGrow(depth)) {
			return;
		}

		const branchCount = this.getBranchCount();
		const baseAngleStep = branchCount === 1 ? 0 : 180 / branchCount;
		const angleStep = baseAngleStep * this.config.spread.scale;
		const totalSpread = angleStep * (branchCount - 1);
		const startAngle = -totalSpread / 2;

		for (let index = 0; index < branchCount; index++) {
			const angleDeg = branchCount === 1 ? 0 : startAngle + index * angleStep;
			this.createChild(angleDeg).grow(depth - 1, currentDepth + 1);
		}
	}
}
