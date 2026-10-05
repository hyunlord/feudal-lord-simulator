# Phase2 최종 게시 문서·증거 누락 감사

판정: **문서·패키지 감사 PASS — 최종 게시 게이트 PENDING**. main `db17321a907b5c0c72560fe2fab29966f38963d1`의 현재 작업 트리와 추적 파일을 구분하여 읽기 전용 감사했다. 제품·공식 문서·git 상태를 수정하지 않았다. 부모의 정정 뒤 해시를 다시 검증했다.

## 패키지 폐쇄 검증

각 제한은 3,145,728 bytes. 추적 파일 크기도 현재 작업 트리 바이트 기준이며, 아래 예정 집합에는 아직 미추적인 게시 의존 파일을 포함한다. 무시된 기존 `main-provenance-tests.log`는 제외하고 추적된 바이트 동일 `.txt`를 검증했다.

| 패키지 | 추적 파일 / bytes | 게시 예정 파일 / bytes | 자기 자신 제외 해시 항목 | 물리 JPEG |
|---|---:|---:|---:|---:|
| wave37-reconcile | 14 / 1,208,064 | 15 / 1,210,477 | 14 | 6 |
| season-core | 24 / 2,891,921 | 24 / 2,891,921 | 23 | 14 |
| spring9-data | 27 / 1,742,850 | 27 / 1,742,850 | 26 | 10 |
| field-core | 26 / 2,344,601 | 26 / 2,344,601 | 25 | 7 |
| field-spring3-data | 34 / 2,053,610 | 34 / 2,053,610 | 33 | 12 |
| heath-core | 40 / 1,423,909 | 40 / 1,423,909 | 39 | 7 |
| heath-data | 31 / 1,530,619 | 35 / 1,548,703 | 34 | 8 |

7개 모두 용량 PASS. 7개 전체 해시 목록의 누락·불일치·미열거 게시 파일은 각각 0. 각 패키지에 summer/winter × zoom 1/.6 네 참조 이미지가 존재한다. 공유 JPEG는 논리 before/after 기록을 대체하지 않는다. 패키지 Markdown 및 관련 상태 문서 로컬 링크의 누락 대상은 0이다. W37 capture-index도 논리10/물리6 JPEG의 파일 해시 불일치0이다. 전체 정량 목록 및 index SHA는 [동반 JSON](phase2-final-closure-audit.json)에 있다.

## 발견과 정정 재확인

1. HEATH core REPORT 첫 제목/현재 상태는 뒤의 독립 PASS와 달리 VISUAL PENDING이었다. 부모가 현재 요약을 **INDEPENDENT VISUAL PASS WITH LIMITS**로 정정했고 새 해시 목록까지 재검증했다. 원래 측정 시점 역사와 `NON_RUNTIME_DOCUMENT_DRIFT` 설명은 유지되어 있다.
2. W37에는 이미지 capture-index만 있고 전체 패키지 목록이 없었다. 부모가 `SHA256SUMS.json` 14항목을 추가했으며 정확한 전체 파일 폐쇄와 SHA를 확인했다. 기존 런타임 증거 누락이라는 판정은 아니다.

정정 후 열린 문서 결함은 없다. 다만 다음 7개 현재 미추적 게시 의존 파일을 최종 stage에 포함해야 한다. 부모가 포함할 예정이라고 알렸다.

- `docs/verification/wave37-reconcile/SHA256SUMS.json`
- `docs/verification/heath-data/reference4-export-attestation.txt`
- `docs/verification/heath-data/reference4-parent-check.json`
- `docs/verification/heath-data/reference4-summary.json`
- `docs/verification/heath-data/reference4-views.json`
- `docs/requests/render-human-registration-request.md`
- `docs/requests/render-human-registration-request.json`

## 측정·상태 구분

W37 `bc29f6b2`, season core `208c6222`, spring9 `70c15321`/reference `c8089d60`, FIELD core `a392694c`, FIELD3 `cd399e4a`/reference `d3673823`, HEATH core `931d780e`, HEATH2 `fd68f124`/reference `db17321a`의 실제 commit 존재 및 보고 구분을 확인했다. 이전 detached 준비 증거를 새 main 측정으로 대체하지 않는다.

STATUS / ROADMAP / DISPATCH의 원425 census marked153/runtime157 및 원425 밖 HEATH2 구분은 일치한다. W37 당시150+4 byte proof+255 active+16 retired는 당시 기록으로 유지된다. spring9 원6 retirement/source 보존, FIELD3 실제20와 이후 reference4, HEATH2 실제30와 이후 reference4는 서로 대체되지 않는다. ARCH1 `90d9`의 기존 게시 완료와 Phase2 최종 게시 대기도 구분되어 있다. UI260 handoff 준비를 실제 UI 적용 완료로, HEIGHT A1 준비를 전체 HEIGHT 완료로 표시하지 않는다.

HEATH core는 export 당시 문서2 drift / 실제 tracked-dirty true / 시작 metadata false를 명시하고 runtime product4308 exact931 및 driver2를 별도 판정한다. 전체 clean export라고 볼 수 없다. HEATH negative16은 first-open absence이며 repeat absence는 미검증이다. FIELD protected4259는 executor 보고 수치로, 이 감사가 개별 원본4259를 재검증한 것은 아니다.

## 미완료 게이트와 감사 한계

기존 `phase2-geometry-watch.json`은 RUNNING_OR_QUEUED / fetched false였다. 이를 원격 재조회하지 않았다. geometry 최종 판정, 최종 merge, clean-clone 검증, phase2 push/게시가 남아 있으며 정상 진행 중 게이트이지 문서 결함이 아니다. 이 감사 PASS는 최종 게시 PASS가 아니다.

새 테스트·전체 실행·브라우저·DGX 작업 및 이미지 native 재검토는 수행하지 않았다. JPEG는 미리보기이며 정밀 RGBA 주장은 기존 원본 comparator 영수증 범위이다. 전체 원본 캡처/소스 freeze는 압축 패키지 밖 경로·해시 참조로 유지되고, 패키지만으로 모든 원본을 독립 재생할 수 있다고 주장하지 않는다. 본 결과는 기재한 현재 문서 스냅샷의 검증이며 후속 부모 변경은 별도 재검증 대상이다.
