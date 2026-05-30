// Dev UI: live webcam thumbnail with MediaPipe landmarks overlay.
export class DevUI {
  #p;
  static H = 120;

  // MediaPipe hand skeleton connections
  static #HAND_CONN = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[0,17],[17,18],[18,19],[19,20],
  ];

  constructor(p) {
    this.#p = p;
  }

  // opts: { video, activeInput }
  draw(signal, opts = {}) {
    const { video, activeInput } = opts;
    const p      = this.#p;
    const H      = DevUI.H;

    const vW     = video?.elt?.videoWidth  || video?.width  || 640;
    const vH     = video?.elt?.videoHeight || video?.height || 480;
    const thumbW = Math.round(H * vW / vH);

    p.push();

    p.noStroke();
    p.fill(8, 12, 22);
    p.rect(0, 0, thumbW, H);

    if (video) {
      p.push();
      p.translate(thumbW, 0);
      p.scale(-1, 1);
      p.image(video, 0, 0, thumbW, H);
      p.pop();

      const sx = thumbW / vW;
      const sy = H      / vH;

      // Face landmarks
      const faces = activeInput?.faces;
      if (faces?.length) {
        const box = faces[0].box;
        if (box) {
          p.noFill();
          p.stroke(55, 220, 95);
          p.strokeWeight(1.5);
          p.rect(box.xMin * sx, box.yMin * sy, box.width * sx, box.height * sy);

          p.noStroke();
          p.fill(255, 220, 0);
          p.circle((box.xMin + box.width / 2) * sx,
                   (box.yMin + box.height / 2) * sy, 6);
        }
      }

      // Hand skeleton
      const hands = activeInput?.hands;
      if (hands?.length) {
        const kps = hands[0].keypoints;
        if (kps) {
          p.stroke(60, 140, 255, 200);
          p.strokeWeight(1);
          for (const [a, b] of DevUI.#HAND_CONN) {
            if (kps[a] && kps[b]) {
              p.line(kps[a].x * sx, kps[a].y * sy,
                     kps[b].x * sx, kps[b].y * sy);
            }
          }
          p.noStroke();
          for (let i = 0; i < kps.length; i++) {
            if (!kps[i]) continue;
            const isIndex = i === 8;
            p.fill(isIndex ? p.color(255, 220, 0) : p.color(60, 180, 255));
            p.circle(kps[i].x * sx, kps[i].y * sy, isIndex ? 8 : 4);
          }
        }
      }

      if (!signal || signal.noSignal) {
        p.fill(0, 0, 0, 110);
        p.noStroke();
        p.rect(0, 0, thumbW, H);
        p.fill(160);
        p.textSize(10);
        p.textAlign(p.CENTER, p.CENTER);
        p.text('no signal', thumbW / 2, H / 2);
      }
    }

    p.noFill();
    p.stroke(40, 60, 100);
    p.strokeWeight(1);
    p.rect(0, 0, thumbW, H);

    p.pop();
  }
}
