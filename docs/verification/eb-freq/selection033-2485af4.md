# 033: accepted candidate selection loss resolved

**Bounded finding:** seed2 tick1000 is the only accepted033 candidate (count1, first=last1000, four enabled choices). No033 offer occurred in any of the three runs. Source clean2485af4; raw hashes, exact observations and relevant history are in [compressed evidence](selection033-2485af4.json.gz).

Graft first located offerV4Season/offerSeason/v4Candidates; their actual source was then read. The inspected registry/prng/generated-entry files have no committed diff from2485af4. No simulation or state replay was run.

Tick1000 is the first recorded candidate tick, so every accepted group's first tick identifies the complete accepted set at that tick; no earlier first/last interval hides an interior acceptance here. Actual accepted IDs are009,032,033,053, each weight100. Source registry.ts:405–425 sorts by ID and takes one weighted pick. hashSeed(2,'registry-selection',1)=3658414370; modulo400 is370. Intervals are009[0,100),032[100,200),033[200,300),053[300,400). Thus053 wins. This is deterministic arithmetic over measured IDs and unchanged weights, not a regenerated GameState.

The archive independently records exactly one offer at1000: registry:ck_evt_053:suit.evidence|suit-1:1, bound suit-1/claim-1. Its presentation collector first observed it at1000; it later became invalid at1015 with attempted answer history h-000050. Later invalidation does not change who won the1000 selection.

Post-candidate path: registry.ts:409 checks budget BEFORE v4Candidates; :411 sorts, :414 draws, :418 prepares only chapter winner, :425 layers chosen offer. layerOffer:439 may reject a selected heavy offer for crowding; the retained053 offer proves this winner survived. No postcandidate dedup/target conflict filter removes033. v4Candidates:454–461 performs dedup/new-context/choice tests BEFORE marking033 accepted. The exclusive-group/target filter at registry.ts:382 is the separate legacy seasonDraw path, not this v4 weighted selection.

**Category:** within the user's cooldown/conflict family, classify this one missed accepted opportunity as **weighted competition for the single seasonal offer slot**. It is not a cooldown, semantic-dedup or proven shared-target ownership exclusion. Actual competitor and winner are established;033's bound target was not archived, so do not claim it shared suit-1.

This removes the specific seed2 accepted-but-unoffered uncertainty. It does not explain the original56ee1d9 historical absence or the predicate subcauses of the other binding-rejected calls. Seeds1/3 have no accepted033 observations. No adapter defect or missing producer follows.
