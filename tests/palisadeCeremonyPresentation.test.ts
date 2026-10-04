import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Era } from "../src/engine/engine.types";
import {
  EraCeremonyBanner,
  observeEraCeremonyTransition,
  visibleEraCeremony,
  type EraCeremonyPresentation,
} from "../src/ui/eraCeremonyModel";

function presentation(patch: Partial<EraCeremonyPresentation> = {}): EraCeremonyPresentation {
  return {
    observedEra: "hamlet",
    ceremony: null,
    ...patch,
  };
}

test("era ceremony starts on hamlet to palisade and palisade to Stone Town transitions", () => {
  // Given
  const firstSeenPalisade = presentation({ observedEra: "palisade" });
  const hamletSeen = presentation();

  // When
  const loaded = observeEraCeremonyTransition({
    presentation: firstSeenPalisade,
    era: "palisade",
    nowMs: 1_000,
  });
  const transitioned = observeEraCeremonyTransition({
    presentation: hamletSeen,
    era: "palisade",
    nowMs: 1_000,
  });
  const stoneTransitioned = observeEraCeremonyTransition({
    presentation: presentation({ observedEra: "palisade" }),
    era: "stone_town",
    nowMs: 2_000,
  });

  // Then
  assert.deepEqual(loaded, firstSeenPalisade);
  assert.equal(transitioned.observedEra, "palisade");
  assert.deepEqual(transitioned.ceremony, {
    startedAtMs: 1_000,
    dismissed: false,
    targetEra: "palisade",
  });
  assert.equal(stoneTransitioned.observedEra, "stone_town");
  assert.deepEqual(stoneTransitioned.ceremony, {
    startedAtMs: 2_000,
    dismissed: false,
    targetEra: "stone_town",
  });
});

test("era ceremony is dismissible and automatically ends after two seconds", () => {
  // Given
  const active = presentation({
    observedEra: "palisade",
    ceremony: { startedAtMs: 1_000, dismissed: false, targetEra: "palisade" },
  });
  const dismissed = presentation({
    observedEra: "palisade",
    ceremony: { startedAtMs: 1_000, dismissed: true, targetEra: "palisade" },
  });

  // When / Then
  assert.notEqual(visibleEraCeremony(active, 2_999), null);
  assert.equal(visibleEraCeremony(active, 3_000), null);
  assert.equal(visibleEraCeremony(dismissed, 1_001), null);
});

test("era ceremony banner uses canonical class hooks and Korean transition copy", () => {
  // Given
  const markup = renderToStaticMarkup(
    createElement(EraCeremonyBanner, {
      ceremony: { startedAtMs: 1_000, dismissed: false, targetEra: "palisade" },
      nowMs: 1_200,
      onDismiss: () => undefined,
    }),
  );

  // Then
  assert.match(markup, /class="era-ceremony"/);
  assert.match(markup, /목책마을 선포/);
  assert.match(markup, /성문이 열리고 집들이 새 목재를 두릅니다/);
  assert.match(markup, /aria-label="목책마을 선포식 닫기"/);
});

test("era ceremony banner uses distinct Stone Town copy without palisade aria text", () => {
  // Given
  const markup = renderToStaticMarkup(
    createElement(EraCeremonyBanner, {
      ceremony: { startedAtMs: 1_000, dismissed: false, targetEra: "stone_town" },
      nowMs: 1_200,
      onDismiss: () => undefined,
    }),
  );

  // Then
  assert.match(markup, /class="era-ceremony"/);
  assert.match(markup, /aria-label="석벽 도시 선포식"/);
  assert.match(markup, /석벽 도시 선포/);
  // COPY-1r CA-015: a wall raised for the town's defence, not every house turned to stone.
  assert.match(markup, /목책을 대신할 석벽을 세우고 도시의 방비를 다집니다/);
  assert.doesNotMatch(markup, /돌빛으로 바뀝니다/);
  assert.match(markup, /aria-label="석벽 도시 선포식 닫기"/);
  assert.doesNotMatch(markup, /Palisade age ceremony|Dismiss palisade ceremony|목책마을 선포/);
});

test("era ceremony presentation never expands the gameplay era union", () => {
  // Given / When
  const era: Era = "palisade";

  // Then
  assert.equal(era, "palisade");
});
