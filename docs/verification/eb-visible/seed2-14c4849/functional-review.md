# EB seed2 visible functional review

Scope: read-only validation of `.remote-runs/render-EB-seed2-visible-14c4849/eb-visible-seed2/results.json`, `source-manifest.json`, and PNG artifacts for the eight seed2 paused-browser cases: `ck_evt_083`, `ck_evt_046`, `ck_evt_209`, and `ck_evt_204`. No simulation or source change was run.

## Provenance and artifact integrity

- Browser source revision: `14c4849d4e0cc2efde48abdfa99edb4f44e94910`; `dirtyPaths` is ``.
- Checkpoint source revision: `2485af40046793f1856829fa1161dc4431942aa7`.
- Results manifest SHA: `766a84d5db46f5a91777f885f11c0a249b3e84aec3169635216201efb1b3553e`; actual `source-manifest.json` SHA-256 is `766a84d5db46f5a91777f885f11c0a249b3e84aec3169635216201efb1b3553e`. They match.
- Checkpoint directory recorded by results: `/home/hyunlord/fls-runs/_kept/engineB-weight125-kept-clean-2485af4/.remote/eb-weight-kept/checkpoints/seed-2`.
- Viewport: `1280x800`.
- Screenshot references: 40 panel screenshots, 40 unique; all referenced PNGs exist. Total PNG files in the directory: 40. All inspected PNG headers report `1280x800`.

## Functional table

| case | status | loaded→final tick | decision found | chip target | forward link | back link | panels | errors | presentation drift |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- |
| `ck_evt_083-answer` | `paired` | `51013`→`51013` (`tickUnchanged=True`) | True | absent | False | None | 3 | 0 | none |
| `ck_evt_083-consequence` | `paired` | `52800`→`52800` (`tickUnchanged=True`) | True | right | True | True | 6 | 0 | none |
| `ck_evt_046-answer` | `mature_without_observed_future_link` | `98047`→`98047` (`tickUnchanged=True`) | True | wrong/generic | False | None | 5 | 0 | none |
| `ck_evt_046-final-no-pair` | `mature_without_observed_future_link` | `500000`→`500000` (`tickUnchanged=True`) | True | wrong/generic | False | None | 5 | 0 | none |
| `ck_evt_209-answer` | `mature_without_observed_future_link` | `103039`→`103039` (`tickUnchanged=True`) | True | right | False | None | 5 | 0 | none |
| `ck_evt_209-final-no-pair` | `mature_without_observed_future_link` | `500000`→`500000` (`tickUnchanged=True`) | True | wrong/generic | False | None | 5 | 0 | none |
| `ck_evt_204-answer` | `paired` | `326041`→`326041` (`tickUnchanged=True`) | True | wrong/generic | False | None | 5 | 0 | none |
| `ck_evt_204-consequence` | `paired` | `326400`→`326400` (`tickUnchanged=True`) | True | wrong/generic | True | True | 6 | 0 | none |

## Findings

- All eight cases kept the loaded tick unchanged through capture and have `initialHistoryTraceExact=true` plus `finalHistoryTraceExact=true`. The harness therefore did not advance the simulation during these captures.
- All eight cases located the requested decision via manual history navigation, and all have zero recorded errors.
- Automatic year review cards were absent in all eight cases (`automaticYearReview=false` and `.results-card.year-review` not shown). This capture does not prove first-season automatic year-review visibility.
- Presentation state is stable for all eight cases (`initialPresentationStateExact=true`, `finalPresentationStateExact=true`, and `presentationUnchangedDuringCapture=true`). `initialStateExact=false` appears on all cases under the stated presentation contract: the proof port returns a `withResidentWalkers` presentation state while the raw save remains the unchanged input. I did not count that as presentation drift.
- Exact forward/back trace navigation passes only for paired consequence cases: `ck_evt_083-consequence` and `ck_evt_204-consequence` have `exactConsequenceLinkShown=true` and `exactCauseBackLinkShown=true`. Their source-manifest consequences are `because` rows with `part: true`, so they prove causal contribution links, not sole/main-cause proof.
- `ck_evt_083-consequence` is the cleanest automatic-chip case: `chipMatchesExpectedDecision=true`, exact forward and back links pass, and the visible future receipt is next season (`51013` answer to `52800` consequence).
- `ck_evt_204-consequence` has exact manual forward/back trace links, but the automatic chip target is wrong/generic (`chipMatchesExpectedDecision=false`): the chip shown is for another steward-handled estate petition, while the manual decision detail and because panel target the requested `ck_evt_204` decision. Its consequence is same season (`326041` answer to `326400` consequence).
- `ck_evt_046` has no observed future DEC-TRACE pair (`mature_without_observed_future_link`) in both answer and final cases. The requested decision is locatable manually, but the automatic chips are wrong/generic and point to other later/nearby decision-trace stories. The decision detail’s “그 뒤에 일어난 일” remains blank.
- `ck_evt_209-answer` has a correct automatic chip for the requested decision and shows an immediate visible remembered relation effect in the decision detail (`농민 공동체`, relation `−2`), but it has no future DEC-TRACE consequence link. `ck_evt_209-final-no-pair` manually locates the same decision and same immediate effect, while the final-save automatic chip is wrong/generic and points to a later 1424 market decision.
- Visual spot-checks were limited to `ck_evt_083-consequence-decision.png`, `ck_evt_204-consequence-because.png`, `ck_evt_046-final-no-pair-decision.png`, and `ck_evt_209-final-no-pair-decision.png`. Those screenshots are readable at 1280x800. `ck_evt_046` and `ck_evt_209` final decision cards show some Korean choice text wrapping/splitting in narrow columns; this is a presentation limitation, not a functional navigation failure.

