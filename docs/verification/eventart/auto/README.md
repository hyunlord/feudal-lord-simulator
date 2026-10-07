# EVA-AUTO: each live event picture drawn by the real card

Written by `npm run eventart:auto` (scripts/eventArtAuto.ts; the browser half is scripts/eventArtAutoCapture.mjs, on the DGX).
Run it after the registry's live set changes (an event turned on or off, a mod's event added); commit what it changes.

- `captures.json`: the registry's live entries, the pictures the build ships for them, and per picture whether the card drew it
  (the card and its picture element name the id, the page got this build's derivative bytes, decoded, luminance spread over the
  drawn box ≥ the floor) or why not. No times in it: the same tree gives the same file.
- `shot-*.jpg`: four whole-view captures (1280 × 800) of the card, the first, the last and two between; not one per event.
- Only the pictures drawn get their provenance row (docs/provenance/assets.csv), prompt file and the inbox ledger's
  installed_by = EVENT-ART. An entry no longer live keeps its row as `retired` and loses the mark.
- tests/eventArtAuto.test.ts holds the tree to the relation (every live entry drawn or a stated reason; every shipped picture a
  live entry's) and names this command when it breaks.
