import assert from "node:assert/strict";
import test from "node:test";

import { buildCategorySelection } from "../src/ui/buildMenuPresentation";

test("Given a category click When the road category opens Then road becomes the active placement tool", () => {
  assert.equal(buildCategorySelection("paths"), "road");
});

test("Given road placement is active When another category opens Then road placement ends", () => {
  assert.equal(buildCategorySelection("trade"), null);
});
