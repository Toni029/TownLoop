export class MediaZoom {
  scale = 1;
  x = 0;
  y = 0;
  width = 1;
  height = 1;
  private base = 1;
  private distance = 0;
  private panX = 0;
  private panY = 0;
  private lastTap = 0;
  private changed: (
    scale: number,
    x: number,
    y: number,
    finished: boolean,
  ) => void;
  private pinched = false;
  constructor(
    changed: (scale: number, x: number, y: number, finished: boolean) => void,
  ) {
    this.changed = changed;
  }
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  apply(value: number, x = 0, y = 0, finished = false) {
    this.scale = Math.max(1, Math.min(5, value));
    const bx = ((this.scale - 1) * this.width) / 2,
      by = ((this.scale - 1) * this.height) / 2;
    this.x = Math.max(-bx, Math.min(bx, x));
    this.y = Math.max(-by, Math.min(by, y));
    this.changed(this.scale, this.x, this.y, finished);
  }
  zoom(delta: number) {
    this.apply(this.scale + delta, this.x, this.y, true);
  }
  reset() {
    this.apply(1, 0, 0, true);
  }
  begin(touches: { pageX: number; pageY: number }[]) {
    this.pinched = touches.length >= 2;
    this.base = this.scale;
    this.panX = this.x;
    this.panY = this.y;
    this.distance =
      touches.length >= 2
        ? Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY,
          )
        : 0;
  }
  move(touches: { pageX: number; pageY: number }[], dx: number, dy: number) {
    if (touches.length >= 2) {
      this.pinched = true;
      const d = Math.hypot(
        touches[0].pageX - touches[1].pageX,
        touches[0].pageY - touches[1].pageY,
      );
      if (!this.distance) {
        this.distance = d;
        this.base = this.scale;
      }
      this.apply((this.base * d) / Math.max(1, this.distance), this.x, this.y);
    } else if (this.scale > 1)
      this.apply(this.scale, this.panX + dx, this.panY + dy);
  }
  end(dx: number, dy: number, now: number) {
    if (!this.pinched && Math.abs(dx) + Math.abs(dy) < 8) {
      if (now - this.lastTap < 300) this.apply(this.scale > 1 ? 1 : 2);
      this.lastTap = now;
    }
    this.changed(this.scale, this.x, this.y, true);
  }
}
