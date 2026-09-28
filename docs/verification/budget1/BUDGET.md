# 빌드 결과(dist) 크기 예산표

측정: `0944bc38` 빌드(`vite build`, 1.3초). MB = 1,000,000바이트. 규칙·예산 원본은 `scripts/checks/distBudget.config.json`, 병합 전 검사(`npm run check:merge`)가 전체나 예산 있는 범주가 넘으면 실패한다.

| 범주 | 파일 | 크기 | 예산 | 남은 폭 | 판정 |
|---|---:|---:|---:|---:|---|
| 세계 그림 | 660 | 26.14 MB | — | — | — |
| 초상 | 614 | 4.33 MB | 20.00 MB | 15.67 MB | 통과 |
| 삽화 | 81 | 5.29 MB | 25.00 MB | 19.71 MB | 통과 |
| 키아트 | 6 | 1.49 MB | — | — | — |
| UI | 1002 | 22.75 MB | — | — | — |
| 소리 | 37 | 1.24 MB | — | — | — |
| 코드 | 15 | 2.36 MB | — | — | — |
| 기타 | 1 | 0.00 MB | — | — | — |
| **전체** | 2416 | 63.60 MB | 150.00 MB | 86.40 MB | 통과 |

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
- UI · fonts (Noto Sans KR woff2 + woff): 744개, 16.19 MB
- UI · record cards, chronicle pages, timeline (Wave 19): 29개, 2.55 MB
- UI · P0 kit: frames, textures, icons, cursors, buttons: 92개, 1.89 MB
- UI · Wave 8 frames, icons, ornaments, time strip: 31개, 0.96 MB
- UI · heraldry, merchant marks, seals, UI frames and icons (Wave 14): 58개, 0.78 MB
- UI · pad glyphs, person-state ornaments, royal arms (Wave 23): 48개, 0.38 MB
- 소리 · audio: 37개, 1.24 MB
- 코드 · page, scripts, styles, manifests: 9개, 2.35 MB
- 코드 · license texts: 6개, 0.01 MB
- 기타 · unmatched: 1개, 0.00 MB

규칙에 안 걸린 파일(기타) 1개: `assets/.gitkeep`.
