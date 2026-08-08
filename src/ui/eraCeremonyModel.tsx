import { createElement, type MouseEvent } from "react";

import type { Era } from "../engine/engine.types";

const CEREMONY_DURATION_MS = 2_000;

export type EraCeremony = {
  readonly startedAtMs: number;
  readonly dismissed: boolean;
};

export type EraCeremonyPresentation = {
  readonly observedEra: Era;
  readonly ceremony: EraCeremony | null;
};

export function createEraCeremonyPresentation(era: Era): EraCeremonyPresentation {
  return { observedEra: era, ceremony: null };
}

export function observeEraCeremonyTransition(input: {
  readonly presentation: EraCeremonyPresentation;
  readonly era: Era;
  readonly nowMs: number;
}): EraCeremonyPresentation {
  if (input.presentation.observedEra === input.era) return input.presentation;
  return {
    observedEra: input.era,
    ceremony: startsEraCeremony(input.presentation.observedEra, input.era)
      ? { startedAtMs: input.nowMs, dismissed: false }
      : null,
  };
}

function startsEraCeremony(previous: Era, next: Era): boolean {
  return (
    (previous === "hamlet" && next === "palisade") ||
    (previous === "palisade" && next === "stone_town")
  );
}

export function dismissEraCeremony(presentation: EraCeremonyPresentation): EraCeremonyPresentation {
  if (presentation.ceremony === null) return presentation;
  return { ...presentation, ceremony: { ...presentation.ceremony, dismissed: true } };
}

export function visibleEraCeremony(
  presentation: EraCeremonyPresentation,
  nowMs: number,
): EraCeremony | null {
  const ceremony = presentation.ceremony;
  if (ceremony === null || ceremony.dismissed) return null;
  return nowMs - ceremony.startedAtMs < CEREMONY_DURATION_MS ? ceremony : null;
}

export function EraCeremonyBanner(input: {
  readonly ceremony: EraCeremony | null;
  readonly nowMs: number;
  readonly onDismiss: () => void;
}) {
  if (input.ceremony === null) return null;
  const progress = Math.max(0, Math.min(1, (input.nowMs - input.ceremony.startedAtMs) / CEREMONY_DURATION_MS));
  const dismiss = (event: MouseEvent) => {
    event.preventDefault();
    input.onDismiss();
  };
  return createElement(
    "div",
    { className: "era-ceremony", style: { "--ceremony-progress": progress }, onClick: dismiss },
    createElement(
      "section",
      { className: "era-ceremony__banner", "aria-label": "Palisade age ceremony" },
      createElement("span", { className: "era-ceremony__kicker" }, "새 시대"),
      createElement("h2", null, "목책마을 선포"),
      createElement("p", null, "성문이 열리고 집들이 새 목재를 두릅니다"),
      createElement("button", { type: "button", onClick: dismiss, "aria-label": "Dismiss palisade ceremony" }, "닫기"),
    ),
  );
}
