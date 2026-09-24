# 설계 문서 이관 기록

2026-09-24 S0 6절. 입력: `to_Codex_S0 (1).zip`.
본문·도판·탐침을 바이트 그대로 복사했다. 상대 링크 수정은 없으며 v3-A의 `figures/` 구조를 유지했다.
탐침은 설계 당시 조사 자료이며 제품 코드·현재 검증 결과가 아니다. 문서의 확정/권고/보류 상태와 원문의 오래된 수치는 원문대로 보존했다.
현재 작업의 승인 범위와 상충 사항은 [문서 지도](../README.md), [현재 상태](../STATUS.md)를 먼저 읽는다.

| ZIP 안 원본 | 저장소 파일 | 바이트 | SHA-256 |
|---|---|---:|---|
| `DESIGN_MASTER_v2.3.md` | [DESIGN_MASTER.md](DESIGN_MASTER.md) | 28278 | `749bb0e903ced7713b4d860e7b3a123282f059d372c317c0a4d2990dc8dd813f` |
| `ORGANIC_WORLD_SYNTHESIS.md` | [organic-world/SYNTHESIS.md](organic-world/SYNTHESIS.md) | 6167 | `9d94604921ab01dc066536fa81eb88c48039e0c4975f8d40d05090bd1e4ba84f` |
| `ROADMAP_v2.3.md` | [ROADMAP.md](ROADMAP.md) | 12169 | `002096be6851b74babd97311c691f4820ce0d2327062ac47ae27e85a670c2c80` |
| `fable_organic_walled_town_design_v1.md` | [organic-world/fable-v1.md](organic-world/fable-v1.md) | 41370 | `838529987fee0ae7a9cd2e99e205d5da1572ba40d5964ce624e8488fcc36489d` |
| `v3-a/DESIGN_organic-world_v3_response.md` | [organic-world/v3-a/DESIGN_organic-world_v3_response.md](organic-world/v3-a/DESIGN_organic-world_v3_response.md) | 58944 | `0999f61e649571cf7f7de9f5c448d8529b0012bf41258a690a7f349c7deb752d` |
| `v3-a/figures/F1-layer-architecture.svg` | [organic-world/v3-a/figures/F1-layer-architecture.svg](organic-world/v3-a/figures/F1-layer-architecture.svg) | 14040 | `17c7f1436389ccadc00fa11a3aa916b28ac86b2af0437ac7741c19edcde531cd` |
| `v3-a/figures/F2a-road-gentle-arc.svg` | [organic-world/v3-a/figures/F2a-road-gentle-arc.svg](organic-world/v3-a/figures/F2a-road-gentle-arc.svg) | 27590 | `b5aefe231d0ff5bebb823d40a8f5c4cfd3e6dcbd2f8c3154ce49f52d77bcb855` |
| `v3-a/figures/F2b-road-45deg.svg` | [organic-world/v3-a/figures/F2b-road-45deg.svg](organic-world/v3-a/figures/F2b-road-45deg.svg) | 24701 | `cfa34782cf40b1abe5c544777ff148f3661d33b12fe37bfba3a84aab680ca950` |
| `v3-a/figures/F2c-road-s-curve.svg` | [organic-world/v3-a/figures/F2c-road-s-curve.svg](organic-world/v3-a/figures/F2c-road-s-curve.svg) | 31603 | `b26679b59897f999358fd9ba3e42d28c1147b177624ad598143922ee59b943ed` |
| `v3-a/figures/F3-wall-lattice-vs-smoothed.svg` | [organic-world/v3-a/figures/F3-wall-lattice-vs-smoothed.svg](organic-world/v3-a/figures/F3-wall-lattice-vs-smoothed.svg) | 66017 | `759e297abe3ee7f08c605af3c6731703d7ce14f630774ec6cfc71df519bd72eb` |
| `v3-a/figures/F4-zone-frontage-parcels.svg` | [organic-world/v3-a/figures/F4-zone-frontage-parcels.svg](organic-world/v3-a/figures/F4-zone-frontage-parcels.svg) | 63911 | `ddb3f83c8a6eee541f3e86449f9386e557307405d5f7056564c1cdbd0ab75dd2` |
| `v3-a/figures/png/F1-layer-architecture.png` | [organic-world/v3-a/figures/png/F1-layer-architecture.png](organic-world/v3-a/figures/png/F1-layer-architecture.png) | 134756 | `dbfcc8f7dfc6bdb18fea6bd029fb1c6e2aa932b95a001efe36661c7a8b70e8ad` |
| `v3-a/figures/png/F2a-road-gentle-arc.png` | [organic-world/v3-a/figures/png/F2a-road-gentle-arc.png](organic-world/v3-a/figures/png/F2a-road-gentle-arc.png) | 68842 | `3b56ab11e3666552c65baa7bc16697cc2756ed603555c9d07e1af6015a358925` |
| `v3-a/figures/png/F2b-road-45deg.png` | [organic-world/v3-a/figures/png/F2b-road-45deg.png](organic-world/v3-a/figures/png/F2b-road-45deg.png) | 65431 | `46a1019dfb1365ad1860b1390c68f68387ddd929c4c3e24aebe9bdee331421fd` |
| `v3-a/figures/png/F2c-road-s-curve.png` | [organic-world/v3-a/figures/png/F2c-road-s-curve.png](organic-world/v3-a/figures/png/F2c-road-s-curve.png) | 70946 | `07e8d0c3c81c7b6e69e4539f06756b81787fa8eb4c81131204fa9ba341d08229` |
| `v3-a/figures/png/F3-wall-lattice-vs-smoothed.png` | [organic-world/v3-a/figures/png/F3-wall-lattice-vs-smoothed.png](organic-world/v3-a/figures/png/F3-wall-lattice-vs-smoothed.png) | 58170 | `34b3bef8be2443bfd0d50cbab107ce250a24a1fdaa70ac200e5605b9485a3b1c` |
| `v3-a/figures/png/F4-zone-frontage-parcels.png` | [organic-world/v3-a/figures/png/F4-zone-frontage-parcels.png](organic-world/v3-a/figures/png/F4-zone-frontage-parcels.png) | 131514 | `587ca6f28da045b3c2293cbe0f88b8c194fa297edcb5c11b02708aa003a9031f` |
| `v3-a/probes/p1-road-raster.out.txt` | [organic-world/v3-a/probes/p1-road-raster.out.txt](organic-world/v3-a/probes/p1-road-raster.out.txt) | 2987 | `ba6911121e81b1a8bcfeb3d937d150ebd8424a0b918b60f78669e80453be78a1` |
| `v3-a/probes/p1-road-raster.ts` | [organic-world/v3-a/probes/p1-road-raster.ts](organic-world/v3-a/probes/p1-road-raster.ts) | 10018 | `c5415c77f0fa69997d55e7dee7c903f9362b474621af1b2789bf33cc803f8a15` |
| `v3-a/probes/p1b-road-8conn.out.txt` | [organic-world/v3-a/probes/p1b-road-8conn.out.txt](organic-world/v3-a/probes/p1b-road-8conn.out.txt) | 3873 | `fbf7db9b24f3af5475ec8c1df6c044d4c992b88cac9ea66fcd323a9a4a2237cc` |
| `v3-a/probes/p1b-road-8conn.ts` | [organic-world/v3-a/probes/p1b-road-8conn.ts](organic-world/v3-a/probes/p1b-road-8conn.ts) | 9590 | `cc20581f8b984ecf115a7848d197f34069b9248ccd3c9b6c2f35a4e61039d152` |
| `v3-a/probes/p2-wall-spline.out.txt` | [organic-world/v3-a/probes/p2-wall-spline.out.txt](organic-world/v3-a/probes/p2-wall-spline.out.txt) | 1623 | `382cca9c246db5d67ce4146d8306b2b0b16b21372459828a1e05a439645b9c82` |
| `v3-a/probes/p2-wall-spline.ts` | [organic-world/v3-a/probes/p2-wall-spline.ts](organic-world/v3-a/probes/p2-wall-spline.ts) | 7895 | `73b73e36866f04cf2f864f3bbd02954f9871ed37d9d50064a49f54b79cc5c827` |
| `v3-a/probes/p3-contour-stats.out.txt` | [organic-world/v3-a/probes/p3-contour-stats.out.txt](organic-world/v3-a/probes/p3-contour-stats.out.txt) | 996 | `b32ae8e63d9ab319a27b07d1c9c3264b80fc61739b2108289782c82dacda56fc` |
| `v3-a/probes/p3-contour-stats.py` | [organic-world/v3-a/probes/p3-contour-stats.py](organic-world/v3-a/probes/p3-contour-stats.py) | 1300 | `6a25b25ec4a442e2101c393fb1a98911773a4b4a5e6123d7f48636ccce7b6e40` |
| `v3-a/probes/p4-canvas-bench.html` | [organic-world/v3-a/probes/p4-canvas-bench.html](organic-world/v3-a/probes/p4-canvas-bench.html) | 5625 | `93c5b0d6a76aa26141f232affe56136bb04f7274c062d71e19fe0db0cb17308a` |
| `v3-a/probes/p4-canvas-bench.out.txt` | [organic-world/v3-a/probes/p4-canvas-bench.out.txt](organic-world/v3-a/probes/p4-canvas-bench.out.txt) | 974 | `ef12caf5bc7cd3b333ef80fa732ea43747eb3d19e9d5e1298dd4a163c40733b6` |
| `v3-a/probes/p5-zone-frontage.out.txt` | [organic-world/v3-a/probes/p5-zone-frontage.out.txt](organic-world/v3-a/probes/p5-zone-frontage.out.txt) | 166 | `8e7354cbc085d65f836cf45a64af345e4781f807c5205a12e57df41f501dd9b6` |
| `v3-a/probes/p5-zone-frontage.ts` | [organic-world/v3-a/probes/p5-zone-frontage.ts](organic-world/v3-a/probes/p5-zone-frontage.ts) | 12231 | `cb4fabae26735567c1338e782ec5c7d7306b5852dd44439ce1c45a0bb1b41c83` |
| `v3-b_ORGANIC_WORLD_DESIGN_v3.md` | [organic-world/v3-b.md](organic-world/v3-b.md) | 77143 | `f10b97fcee23b3ad8e202a699cb557f2f68a170be4a3998015c3973b17078f1d` |

## 첨부에 없는 v3-B 보조 자료

v3-B 본문은 아래 보조 메모·도판을 참조하지만 ZIP에 없고 현재 로컬 프로젝트·Downloads 검색에서도 찾지 못했다. 원문을 보존했으며 빈 문서나 대체 그림을 만들어 채우지 않았다. 문서 지도에서 이관 본문으로 가는 링크는 열리지만, **v3-B 본문 내부의 아래 8개 상대 참조는 미해결**이다.

- `evidence/roads-walls.md`
- `evidence/placement-zones.md`
- `evidence/render-assets.md`
- `evidence/save-contract.md`
- `diagrams/02-boundary-contract.svg`
- `diagrams/01-architecture.svg`
- `diagrams/03-stage1-fixture.svg`
- `evidence/contract-challenge.md`
