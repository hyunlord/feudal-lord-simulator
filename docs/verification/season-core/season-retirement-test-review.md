# Seasonal retirement test-only repair — 독립 검토

**PASS — 이 수정에서 게시를 막을 결함을 찾지 못했다.** 읽기 전용으로 season-prep의 `tests/seasonArt.test.ts`, 증거 JSON/MD/patch, 공용 CSV parser, 관련 migration/lifecycle/provenance 테스트와 양쪽 저장된 focused 로그를 대조했다. 시험을 재실행하지 않았으며 main 제품·테스트·장부는 수정하지 않았다.

## 수정의 타당성

- 이전 검사는 역사적 설치 65개와 현재 public Wave15 행 65개를 동일시했다. 승인된 spring6 퇴역 뒤 현재 행이 59가 되는 것은 정상이며, public 파일을 복원하거나 retired 행을 active로 바꿔 통과시켜서는 안 된다. 새 테스트는 두 의무를 분리한다.
- 역사 증거는 느슨해지지 않았다. `seasonArt.test.ts:25–44`는 고정 baseline 65개와 wave15/INSTALL-15 receipt 총65개를 각각 요구한다. 모든 baseline URL에서 정본 source 경로를 만들고, 실제 source 파일의 SHA256을 계산한다. 파일 경로가 정확히 같은 receipt가 하나여야 하며 그 SHA와 일치해야 한다. 같은 sourcePath의 provenance 행도 정확히 하나이고 sourceSha256이 실제 bytes와 같아야 한다. substring digest 검색이나 CSV 물리적 줄 수에 의존하지 않는다. 여섯 retired source도 같은 loop를 통과하며 skip/예외는 없다.
- 현재 runtime 검사는 `SEASON_IMAGES` 전체를 사용한다(:48–60). URL 중복을 거부하고 runtimePath가 정확히 같은 CSV 행 하나, runtime/candidate 상태, runtime/source 파일의 존재와 각각의 실제 SHA256 일치를 모두 요구한다. retired 상태를 active로 받아들이지 않는다. candidate 허용은 현재 provenance의 설치 후보 상태와 합치되며 시각 승인이나 runtime capture PASS를 의미하지 않는다.
- 기존 `scripts/provenanceLedgerCsv.ts`의 parseCsv/parseCsvRows를 재사용한다. quoted comma/newline를 처리하고 provenance 필수 header를 확인한다. INBOX header의 필요한 네 column도 테스트에서 직접 확인한다. 새 CSV parser나 permissive fallback을 추가하지 않았다.

## 주변 보호 경계와 한계

`artSeasonVariant.test.ts:19–27`은 fixture 기반 core20+legacy45의 정확한65 key 집합과 URL/크기를 계속 대조한다. :30–47은 역사 선택과 활성 entry의 seasonVariants 포함을 검사한다. installer 출력과 실제 legacy manifest의 정확한 일치도 :71–82에 남는다. 새 active hash 테스트가 역사65→현재65라는 잘못된 숫자를 고정하지 않은 것은 의도에 맞다.

`verifyProvenance.test.ts`는 별도로 누락 행/파일/hash mismatch, active runtime 총수 대응 및 retired runtime 잔존을 계속 거부한다. 따라서 역사 테스트가 퇴역 source의 runtimePath를 public으로 고정하지 않는 것이 퇴역 검사를 제거한 것은 아니다.

새 테스트 하나만으로 임의 catalog 삭제·의도한 신규9 완전성·잘못된 source attribution의 모든 의미를 증명하지는 않는다. 이 수정의 목적은 역사 receipt/source 보존과 실제 활성 manifest의 exact-path/hash 검증이며, 신규9 설치 목록/선택/이미지 품질은 기존 별도 데이터/런타임 관문의 책임이다. source와 CSV 양쪽을 동시에 위조하는 상황을 단독 SHA 테스트가 감지한다고 주장하지 않는다.

## 증거 대조

- 양쪽 실제 `tests/seasonArt.test.ts` SHA256을 읽어 일치를 확인했다: `0d8b15235094a9adc24344b09bc2562a2e6601156ba7954320f12b5339c5c1fb`. 증거 JSON afterSha256과 같다.
- incremental patch는 CSV helper import와 기존 첫 테스트의 역사/활성 두 테스트 분리에 한정한다. 이후 chooser/chunk/transition/decals/effects assertion을 없애지 않았다.
- 양쪽 `.omo/evidence/season-art-retirement-focused.log`의 끝은 각각 tests37/pass37/fail0/skipped0이다. 이는 **저장된 실행 로그 확인**이며 이번 독립 검토에서 재실행한 결과가 아니다.
- 증거 JSON/MD는 typecheck/lint/diffcheck PASS, product1075 hash 차이0과 신규 runtime 미실행을 기록한다. 이번 검토에서 product1075 전체 해시 검사를 다시 수행하지 않았다. 과거 runtime freeze를 새 테스트 SHA의 runtime 검증으로 소급하지 않는다는 명시도 적절하다.

결론: 동일 test-only 변경을 core/data 양쪽 입력에 반영하고 이후 새 inputfreeze에 포함하는 방식으로 통합 가능하다. 과거 캡처의 frozen input과 새 테스트 검증 기록은 계속 분리해야 한다.
