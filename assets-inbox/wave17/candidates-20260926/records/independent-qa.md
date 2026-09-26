# Wave17 independent static-art QA

Status: PASS_WITH_LIMITS for full candidate static-art visual scope. No asset edits, no game installation, no runtime claim.

## Evidence inspected
- delivery/proofs/01_workers_convoy.png; delivery/proofs/02_coastal_raid.png
- world-halfscale.png (requested rootworld-halfscale.png does not exist; actual file used)
- props-contact.png; worker-contact.png; world-contact.png
- worker-overlap.csv; worker_prop_attachments.csv; template-audit.md; convoy assembly and invariant records
- Independently recomputed pixels: independent-worker-pixel-audit.json and independent-convoy-pixel-audit.json.

## Verified
- Six 296x148 workers, 4 directions x2 frames =48 cells. CSV has48 rows. Independent comparison to normalized P1/P4/P5 gives zero alpha differences and zero protected lower10px foot RGBA differences in all48. Exact alpha establishes zero displacement of silhouette/head bounds; visual comparison preserves poses. Billman helmet RGB recolor is intentional, not head translation.
- Separate longbow/bill attachment rows total16; all world_scale=2. Equipped proof shows tall weapons attached to fixed template hands, without new body poses. No full plate or gun silhouette seen.
- Four ox directions/two phases: independent mask comparisons yield zero changed protected head/body/tail pixels. Changes outside mask per direction687/575/492/578. Cargo frame halves exactly RGBA-identical. Existing cart wheel-frame differences are preserved; do not claim the entire cart sheet is frame-identical.
- Convoy directions are visually coherent and load/flag sits inside carts. At game zoom1.0 and0.6 convoy remains recognizable; heraldic lion anatomy does not survive this scale.
- Beacon flame, quay fire, smoke and trampled ground communicate successive raid stages. Muted palette, no gore or exaggerated human suffering. Warehouse has no chimney. No obvious world-registration mismatch in shown scene.

## Residual limits / material cautions
- Longbow string and bill hook are very fine: supplied equipped-size view supports role identification jointly with clothing; no claim that bow vs bill detail is independently readable at game0.6.
- Refugee woman+child+bundle reads as a traveling family; exact hand-holding contact is not demonstrated for every view.
- Convoy driver is a separate scaled source reference (not newly delivered animation); NE/NW proof driver is visibly offset to the side/front. This is an assembly preview, not runtime path following or gait synchronization proof.
- Worker comparison proves alpha and protected feet invariants, not every RGB body pixel unchanged; reskin changes clothing and permitted helmet color.
- Wall strip repetition/engine footprint, smoke temporal smoothness, collision, layering under camera movement and actual integration remain untested.
- Historical notes are provenance guidance; this visual audit did not independently authenticate all heraldry or historical source claims.
- Final illustration and count review completed below.

## Final illustration review
- Inspected final03_illustrations_cards.png containing all22 final scenes in supplied Wave16 frames. Compared supplied Wave16 loading/style collage and title key art directly.
- Opened full-size event/coastal_raid960x540, event/royal_messenger_arrival960x540, decision/refugee_admission640x480, chronicle/raid384x384, chapter2_end1920x1080.
- Independently enumerated57 asset PNGs and3 proof PNGs. All22 illustration dimensions match8event960x540 +5decision640x480 +8chronicle384x384 +1chapter1920x1080.
- All requested subjects are represented in the22-card proof: warning, raid, departure, labor gap, aftermath, messenger, charter, wool edict; five decisions; eight chronicle scenes; walled coastal-town evening transition.
- Warm painted earth palette, timber/stone architecture, vegetation and sea setting follow provided Wave16 direction. New images are somewhat more highly textured/detailed than references but remain coherent as narrative card art.
- No visible full plate armor, guns, exaggerated gore, contemporary equipment, readable invented text or obvious detached foreground anatomy in inspected samples. Soldiers use padded coats and simple helmets. No conspicuous house chimney/flue in proof or full-size samples. No obvious later structured women's hood spotted.
- Corrected messenger/chapter royal heraldry reads gold lions on red without quartering. Chronicle raid's blue fleur-de-lis banner belongs to the attacking ship and is not misidentified as English royal arms. This is a visual consistency check, not exhaustive heraldic authentication.
- No new blocking visual issue found. Full-pack static-art verdict PASS_WITH_LIMITS.
- Limits: all22 viewed in contact proof, only representative5 opened individually at full output size; miniature background figures and every distant roof are not individually authenticated. Historical-document claims, ZIP integrity, CSV completeness, collision and engine animation remain outside this final visual audit.

