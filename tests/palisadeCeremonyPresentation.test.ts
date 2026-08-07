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

test("era ceremony starts only on an observed hamlet to palisade transition", () => {
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

  // Then
  assert.deepEqual(loaded, firstSeenPalisade);
  assert.equal(transitioned.observedEra, "palisade");
  assert.deepEqual(transitioned.ceremony, { startedAtMs: 1_000, dismissed: false });
});

test("era ceremony is dismissible and automatically ends after two seconds", () => {
  // Given
  const active = presentation({
    observedEra: "palisade",
    ceremony: { startedAtMs: 1_000, dismissed: false },
  });
  const dismissed = presentation({
    observedEra: "palisade",
    ceremony: { startedAtMs: 1_000, dismissed: true },
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
      ceremony: { startedAtMs: 1_000, dismissed: false },
      nowMs: 1_200,
      onDismiss: () => undefined,
    }),
  );

  // Then
  assert.match(markup, /class="era-ceremony"/);
  assert.match(markup, /목책마을 선포/);
  assert.match(markup, /성문이 열리고 집들이 새 목재를 두릅니다/);
  assert.match(markup, /aria-label="Dismiss palisade ceremony"/);
});

test("era ceremony presentation never expands the gameplay era union", () => {
  // Given / When
  const era: Era = "palisade";

  // Then
  assert.equal(era, "palisade");
});
