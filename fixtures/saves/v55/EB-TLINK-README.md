# EB-TLINK provisional save fixture

Prepared unit/fingerprint fixture, not natural-play evidence. Schema 55 is isolated and collides with GROW's v55; engine integration must combine/renumber the migration and fixture before adoption.

Source: `fixtures/saves/v49/chapter-two-town.save.json` (SHA256 `41a215eb2e1ab1372340b2140a7ee176f5125dc698f46e5ee660b55a858b5b4b`), decoded through current migrations. Install `initialAgency()`, then run the real `set_market_dues(1200)` reducer command. Prepare a home pannage petition (`tlink-fixture-pannage`, amount20, open, at existing tick77500, deadline78500) under `EMPTY_STEWARDSHIP`, then run real `answer_estate_petition(grant=true, displayEntryId=home:pannage)`. No tick advance was used to create the fixture.

The two own answer records and commons memory evidence are reducer outputs. Original source/choice remain unchanged. Header timestamps are fixed `2026-10-10T00:00:00Z`. SHA256 of `eb-tlink-own-answer.save.json`: `177a8cecc5b260be83e61b8a24dd6c3874b425b52cdc0b9693502e2ec62031c8`.

The standard fingerprint tool subsequently advances fixtures300 ticks, as for its existing fixture set. It now samples the required nested memory fields instead of only an empty array.