## Correction: roof review reopened
The prior full-pack PASS and no-conspicuous-chimney statement are withdrawn. Root chapter-roofs-qa.png clearly shows house chimney stacks at crop-local(101,105),(111,72),(196,138),(266,142). Full pack FAIL_PENDING_ROOF_CORRECTION; all other21 illustration roofs being rechecked at enlargement. Contact proof was insufficient evidence for distant rooftop exclusions.

### Enlarged roof audit findings (all21 nonchapter top60% examined at2x)
All coordinates below are final-image native x,y,w,h approximate regions, not enlarged-preview coordinates. Crops in records/roof-review preserve pre-correction evidence.
- event/raid_aftermath:181,59,16,32 (stone shaft/two red pots)
- event/empty_workshop:637,122,12,16 and691,124,13,23
- event/royal_messenger_arrival:499,70,9,16 and561,93,10,18
- event/stonewall_charter:44,60,11,17;98,75,7,13;261,72,8,13;387,63,8,15;411,63,9,15;450,66,8,17
- event/wool_levy_edict:426,117,10,16
- decision/wall_or_market:247,122,10,16;199,90,8,13;373,92,10,12;364,118,8,16
- decision/war_funding:182,65,9,12
- decision/wool_payment:276,58,8,13
- decision/refugee_admission:65,87,7,11 and91,89,8,16 (confirmed in6x detail)
- chronicle/purveyance_licence:144,56,8,11 and195,64,7,10
- chronicle/messenger:173,81,7,13 (confirmed in6x detail)
No additional clear chimney was identified in other10 images at2x roof inspection; this is observational, not a guarantee about subpixel distant background details.
Latest chapter2_end correction opened full1920x1080: earlier specified stacks removed, no new clear house chimney spotted. Chapter-specific correction passes; other11 scenes above remain correction/recheck obligations. Root and illustrations agent informed directly.

## Revised roof audit — residual blocker
Current repaired native PNGs checked via 2× enlarged roof crops (source timestamps 2026-09-26 02:41:50–51 UTC): royal messenger, charter, wool edict, raid aftermath, war funding, wool payment, refugee admission, purveyance licence, messenger and final wall-or-market removed the previously confirmed chimney stacks. Empty workshop still retains the left red-brown shaft at native (637,122,12,16); diagnostic crop `roof-review/empty-remaining.png` is native (625,110,45,45) enlarged 10×. Right empty-workshop shaft has gone. Full-pack verdict remains FAIL_PENDING_ROOF_CORRECTION until this last confirmed item is independently checked after repair.

## Final corrected state — PASS_WITH_LIMITS
The last empty-workshop correction was independently reopened at full 960×540 size and in the native (625,110,45,45) region enlarged 10× (`final-workshop-roof.png`). The previously confirmed red-brown vertical shaft and dark cap at (637,122,12,16) are now replaced by foliage; no clear house chimney remains in that region. Source PNG timestamp: 2026-09-26 11:46:32 KST. Current proof03 (11:46:55 KST) reopened and all 22 illustrations confirmed visible. All 12 repaired scenes have now been independently rechecked; known roof blockers and pending list are empty. Earlier fail and initial mistaken pass remain recorded above as audit history, superseded by this final state.

Final scope/full-pack verdict: PASS_WITH_LIMITS for candidate static art. This is a visual acceptance of the inspected images, not exhaustive historical authentication or game runtime/integration testing. Fine weapon details at zoom 0.6, preview-only driver positioning, animation/wall runtime, and ZIP/metadata integrity retain the stated scope limits. No asset PNG was modified by this reviewer.
