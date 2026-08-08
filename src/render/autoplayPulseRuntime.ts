import { AUTOPLAY_PULSE_EVENT } from "../ui/autoplayPresentation";
import type { PlacementFeedback } from "./placementFeedback";

type PlacementFeedbackRef = {
  current: PlacementFeedback | null;
};

export function installAutoplayPulseRuntime(feedbackRef: PlacementFeedbackRef): () => void {
  const autoplayPulse = (event: Event) => {
    if (event instanceof CustomEvent) feedbackRef.current = event.detail as PlacementFeedback;
  };
  window.addEventListener(AUTOPLAY_PULSE_EVENT, autoplayPulse);
  return () => window.removeEventListener(AUTOPLAY_PULSE_EVENT, autoplayPulse);
}
