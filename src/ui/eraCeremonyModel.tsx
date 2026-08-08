import { createElement, type MouseEvent } from "react";

import type { Era } from "../engine/engine.types";

const CEREMONY_DURATION_MS = 2_000;

export type EraCeremony = {
  readonly startedAtMs: number;
  readonly dismissed: boolean;
  readonly targetEra: Extract<Era, "palisade" | "stone_town">;
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
    ceremony: eraCeremonyForTransition(input.presentation.observedEra, input.era, input.nowMs),
  };
}

function eraCeremonyForTransition(previous: Era, next: Era, startedAtMs: number): EraCeremony | null {
  if (previous === "hamlet" && next === "palisade") {
    return { startedAtMs, dismissed: false, targetEra: "palisade" };
  }
  if (previous === "palisade" && next === "stone_town") {
    return { startedAtMs, dismissed: false, targetEra: "stone_town" };
  }
  return null;
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
  const copy = eraCeremonyCopy(input.ceremony.targetEra);
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
      { className: "era-ceremony__banner", "aria-label": copy.ariaLabel },
      createElement("span", { className: "era-ceremony__kicker" }, "새 시대"),
      createElement("h2", null, copy.title),
      createElement("p", null, copy.body),
      createElement("button", { type: "button", onClick: dismiss, "aria-label": copy.dismissLabel }, "닫기"),
    ),
  );
}

function eraCeremonyCopy(targetEra: EraCeremony["targetEra"]): {
  readonly ariaLabel: string;
  readonly title: string;
  readonly body: string;
  readonly dismissLabel: string;
} {
  switch (targetEra) {
    case "palisade":
      return {
        ariaLabel: "Palisade age ceremony",
        title: "목책마을 선포",
        body: "성문이 열리고 집들이 새 목재를 두릅니다",
        dismissLabel: "Dismiss palisade ceremony",
      };
    case "stone_town":
      return {
        ariaLabel: "Stone Town ceremony",
        title: "석조 도시 선포",
        body: "석재가 목책을 대신하고 집들이 돌빛으로 바뀝니다",
        dismissLabel: "Dismiss Stone Town ceremony",
      };
    default:
      return assertNever(targetEra);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled era ceremony target: ${JSON.stringify(value)}`);
}
