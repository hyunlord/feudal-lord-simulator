# Route cache scenario fixture

`seed1-24lot-final-state.json.gz` is an exact gzip copy of
`/tmp/feudal-a4-final-fb8956fd7639/seed1/final-state.json`, the natural
seed-1 final state recorded in A⁗ validation at tick 679251. The uncompressed
JSON SHA-256 is `46e9f6af71d380b741be05ef8f44f00ab6079281dc8a2cd721f7d5dedcfcd71c`.
It contains 24 residential lots, 768 residents, and 219 route cache entries.

The B8 176-resident fixture was not present in the available worktree. T9 uses
this unedited natural 24-lot state and compares the game state excluding the
derived route cache after 24,000 ticks with the original cache retained versus
cleared at the start.
