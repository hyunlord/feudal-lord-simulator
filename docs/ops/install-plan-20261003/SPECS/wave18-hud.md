# HUD·배치·구역 아이콘 연결

분류 B · 41장 · 관련 작업 LM-R1 / LM-R2 · 예상 7–14 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/ui/hud/HudShell.tsx:49 StatusPill; :103 ActionDock; :158 CrisisIcons; src/ui/alertStackModel.ts:195 alertStackRows; src/ui/hud/ZoneToolbar.tsx:19 ZoneToolbar; src/ui/hud/PlacementConfirmBar.tsx:8; src/render/zoneBrushOverlay.ts:108 drawZoneBrushOverlay

## 연결·자리·선택

main/reused는 status/action 셀, crisis는 alertStackRows reason, reasons는 placement result, zone는 toolbar actions, misc는 confirm/cancel/hide와 대응시킨다. glyph/sheet 기반 현재 호출을 loose PNG lookup에 연결해야 하므로 데이터-only가 아니다. patterns는 source-over/multiply 투명 그림을 별도 placement fill 위에 칸 좌표로 반복; 64×32 diamond 원본을 stretch하지 않는다. pattern_service_range_edge는 service 경계만.

## 확인할 장면·줌·계절

돈/식량/인구 큰 숫자, 6위기 동시, 각8배치거부 이유, 구역 paint/erase/undo/redo. UI24/32/48px 및 44px hit area; 세계패턴 0.6/1.0/1.4; 색각없이 pattern 구분.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave18/candidates-v1/assets/crisis/crisis_construction_blocked.png|public/assets/wave18/crisis/crisis_construction_blocked.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/crisis/crisis_fire.png|public/assets/wave18/crisis/crisis_fire.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/crisis/crisis_food_shortage.png|public/assets/wave18/crisis/crisis_food_shortage.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/crisis/crisis_household_leaving.png|public/assets/wave18/crisis/crisis_household_leaving.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/crisis/crisis_storage_full.png|public/assets/wave18/crisis/crisis_storage_full.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/crisis/crisis_upkeep_unpaid.png|public/assets/wave18/crisis/crisis_upkeep_unpaid.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/main/dock_build.png|public/assets/wave18/main/dock_build.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/main/dock_ledger.png|public/assets/wave18/main/dock_ledger.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/main/dock_steward.png|public/assets/wave18/main/dock_steward.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/main/pill_food_days.png|public/assets/wave18/main/pill_food_days.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/main/pill_money.png|public/assets/wave18/main/pill_money.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/main/pill_population.png|public/assets/wave18/main/pill_population.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/misc/cancel_touch.png|public/assets/wave18/misc/cancel_touch.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/misc/confirm_check_touch.png|public/assets/wave18/misc/confirm_check_touch.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/misc/hud_hide.png|public/assets/wave18/misc/hud_hide.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/misc/layer_lock_badge.png|public/assets/wave18/misc/layer_lock_badge.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/misc/pulse_ring.png|public/assets/wave18/misc/pulse_ring.png|288×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/patterns/pattern_blocked_cross.png|public/assets/wave18/patterns/pattern_blocked_cross.png|64×32|UI top-left (0,0)|
|wave18/candidates-v1/assets/patterns/pattern_blocked_hatch.png|public/assets/wave18/patterns/pattern_blocked_hatch.png|64×32|UI top-left (0,0)|
|wave18/candidates-v1/assets/patterns/pattern_ok.png|public/assets/wave18/patterns/pattern_ok.png|64×32|UI top-left (0,0)|
|wave18/candidates-v1/assets/patterns/pattern_service_range_edge.png|public/assets/wave18/patterns/pattern_service_range_edge.png|128×16|UI top-left (0,0)|
|wave18/candidates-v1/assets/reasons/reason_material_shortage.png|public/assets/wave18/reasons/reason_material_shortage.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/reasons/reason_no_road.png|public/assets/wave18/reasons/reason_no_road.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/reasons/reason_overlap.png|public/assets/wave18/reasons/reason_overlap.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/reasons/reason_slope_rock.png|public/assets/wave18/reasons/reason_slope_rock.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/reasons/reason_tree.png|public/assets/wave18/reasons/reason_tree.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/reasons/reason_wall_forbidden.png|public/assets/wave18/reasons/reason_wall_forbidden.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/reasons/reason_water.png|public/assets/wave18/reasons/reason_water.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/reasons/reason_zone_forbidden.png|public/assets/wave18/reasons/reason_zone_forbidden.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/reused/pill_season_autumn.png|public/assets/wave18/reused/pill_season_autumn.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/reused/pill_season_spring.png|public/assets/wave18/reused/pill_season_spring.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/reused/pill_season_summer.png|public/assets/wave18/reused/pill_season_summer.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/reused/pill_season_winter.png|public/assets/wave18/reused/pill_season_winter.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/zone/zone_brush.png|public/assets/wave18/zone/zone_brush.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/zone/zone_erase.png|public/assets/wave18/zone/zone_erase.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/zone/zone_paint_forbidden.png|public/assets/wave18/zone/zone_paint_forbidden.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/zone/zone_polygon.png|public/assets/wave18/zone/zone_polygon.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/zone/zone_redo.png|public/assets/wave18/zone/zone_redo.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/zone/zone_size_large.png|public/assets/wave18/zone/zone_size_large.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/zone/zone_size_small.png|public/assets/wave18/zone/zone_size_small.png|96×96|UI top-left (0,0)|
|wave18/candidates-v1/assets/zone/zone_undo.png|public/assets/wave18/zone/zone_undo.png|96×96|UI top-left (0,0)|


## 용량과 공통 처리

이 실행 묶음 41장: 메타데이터 제거 후 원본 합계 0.41 MiB, 원본 RGBA 한 벌 산술 합계 1.40 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
