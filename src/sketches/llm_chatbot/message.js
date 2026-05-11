const USER_COL = [232, 197, 71];  // amber
const BOT_COL = [100, 180, 240]; // blue

class Message {
  constructor(p, text, role) {
    this.p = p;
    this.text = text;
    this.role = role;
    if (this.role === 'user') {
      this.tCol = p.color(USER_COL[0], USER_COL[1], USER_COL[2]);
      this.tAlign = p.RIGHT;
    } else {
      this.tCol = p.color(BOT_COL[0], BOT_COL[1], BOT_COL[2]);
      this.tAlign = p.LEFT;
    }
    this.tSize = 12;
    this.tFont = 'DM Sans';
  }

  tHeight(w) {
    const p = this.p;
    p.textSize(this.tSize);
    p.textFont(this.tFont);
    return Math.ceil(p.textWidth(this.text) / w) * p.textLeading();
  }

  show(x, y, w) {
    const p = this.p;
    p.push();
    p.translate(x, y);
    p.fill(this.tCol);
    p.textSize(this.tSize);
    p.textFont(this.tFont);
    p.textAlign(this.tAlign, p.BOTTOM);
    p.noStroke();
    p.text(this.text, 0, 0, w);
    p.pop();
  }
}
