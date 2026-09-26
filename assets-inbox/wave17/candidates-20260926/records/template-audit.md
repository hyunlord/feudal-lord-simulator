# Wave17 template audit

Read-only inspection; convoy scope subsequently authorized separately. No game installation.

## Pilot2
Archive `/tmp/astra-walker-pilot2-candidates-20260925.zip` contains authoritative normalization records and normalized base templates. Archive root `astra-walker-pilot2-v1/`.
Use `templates/P4.png` male, `templates/P5.png` female, `templates/P1.png` merchant (296x148), with 592x296 masters. Columns NE, SE, SW, NW; rows frame0, frame1. Whole sheet source ->592x296 ->296x148; no cell recentering. Source male294x147, female312x156, merchant285x142. Guard source290x145 can use same whole-sheet normalization but is not an original Pilot2 template.

Supplemental `wk_pilot_P1-v1.png` and P5 are Pilot1 rejected free-generation candidates, not the Pilot2 base templates. Attached DIRECTION_CONSISTENCY.md explains failures and its (37,67) pivot applies to the older Pilot1 registration, not all later templates.

No authoritative hand landmarks found for current guard or male. Existing Wave9 accessory_registration.json contains per-cell hand approximations for specific accessory attachments, not a universal hand pivot. Preserve existing hand pixels and measure against normalized baseline.

P4 local alpha>20 bboxes (right,bottom exclusive), directions NE/SE/SW/NW:
- frame0: (31,2,62,68), (21,3,51,69), (22,3,52,68), (12,2,43,68)
- frame1: (30,1,62,68), (22,1,53,68), (21,2,53,68), (12,2,43,68)
P5:
- frame0: (25,5,54,67), (23,5,51,68), (25,6,52,68), (20,5,49,67)
- frame1: (29,4,54,66), (24,2,52,65), (22,3,50,65), (21,4,46,66)
These give head-top/foot-bottom bounds, not anatomical centers. Head and foot displacements must use consistent alpha thresholds and template ROIs; bbox extrema are not enough to prove pose.

## Wave13 cart and animal
Extracted archive to `/tmp/astra-wave17-work-20260926/supplemental-wave13-candidates/astra-wave13-candidates-v1`.
- `assets/cart/ox_cart_body-v1.png`: 512x192, 4x2, cell128x96, NE/SE/SW/NW. Cart only. Original body copied byte-for-byte to delivery.
- `assets/animal_walk/ox-v1.png`: 384x148, 4x2, cell96x74. Original copied byte-for-byte.
- `records/carts/layer-anchors.json`: animal origins relative cart origin NE(54,-31), SE(43,40), SW(-24,39), NW(-20,-31). Includes near-shaft occlusion polygons. Whole assembly extends beyond128x96; do not crop convoy into cart cell.
Archive is named candidates and record status is candidate. No separate final approval evidence found.

## Additional usable files
- `/tmp/astra-wave9-work-20260925/delivery/assets/prop/leaving_child_sheet-v1.png`:296x148; copied as delivery/assets/prop/refugee_child_sheet-v1.png.
- `/tmp/astra-wave9-work-20260925/delivery/assets/wk_leaving_family-v1.png`:296x148, backpack integrated; no independent backpack file found. Positions recorded in sibling records/accessory_registration.json as tied bedroll and sack.
- `/tmp/astra-wave4-candidates-20260925/wall/stone_face_a-v1.png`:512x128 strip.
- `/tmp/astra-wave4-work-20260925/astra-wave4-reference-files/stone_wall_straight_ne_sw-v3.png`:512x512 module sheet, not strip.
- `/tmp/astra-wave12-work-20260926/delivery/assets/bld/quay-v1.png`:256x128.
- `/tmp/astra-wave12-work-20260926/delivery/assets/active/quay-active-v1.png`:256x128 registered overlay.

## Convoy delivery
AI cargo generated with built-in imagegen using original cart as reference. Cargo only registered onto512x192; all original cart and ox pixels preserved separately. Red flags have three gold lions in high-resolution source, no quartering; native scale resolves gold marks rather than detailed heraldic anatomy. Prompts, raw source, crop transforms, reused hashes and four-direction/two-phase composition under delivery/records/convoy and delivery/checks/convoy-directions-phases.png. Two original cart frames are preserved with existing Wave13 wheel changes. Cargo row1 is an exact RGBA copy of row0 in each direction. Proof driver is a scaled reference visual, not a new delivered worker animation.
