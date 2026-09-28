import { useEffect, useState } from "react";
import { presentationPreference, setPresentationPreference, subscribePresentationPreferences, type PresentationPreference } from "./presentationPreferences";
import { PRESENTATION_PREFERENCE_COPY } from "./presentationPreferenceCopy.ko";
import { Button } from "../ui/kit";

/** UI-7b: a preference's value, kept current (for a screen that shows or hides on it). */
export function usePresentationPreference(preference: PresentationPreference): boolean {
  const [enabled, setEnabled] = useState(() => presentationPreference(preference));
  useEffect(() => subscribePresentationPreferences(() => setEnabled(presentationPreference(preference))), [preference]);
  return enabled;
}

/** A pause-menu switch for one presentation preference. */
export function PresentationToggle({ preference }: { readonly preference: PresentationPreference }) {
  const [enabled, setEnabled] = useState(() => presentationPreference(preference));
  useEffect(() => subscribePresentationPreferences(() => setEnabled(presentationPreference(preference))), [preference]);
  return (
    <Button className="autoplay-toggle" type="button" aria-pressed={enabled} data-preference={preference}
      onPress={() => setPresentationPreference(preference, !enabled)} variant="toggle">
      {enabled ? PRESENTATION_PREFERENCE_COPY[preference].on : PRESENTATION_PREFERENCE_COPY[preference].off}
    </Button>
  );
}
