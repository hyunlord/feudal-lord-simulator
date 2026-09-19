import assert from "node:assert/strict";
import test from "node:test";
import type { Building } from "../src/content/buildingConfig";
import { drawHouseCondition, type HouseConditionContext } from "../src/render/houseConditionOverlay";

function canvas() {
  const points: number[][] = [];
  let fills = 0;
  const saved: { alpha: number; fill: string | CanvasGradient | CanvasPattern }[] = [];
  const context: HouseConditionContext = {
    globalAlpha: 0.4, fillStyle: "initial", imageSmoothingEnabled: false,
    getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
    drawImage() {},
    save() { saved.push({ alpha: this.globalAlpha, fill: this.fillStyle }); },
    restore() { const value = saved.pop(); assert.ok(value); this.globalAlpha = value.alpha; this.fillStyle = value.fill; },
    beginPath() {}, closePath() {}, fill() { fills += 1; },
    moveTo(x, y) { points.push([x, y]); }, lineTo(x, y) { points.push([x, y]); },
  };
  return { context, points, fills: () => fills };
}
const building: Building = { id: "home", kind: "house", tx: 4, ty: 4, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };

test("condition paint preserves caller alpha and follows the building at every lot orientation", () => {
  for (const houseLot of [undefined, "horizontal", "vertical"] as const) {
    const home = houseLot === undefined ? building : { ...building, houseLot };
    for (const [condition, count] of [["maintained", 0], ["strained", 1], ["neglected", 2], ["vacant", 4]] as const) {
      const first = canvas(), moved = canvas();
      drawHouseCondition(first.context, home, 3, condition);
      drawHouseCondition(moved.context, { ...home, tx: home.tx + 1 }, 3, condition);
      assert.equal(first.fills(), count);
      assert.equal(first.context.globalAlpha, 0.4);
      assert.equal(first.context.fillStyle, "initial");
      assert.equal(first.points.length, moved.points.length);
      first.points.forEach((point, index) => {
        const other = moved.points[index]; assert.ok(other);
        assert.ok(Math.abs((other[0] ?? 0) - (point[0] ?? 0) - 32) < 1e-8);
        assert.ok(Math.abs((other[1] ?? 0) - (point[1] ?? 0) - 16) < 1e-8);
      });
    }
  }
});
