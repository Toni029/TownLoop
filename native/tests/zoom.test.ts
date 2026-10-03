import test from "node:test";
import assert from "node:assert/strict";
import { MediaZoom } from "../src/components/zoom.ts";
test("native media zoom clamps pan and scale, resets and supports double-tap", () => {
  const zoom = new MediaZoom(() => {});
  zoom.resize(300, 500);
  zoom.zoom(20);
  assert.equal(zoom.scale, 5);
  zoom.apply(3, 1000, -1000);
  assert.equal(zoom.x, 300);
  assert.equal(zoom.y, -500);
  zoom.reset();
  assert.equal(zoom.x, 0);
  assert.equal(zoom.y, 0);
  zoom.begin([{ pageX: 10, pageY: 10 }]);
  zoom.end(0, 0, 1000);
  zoom.begin([{ pageX: 10, pageY: 10 }]);
  zoom.end(0, 0, 1150);
  assert.equal(zoom.scale, 2);
});
test("pinch zoom survives release without accidentally triggering a double-tap", () => {
  const zoom = new MediaZoom(() => {});
  zoom.resize(300, 500);
  zoom.begin([
    { pageX: 0, pageY: 0 },
    { pageX: 100, pageY: 0 },
  ]);
  zoom.move(
    [
      { pageX: 0, pageY: 0 },
      { pageX: 250, pageY: 0 },
    ],
    0,
    0,
  );
  zoom.end(0, 0, 100);
  assert.equal(zoom.scale, 2.5);
});
