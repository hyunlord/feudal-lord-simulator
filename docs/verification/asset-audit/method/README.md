# ASSET-1 방법 스크립트

본선 체크아웃(LFS 파일까지 받은 것)을 `../a1trunk`에 두고 이 폴더에서 `./run_all.sh`로 순서대로 돌린다(`W = '../a1trunk'`). 저장소 파일은 읽기만 하고 고치지 않는다.

| 순서 | 스크립트 | 하는 일 | 결과 |
|---|---|---|---|
| 1 | `hashall.py <repo> hashes.json` | `public/assets`·`assets-inbox`·`docs/asset-evidence`의 모든 파일: SHA-256, caBX 청크를 뺀 SHA, RGBA 픽셀 해시, 청크 목록, 크기, 알파 바운딩 | `hashes.json` |
| 2 | `reconcile.py` | runtime 파일·빌드 파생 → INBOX 장부·설치 대장 연결과 분류(A1), manifest 경로 수집(A3), 코드 참조(A5) | `reconcile.json` |
| 3 | `paths.py` | 잴 그림 목록(runtime PNG + 확정·설치된 inbox 그림) | `metric_paths.json` |
| 4 | `pixmetrics.py metric_paths.json metrics.json` | 헤일로·빈 파일·단색·밝기·채도·주조색 | `metrics.json` |
| 5 | `specks.py` | 반투명 잔여 점 | `specks.json` |
| 6 | `innersemi.py` | 그림 안쪽(투명에서 4 px 이상)의 반투명 픽셀 — 성벽 면 v1 윗줄 확인에 씀(결함 표에는 넣지 않음) | `innersemi.json` |
| 7 | `specs.py` | manifest·Astra 기록의 캔버스·피벗·알파 바운딩 vs 실제, 파생 대장, DPR·크기 파생, 설치 대장 행, 이름 | `spec_rows.json` |
| 8 | `items.py` | 시트에 올릴 그림 목록(같은 픽셀은 한 번)과 범주 | `items.json` |
| 9 | `render_sheets.py` (`scales.py`·`groups.py`) | 시트 8장, 표시 배율, 묶음별 z-score | `out/sheets/*.jpg`, `sheet_rows.json` |
| 10 | `write_csvs.py`, `fixlists.py`, `scale_table.py`, `write_report.py` | CSV와 보고서 | `out/*.csv`, `REPORT.md` |

`tsjson.py`는 `src/**/*.generated.ts`·`*Manifest*.ts`의 `export const X = {...}`를 JSON으로 읽는 도우미다. 표시 배율 표(`scales.py`의 `FAMILY`)는 그리기 코드를 읽어 적었다(근거 파일·줄은 `display_scale_by_family.csv`의 `basis`와 보고서 B절). 의존: Python 3, Pillow, NumPy, SciPy, 시트 글꼴 AppleSDGothicNeo(macOS).
