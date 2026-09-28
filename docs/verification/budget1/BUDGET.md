# 빌드 결과(dist) 크기 예산표

측정: `f23ab615` 빌드(`vite build`, 1.2초). MB = 1,000,000바이트. 규칙·예산 원본은 `scripts/checks/distBudget.config.json`, 병합 전 검사(`npm run check:merge`)가 전체나 예산 있는 범주가 넘으면 실패한다.

| 범주 | 파일 | 크기 | 예산 | 남은 폭 | 판정 |
|---|---:|---:|---:|---:|---|
| 세계 그림 | 660 | 26.14 MB | — | — | — |
| 초상 | 614 | 4.33 MB | 20.00 MB | 15.67 MB | 통과 |
| 삽화 | 81 | 5.29 MB | 25.00 MB | 19.71 MB | 통과 |
| 키아트 | 6 | 1.49 MB | — | — | — |
| UI | 630 | 13.62 MB | — | — | — |
| 소리 | 37 | 1.24 MB | — | — | — |
| 코드 | 15 | 2.34 MB | — | — | — |
| 기타 | 1 | 0.00 MB | — | — | — |
| **전체** | 2044 | 54.45 MB | 150.00 MB | 95.55 MB | 통과 |

글꼴은 woff2만 싣는다(BUDGET-1b 판정 2026-09-28, Electron·최신 브라우저 대상): `scripts/woff2OnlyFonts.ts`가 @fontsource CSS의 woff 대체 경로를 빌드 전에 지운다.

범주 안의 구성:

- 세계 그림 · buildings, walls, gates, bridges, modules: 163개, 13.74 MB
- 세계 그림 · world waves 7, 9, 11, 12, 15: 239개, 4.68 MB
- 세계 그림 · terrain, water, shore, roads, fields, foliage, boundaries, zones, yards: 108개, 4.23 MB
- 세계 그림 · walkers, animals, carried props: 90개, 1.87 MB
- 세계 그림 · village life, weather (Wave 23): 34개, 1.12 MB
- 세계 그림 · visible simulation marks (visibility v1): 22개, 0.33 MB
- 세계 그림 · war props (Wave 17 world): 4개, 0.17 MB
- 초상 · portrait pool (256 and 96 px JPEG): 608개, 4.05 MB
- 초상 · steward portraits (P0): 6개, 0.28 MB
- 삽화 · events, decisions, chronicle, chapter pages (Wave 16): 35개, 2.99 MB
- 삽화 · chapter 2 end, chronicle, decisions, events (Wave 17): 22개, 1.96 MB
- 삽화 · season ledger scenes (Wave 19): 24개, 0.34 MB
- 키아트 · title, mode select, emblem, loading screens (Wave 8): 6개, 1.49 MB
- UI · fonts (Noto Sans KR, Noto Serif KR; woff2 only): 372개, 7.06 MB
- UI · record cards, chronicle pages, timeline (Wave 19): 29개, 2.55 MB
- UI · P0 kit: frames, textures, icons, cursors, buttons: 92개, 1.89 MB
- UI · Wave 8 frames, icons, ornaments, time strip: 31개, 0.96 MB
- UI · heraldry, merchant marks, seals, UI frames and icons (Wave 14): 58개, 0.78 MB
- UI · pad glyphs, person-state ornaments, royal arms (Wave 23): 48개, 0.38 MB
- 소리 · audio: 37개, 1.24 MB
- 코드 · page, scripts, styles, manifests: 9개, 2.33 MB
- 코드 · license texts: 6개, 0.01 MB
- 기타 · unmatched: 1개, 0.00 MB

## 시작 시 불러오는 그림 메모리

예산 없음(측정만). 시작 때 미리 불러오는 그림(`src/render/preloadGameArt.ts`의 `preloadGameArt`·`preloadFrameArt`, 그리고 첫 지형 프레임이 지도와 관계없이 부르는 경계·계절 그림)의 해제 크기 = 빌드 파일 머리의 가로 × 세로 × 4의 합. 목록은 `scripts/checks/startupArtList.ts`가 이 런타임 함수들을 돌려 얻는다. 지도에 있을 때만 처음 그릴 때 불러오는 그림(물가·구역·마당·성벽 면·날씨·마을 생활)과 초상·삽화는 들지 않는다 — BUDGET-1 탐침의 118.8 MB(1장 끝 마을이 불러온 세계 그림 전부)와 다른 이유다.

| 시작 | 그림 | 파일 | 해제 크기 | 그중 세계 그림 |
|---|---:|---:|---:|---:|
| 1장 시작(캠페인 새 게임) | 441 | 15.18 MB | 66.04 MB | 65.70 MB |
| 전부(자유 모드, BUDGET-1b 전의 모든 시작) | 449 | 15.39 MB | 67.10 MB | 66.75 MB |
| 1장 시작, INSTALL-26~29 뒤(`d8515ce`, Wave 26 집 변형·층 100장 더함) | 569 | 17.50 MB | 76.99 MB | 74.31 MB |
| 전부, INSTALL-26~29 뒤 | 577 | 17.71 MB | 78.04 MB | 75.36 MB |

- 2장에 들어갈 때 더함: 5개(`assets/wave12/world/quay-v1.png`, `assets/wave17/world/beacon_idle-v1.png`, `assets/wave17/world/beacon_lit-v1.png`, `assets/wave17/world/raid_burning_quay-v1.png`, `assets/wave17/world/raid_smoke_column_sheet-v1.png`) — 누적 66.86 MB
- 3장에 들어갈 때 더함: 3개(`assets/wave9/event/plague_shut_l1-v1.png`, `assets/wave9/event/plague_shut_l2-v1.png`, `assets/wave9/event/plague_shut_l3-v1.png`) — 누적 67.10 MB

규칙에 안 걸린 파일(기타) 1개: `assets/.gitkeep`.
