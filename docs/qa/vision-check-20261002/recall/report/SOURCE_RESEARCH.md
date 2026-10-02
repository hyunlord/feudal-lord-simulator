# Recall benchmark source audit (read-only)

Repo inspected: /Users/rexxa/fls-astra-vision, pinned3e3192c56ba62f172d965d9b0840d9c0e1928f22. No game source edits. One graft ask returned empty (savings unavailable); direct files and read-only GitHub API used afterward.

## Exact historical revisions

- NAT-1 baseline named in upstream docs/verification/nat1/REPORT.md: **4a30c717486bc650684ce9fd21c5d0cef1d71ff9** (API confirms Merge trunk SMOOTH-1 into UI-9b). Suitable documented before revision.
- NAT-1 occlusion implementation **97dbcfeff44c7d1da793c8446a91d2743eae2183**, immediate parent **ce941ebeb3e567f498f2709e5989d08f39f6d370**. Retrieved commits API for path src/render/walkerOcclusion.ts. Parent is exact pre-fix checkout for walker roofs, while4a30c717 is original comparison baseline.
- User specified NAT-2 before: **653af2e29bd7ebd51b061fb70c97c81c300a8b12**. API confirms merge into claude/smooth2r. Upstream docs/verification/nat2/REPORT.md §1 explicitly uses this revision for old LOD comparison, §4b for season comparison.
- NAT-2 crowd fix **3940693939b985308b8886ccf1dd1fa9ddce299b**, parent **9db4fc2dc58fd1f3ed099f4c8a40ed993fc45521**; message explains static alehouse crowd and roof occlusion.
- Round01 inspected HEAD **4ad2d2a444d7d0e3dbbcdb112f55f942dc1f331c**: docs/qa/round01/repro/source-manifest.json:2. This is QA observation revision, not automatically preNAT1.
- Round02 HEAD **d5b3f88aa3003834437cb559c361e1c77d8ef541**: docs/qa/round02/repro/checkout.txt:1.
- Round17 **5a15e62d4f36f37f36cf7ef854b3677337482d61**: docs/qa/round17/PROVENANCE.json:9. srcTree588384e3bf143529c909cde0d0c5f5a9743be9d6, publicTree3efc5a5984c961c37af8cf434f3fa3be0e93fe64.

## Required positives

| Case | Load and camera | Evidence and truth |
|---|---|---|
| QA005 original four points | fixtures/perf-gate/ch4-1380.save.json.gz, byte identical copy docs/qa/round01/repro/saves/ch4-1380.save.json.gz; tick320000 original; initial camera;1600x1100 DPR1. Exact observed zoom/tick explicitly missing in original audit. | docs/qa/round01/FINDINGS.md:22,48,51. Pixel points granary1076,157 /1096,184; house950,348 /968,377. docs/qa/round01/evidence/11-1380-paused-settled.jpg. NAT2 report §3 identifies all four as decorative alehouse patrons, not engine walkers. Therefore NAT1-before walker test and originalQA005 must be separately named, even though both overlap detector targets. |
| NAT1 roof walkers | Same large fixture or chapter-four-town supported (NAT1 report measured253 whole-town bad ordering pairs before). Camera should deliberately frame visible overlapping walker after ordinaryload; reference capture algorithm scripts/nat1Captures.ts:40–60 picks most faulted walker positions, zoom1.8,1280x800. Original rumour-quiet state outsideallowedfolder, so use ownedfixture and record new camera. | NAT1 report §1 confirms cause all walkers drawn after buildings; code's ordering pairs are not pixel truth by themselves. Need visual instance labels in new screenshot. |
| QA002 static patrons | Same ch4-1380 fixture, initialcamera,1600x1100 DPR1; 1x and5x 10s. scripts/nat2Standing.ts:1–12,24–29; originalQA ROI880,100,330,400 (FINDINGS:48). | NAT2 REPORT §3 confirms24 alehouses each3–4 permanentlystanding patrons;59 of119visiblepeople. Small2px sway is not travel. Before49.5%/50.4%, after0%. Enginewalkers still0! Originalround03–14 remainedunverifiedbecauseIDsnotknown; NAT2 attribution supplies strongerconfirmation. Current detector MUST include decorative human sprites, not only state.walkers. |
| QA008 white distantLOD | Same fixture, center tile(44,32), zoom0.6 then1.0 (scripts/nat2LodProbe.ts:26–30),1600x1100 DPR1, paused. Originalround01approx0.605/0.974/1.427 (FINDINGS:30,54). | docs/qa/round01/evidence/20-1380-zoom0605.jpg; round02/evidence/14-zoom0605-valid.jpg; NAT2 report §1 compare-0.4-0.6-1.0.jpg. Sixoriginaldetectors do notnaturallycoverLODstyle; supplementalstylecoverage shouldbe separate. Upstreamprobeusesproofmodeandmoduleclamprewrite; doNOTexecuteitunderthisusercontract. |
| QA039 chalkdiamond | New normalcampaign chalkmap1,summer t1004, wintert3002,zoom1.332,pan(-97,-1184),centerworld(673,1302),centertile(51,30),lastclick(60,26);1600x1100 DPR1. | docs/qa/round17/FINDINGS.md:12; repro/17-025-chalk-rock-gaps.json:4; repro/17-026-chalk-winter-rock.json; matchingevidenceJPEGs. Large straightdiamondclippedrockface plus repeatedsmallblacksquareoutlines. Nochalking save archived: ordinarynewgameUI progressionrequired. |
| QA040 forestfloor | New normalcampaign forestmap1,summer t1006,wintert3004,zoom1.001,pan(610,-754),centerworld(190,1303),centertile(44,38);1600x1100 DPR1. | docs/qa/round17/FINDINGS.md:13; repro/17-031-forest-edge.json:4; repro/17-032-forest-winter-edge.json; matchingJPEGs. Broadbrownregionformsright-angleplatecutintoemptyground. No forestsavearchived. |

