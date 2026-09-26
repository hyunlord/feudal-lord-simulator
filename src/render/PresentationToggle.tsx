import { useEffect, useState } from "react";
import { presentationPreference, setPresentationPreference, subscribePresentationPreferences, type PresentationPreference } from "./presentationPreferences";
import { PRESENTATION_PREFERENCE_COPY } from "./presentationPreferenceCopy.ko";

/** A pause-menu switch for one presentation preference. */
export function PresentationToggle({ preference }: { readonly preference: PresentationPreference }) {
  const [enabled, setEnabled] = useState(() => presentationPreference(preference));
  useEffect(() => subscribePresentationPreferences(() => setEnabled(presentationPreference(preference))), [preference]);
  return (
    <button className="autoplay-toggle" type="button" aria-pressed={enabled} data-preference={preference}
      onClick={() => setPresentationPreference(preference, !enabled)}>
      {enabled ? PRESENTATION_PREFERENCE_COPY[preference].on : PRESENTATION_PREFERENCE_COPY[preference].off}
    </button>
  );
}