## Screenshot artifact hashes

| file | dimensions | bytes | sha256 |
| --- | --- | ---: | --- |
| `ck_evt_046-answer-chip-history.png` | 1280x800 | 645284 | `aed8a82d269c9d04336410830ed31038a176642f9dddbc0ace8ce7daced217e7` |
| `ck_evt_046-answer-chip.png` | 1280x800 | 1476726 | `c993b21200dccd78be065493a37910e68c4051947c36b1d211b80b2595523cea` |
| `ck_evt_046-answer-decision.png` | 1280x800 | 601890 | `0b43ec2d8e3f1b507a1d556e6e45e3b00dc7f58653bc9deef7e807c02cae87c9` |
| `ck_evt_046-answer-initial.png` | 1280x800 | 1515477 | `b9653cb1cf6aa53ea6b65464ec2fe8ff16a9f6da94273942663f68fc44319258` |
| `ck_evt_046-answer-year.png` | 1280x800 | 1514407 | `e994e9be16c8ed11ff5d2990b7d59c2ed51608e07b16d6b18526e1735d7a7672` |
| `ck_evt_046-final-no-pair-chip-history.png` | 1280x800 | 625619 | `a2af7067bb47d8d08b5a2027f656ad668db96983f51400c60f492d513c6093c4` |
| `ck_evt_046-final-no-pair-chip.png` | 1280x800 | 1882864 | `3ad8515c02fee0c8747ee5bd0e60644305348606412dad47b46bcf7bc1bcd1cc` |
| `ck_evt_046-final-no-pair-decision.png` | 1280x800 | 598742 | `bc9c60545dfc5c474a61dd6c8ff503f2671a609a470b7f411a585cc463e06877` |
| `ck_evt_046-final-no-pair-initial.png` | 1280x800 | 1994982 | `13ee03f5263b2a4f5ef0be6eb657c1b1469fd1a52edcd21d0632dfe8d1ce1c85` |
| `ck_evt_046-final-no-pair-year.png` | 1280x800 | 1995382 | `adf8c787f02878c23796113ccf0cff937095f2fa3397f5fc0edb02601208de29` |
| `ck_evt_083-answer-decision.png` | 1280x800 | 616018 | `6f877b9192cecf5ce343769e28b32534d177c8377ad519fb261abfb06f4aa402` |
| `ck_evt_083-answer-initial.png` | 1280x800 | 1658032 | `993e7705d0c63aa91a06cf39fec4b7541159beed114cfab3c97879bc79fd55e5` |
| `ck_evt_083-answer-year.png` | 1280x800 | 1674119 | `096a6319235e2e1b99c1575c91a37341894a34f9e73287378f33b3db41dc5fec` |
| `ck_evt_083-consequence-because.png` | 1280x800 | 550873 | `d9457246c3c58782016fb752abf44caa98a71e58b149c1b50858f56e65e1e6d1` |
| `ck_evt_083-consequence-chip-history.png` | 1280x800 | 625673 | `16f5bc78b5d8902f2441d7a2de87a7ec13a3f90b35b44de94c6abe9b44bd1264` |
| `ck_evt_083-consequence-chip.png` | 1280x800 | 1886582 | `00c569847bf1294f1062bc6621f64a6b7c2de29779cb581c8948b2a1370d8257` |
| `ck_evt_083-consequence-decision.png` | 1280x800 | 593824 | `30d0cd2450d732d6f1255ad07df43d06a2416821a04c4c30d394f9ceb786fe6e` |
| `ck_evt_083-consequence-initial.png` | 1280x800 | 1966392 | `3b5ff2b6a6dcd37f2728dcc4f1c3cc4dcc957226a0985172141f88b56ac05082` |
| `ck_evt_083-consequence-year.png` | 1280x800 | 1968761 | `e0ab63dba529c545da4bae6464a51a60d979842051735de7558d5a182f99cf72` |
| `ck_evt_204-answer-chip-history.png` | 1280x800 | 622050 | `25a19d178d9bdda50a0fdb8a072c01f423e8713084b48d9be1d4007020b97601` |
| `ck_evt_204-answer-chip.png` | 1280x800 | 1508015 | `ac2b0f5335d81bae922e2b6e43aae54f17723cf98e8dd45e78fa5af4b8fb3151` |
| `ck_evt_204-answer-decision.png` | 1280x800 | 618230 | `3f6e25c51b05850c57b517a29888e0cd254b66ac853693a99e3abe50a275022a` |
| `ck_evt_204-answer-initial.png` | 1280x800 | 1634661 | `5995394d99a0cfeca6baf9679093afe89274ac9df1287b3c5a312d67a8dc8417` |
| `ck_evt_204-answer-year.png` | 1280x800 | 1634832 | `7efb4d649256930eaa5e7bd2244927c4beb00b5ac1dedfd99f9ea024e39b6292` |
| `ck_evt_204-consequence-because.png` | 1280x800 | 581943 | `a652ada2282827111221cc38624d7b6eb42fffcfead9a521402672e0db992887` |
| `ck_evt_204-consequence-chip-history.png` | 1280x800 | 618151 | `91c0f21bcc099f98ea76c5d049392f4472a47ef82329ecc16ad7a86528ab9d8c` |
| `ck_evt_204-consequence-chip.png` | 1280x800 | 1528874 | `3e3f08f6888dd6d3673b2c9bb047b1e1db0c17f4abbc55542969735dc19c8119` |
| `ck_evt_204-consequence-decision.png` | 1280x800 | 631223 | `8befbd9ed953ba3f358ddbdc74e1ff583fed99d798a50fbdab4557f5fa69bff2` |
| `ck_evt_204-consequence-initial.png` | 1280x800 | 1643024 | `a28c6a4ca1a6fe79ff4ac6e26639af12e20d16b3e7b4afc47f563692359c927f` |
| `ck_evt_204-consequence-year.png` | 1280x800 | 1642231 | `d75fb495a77dc31c1b62b085952d6ee9e06e0ce83230b8ad88f5b84d29980119` |
| `ck_evt_209-answer-chip-history.png` | 1280x800 | 629805 | `b31c825b13a61d89695a39f4b8d2e2719b862afc4642b3a6105c31f3c643e18f` |
| `ck_evt_209-answer-chip.png` | 1280x800 | 1472556 | `9ac2a59a39614ee14ac89cca5aa3618eac047a16bbe449939446bc039b9899e2` |
| `ck_evt_209-answer-decision.png` | 1280x800 | 621881 | `36a6e2c009b194ad7bb9b00853478b66254e2165c85183fb66267421ffd0c1c8` |
| `ck_evt_209-answer-initial.png` | 1280x800 | 1562010 | `3eda1b51836387115cebb9f23714dd3b40e43cc283f7045af4daaf8411d8ba93` |
| `ck_evt_209-answer-year.png` | 1280x800 | 1561759 | `ef9f451fb11f58834b7696c2eef12afaadcde8ae7b3cb5230c900bca574d39d0` |
| `ck_evt_209-final-no-pair-chip-history.png` | 1280x800 | 625619 | `a2af7067bb47d8d08b5a2027f656ad668db96983f51400c60f492d513c6093c4` |
| `ck_evt_209-final-no-pair-chip.png` | 1280x800 | 1882050 | `d940ef2b00c0f27181122fc79e87b820ba3567d042237b8759369e58c4ee322e` |
| `ck_evt_209-final-no-pair-decision.png` | 1280x800 | 605123 | `f97d25c6f30b870f21e1e3494fa7fa063c394e122ce27ede9d404f0238b2fdf4` |
| `ck_evt_209-final-no-pair-initial.png` | 1280x800 | 1994985 | `616f7ece3d5ab03f72509d8b00c9577a2098b804b52d5a401619d85c5ae31b71` |
| `ck_evt_209-final-no-pair-year.png` | 1280x800 | 1996010 | `0f08a8ef9c70240a0eb199e66fe2631966e810e3f05a7d99540411c3afe2b5a8` |