## Additional coverage for six detectors

- **Repetition strong knownpositive:** NAT1 REPORT §2, preNAT1 clothWorldArt.spinningPile draws yarn_skeins_1 by everyL3/L4 spinninghouse. Before100% sameprop, after50%empty andeachvariant<=16.7%; d1 before/after reference; scripts/nat1Captures.ts:69–73 centersmarket,zoom1.3,1280x800. Samech4fixture has24spinninghouses. Door-propdecision NAT1-D2: halfempty,atmosttwoidenticalconsecutiveinrow. This is muchstrongertruth than retrospective genericcountthreshold.
- **Tile-seam/periodic positive candidate only:** docs/qa/round17/CHECKLIST.md:45, emptyground1348autumn t194163,zoom2,pan(544,-2277),leftemptyground. Round03-14/history/09-FINDINGS.md:39, CANDIDATES.md C05 explicitlyaestheticcandidate. References evidence/09-root9-117-autumn-ground.jpg, repro/09-root9-117-autumn-ground.json; repeatediso bands. Do notsilentlypromotecandidate toconfirmedQA. QA039 repeatedblackquads canserve tile-seamvisualpositive iflabelledseparatelyfromouterboundary.
- **Scale knownassetmeasurement:** docs/design/art-audit-20261002/ART_AUDIT.md:163–169 BLD07. L0/L1doors12.490±.999/11.967±.997worldpx vsadult17.6,ratio.710/.680; code/assetmeasurement,notallactualvisiblehumans. Do notapply toWave26. Previousrunvisuallyconfirmedrainbarrels usableindependentmanualtruth ifcurrentrenderretainsproblem.
- **Otherrepetitioncandidate:** docs/qa/round03-14/CANDIDATES.md C09, samewarehouse/granary silhouettes onlycandidate, notwrongassetsconfirmed. repro/12-root12-048-repetition-wide.json t173083,1343summer,zoom.957,pan(678,-802),tile(46,42); matchingJPEG. Useonlyifmanualvisualreviewfreezespositivebeforethresholdtuning.

## Healthy controls / interpretive limits

- QA008 afterNAT2 control documented docs/qa/round03-14/history/03-REGRESSION.md:3,14, HEAD4386ac1a3a44bd99d50e19d54720c9899d45e1e6. Zoom.508/.559/.565/.615/1.199 retains handdrawnart. Samefixture/cameraoncurrentbranch ispairedcontrol afterfreshvisualconfirmation.
- NAT1 afterroofordering and afterdoorprops providepairednegativecontrols, but codeorder0 is notimagelevelTN untilvisuallychecked.
- NAT2 walkingenginepeople are healthynegative examples evenbeforefix; staticpatrons arepositive. Drinking5–8s is intentional,so2s burstalonecannotlabelnormalcurrentpatronsstuck. Capture10s extension,20framesat100ms remainbaselineevidence; motionduration truthmustmatchdetector.
- Explicit exclusions docs/qa/round17/CHECKLIST.md:45 sowingfurrows/fieldboundaries/movingweathershadows; useclearfield/road/lake shoreline negativeROI toexercise falsepositives.
- Healthy means boundedROI/property, notentirecityorallgamequality.
- GeneralfixturesaveSHA2564b3fb4ef1aa1be2e381e4fe572bab295cf8adb9c6fd42002fc19b6e94ad742ff fromround01source-manifest.

## Source retrieval

Read-only GitHub endpoints queried via gh api: commits/653af2e2, commits/4a30c717, commits?path=src/render/walkerOcclusion.ts, contents/docs/verification/nat1/REPORT.md andnat2/REPORT.md withbranchref. docs/verification is sparseexcludedlocally, so nootherworktree touched.
