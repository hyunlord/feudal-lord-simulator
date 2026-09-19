import assert from "node:assert/strict";
import test from "node:test";
import { timberGatePiers, timberWallPostPoints } from "../src/render/timberGateGeometry";

for (const end of [{ x: 2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }, { x: 2, y: -2 }]) {
  test(`timber gate leaves road lanes open in direction ${JSON.stringify(end)}`, () => {
    const gate = { x: 0, y: 0 };
    const path = [gate, end];
    const posts = timberWallPostPoints(path, gate);
    assert.ok(posts.length > 0);
    assert.ok(posts.every(point => Math.max(Math.abs(point.x), Math.abs(point.y)) >= 0.925));
    assert.deepEqual(posts, timberWallPostPoints([...path].reverse(), gate));
    const piers = timberGatePiers(path, gate);
    assert.equal(piers.length, 1);
    assert.ok(piers.every(point => Math.abs(Math.max(Math.abs(point.x), Math.abs(point.y)) - 0.95) < 1e-8));
  });
}

test("turning timber gate retains two separate flanking piers and no center post", () => {
  const gate = { x: 0, y: 0 };
  const path = [{ x: -1, y: 0 }, gate, { x: 0, y: 1 }];
  assert.equal(timberGatePiers(path, gate).length, 2);
  assert.equal(timberWallPostPoints(path, gate).length, 0);
});

test("gate inside a long run opens both sides rather than requiring a path vertex", () => {
  const gate = { x: 2, y: 0 };
  const path = [{ x: 0, y: 0 }, { x: 4, y: 0 }];
  assert.equal(timberGatePiers(path, gate).length, 2);
  assert.ok(timberWallPostPoints(path, gate).every(point => Math.abs(point.x - gate.x) >= 0.925));
});
