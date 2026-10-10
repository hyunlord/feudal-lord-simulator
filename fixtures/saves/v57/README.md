# EB answer effects provisional v57

`eb-answer-effects.save.json` is prepared by decoding the committed v49 chapter-two fixture and applying real `gameReducer` commands: market dues 1200, estate policy revenue, exception rules `{rights:false, marriage:false, amountAtLeast:null}`. It is a deterministic reducer fixture, not a naturally observed campaign. Dates are fixed to 2026-10-10T00:00:00Z.

This isolated TRACE-LINK prototype v57 stores optional answer-time effects. Migration does not populate old answers. Engine integration chooses the final version; EB-INERT also provisionally uses v57 and must be reconciled, not blindly cherry-picked.
