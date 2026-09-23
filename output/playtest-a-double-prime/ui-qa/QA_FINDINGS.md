# A double-prime UI QA

Source hashes covered in this evidence set:

- Original bounded A″ pass: requested `303dcff` evidence retained.
- Follow-up current product HEAD: `689bda7`.
- Follow-up construction-access fixture: `10813cb`.
- Matched right-top-panel baseline: `dc49d0e` isolated `/tmp` worktree, production preview on 4176.

This report distinguishes unchanged actual UI evidence from **LABELED prepared UI fixtures/harnesses**. Fixture evidence was produced either through browser response interception on production preview 4175 or through an explicitly labeled independent Vite browser harness on 4176. Fixture/harness evidence is UI QA only and is not natural play.

Unchanged actual production UI evidence still passes: first screen and 1280×720 layout, merged goal/fixed warning slot, market/coin detail without market, house promotion remaining text, access/problem overlay control, and 5× tick/frame measurement.

Corrected and follow-up results:

- Stage3 seed1 wall proposal at `689bda7`: PASS as a labeled fixture. Screenshot `s16-current-stage3-seed1-wall47-fixture.jpg` is a 1280×960 fixture capture with the welcome dismissed, the goal/development panel open and scrolled to the era console, the draft active, the dashed wall outline visible, and the proposal text `둘레 47칸 · 목재 705 · 공사 12구간 · 일꾼 1440틱`. DOM evidence records PredictionLine text `길이 47칸 · 공사 12구간 · 목재 705 · 인력 1440일꾼틱`.
- Baseline/current right-top panel comparison: PASS. At matched 1280×720, baseline `dc49d0e` right rail bbox is `x=932 y=106 w=336 h=230.890625`, current `689bda7` is `x=932 y=106 w=336 h=195.390625`. Right-rail covered canvas area changed `77579.25 -> 65651.25` px² (`-15.38%`). Before/after JPEGs are `s17` and `s18`.
- Selected unaffordable tool shortfall: PASS in labeled fixture. Earlier natural opening category had no disabled tools, so the old FAIL was too broad.
- House promotion remaining: PASS in unchanged actual artifact; `house-diagnosis.json` shows `다음: L1`, `승급 대기`, and `0:03 남음`.
- Wall priority buttons: PASS in labeled fixture; balanced/priority buttons are 44 px high and toggle pressed state.
- Full-store diagnosis: PASS in labeled fixture; facility inspector shows `원인: 곡창 가득 참 (100/100)`.
- Construction access suggested route: PASS in labeled fixture/model evidence; selected construction card shows `도로 미연결`, and model check records suggested road `50,41 -> 50,44`.
- Finance detail market-present contrast: PASS as optional labeled fixture. Existing `s04` remains actual market-absent opening evidence; `s19` is a fixture with `marketCount: 1` and text `시장 판매 0 · 남는 물자와 시장 일손을 확인하세요`.
- A″-6 sampled-warning/current-recovered hotfix: PASS in labeled independent browser harness on 4176. The before old-wiring emulation panel visibly contains both `식량이 부족합니다` and `기초 운영 완료`; the after hotfix panel keeps `식량이 부족합니다` visible and has no open-goal onboarding copy. The victory guard panel also has no onboarding section. Evidence: `s24-hotfix-sampled-warning-before-after-harness.jpg`, `hotfix-sampled-warning-browser-qa.json`.
- Actual fresh 1× first L2/L3 timing: PASS. Fresh production-preview UI run on `689bda7` used mouse/keyboard through the visible build menu only: 제재소 `(45,40)`, 방앗간 `(48,40)`, 길 `(51,41)`, 밀밭 `(51,39)`, then selected the opening house and clicked `1배속`. `phase10-proof` was used only for tile coordinate targeting, observation, and screenshots; no state injection or autoplay. First directly observed L2 was `150.291s` / tick `3006` (`s22`); first directly observed L3 was `571.101s` / tick `11423` (`s23`).

- Construction access stocked-source route at `10813cb`: PASS as a labeled fixture. The prepared state placed a nearer empty storehouse at `(4,1)` and a farther stocked source at `(1,1)`. After a real Chrome tap on the well construction site `(5,5)`, the selected construction diagnostic card remained visible, and the canvas showed the dashed suggested road. Browser/model evidence records `suggestedRoad[0] = {"tx":2,"ty":3}`, `routeStartsAtStockedSourceRoad=true`, and `routeDoesNotStartAtEmptyStoreRoad=true`. Evidence: `s25-fixture-stocked-source-route-selected.jpg`, `stocked-source-construction-route-fixture.json`.

Matrix totals after this follow-up: 16 surface rows = 16 PASS; 9 adversarial rows = 9 PASS. See `manualQa.json` for exact invocations and artifact refs.
