import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { assertBuildingSpriteSet } from "./processBuildingSprite";

export const verifyBuildingSprites = (candidateRoot: string): void => {
  assertBuildingSpriteSet(candidateRoot);
};

const main = (): number => {
  const candidateRoot = process.argv[2];
  try {
    if (candidateRoot === undefined) {
      throw new Error("Usage: tsx scripts/verifyBuildingSprites.ts <public/assets/buildings/candidates>");
    }
    verifyBuildingSprites(candidateRoot);
    writeFileSync(1, "Building sprite verification passed\n");
    return 0;
  } catch (caught) {
    if (caught instanceof Error) {
      writeFileSync(2, `${caught.name}: ${caught.message}\n`);
      return 1;
    }
    throw caught;
  }
};

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = main();
}
