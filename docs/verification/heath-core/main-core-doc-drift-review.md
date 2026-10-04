# HEATH core export 문서 drift 독립 판정

**수용 가능: `NON_RUNTIME_DOCUMENT_DRIFT`로 한정한 실제 committed-product runtime 증거. 전체 tracked-clean snapshot PASS는 불가.** 동일runtime입력의 단순재촬영은 이 차이만으로 필요하지 않다. 실제 core30 결과/시각 판정은 별도이며 최종cleanclone은 계속 남는다.

실행 HEAD `931d780e37307a7dd2f85a697b122656cb29359d`. 시작메타데이터 dirty0와 실제export의 tracked상태가 일치하지 않았다. 원격 `git diff --name-only HEAD` 결과와 `sha256sum`을 보존한 `.omo/evidence/heath-main-core-tracked-race-check.txt`는 수정2경로를 명시한다. 담당자에게 실제명령을 확인했다. 이는 모든 tracked 경로에 대한 diff이며 임의untracked 전체를 동결했다는 주장은 아니다.

| 실제 drift | HEAD SHA | export SHA |
|---|---|---|
| docs/verification/field-spring3-data/REPORT.md |5c3244774e78a637661beeacc4cfaccc8ea14dc5176cc8364660c296c9050f1b|2149c4e2742183d2dc1275d1b30ad7c959a42d8316a8ed0f20ccf589acb9132f|
| docs/verification/field-spring3-data/SHA256SUMS.json |38656ab1c939113a57a09af13e4720342c0783b13320ea44714d54873ccc2cf8|37934ddc6b0c5b4874f00e392749c9d6bb53ad3b245fd28ff41ccc715459abb9|

현재local bytes가 위원격SHA와 일치하며 HEADblob을 직접읽어차이를 확인했다. REPORT는 ignored `.log` 링크를 같은바이트 `.txt`로 바꾸고 경위를 설명한 것뿐이다. 해시index는 REPORT해시/크기 및 그경로·역사log제외 표기를 갱신했다. 코드·그림·카탈로그·save·캡처옵션을 바꾸는 내용이 아니다. txt와 기존log의 실제bytes도 동일하다. txt는931 HEAD에 없는 로컬후속문서이므로 이 링크정정을931의 committed문서라고 소급하지 않는다.

src/scripts/tests/tools 및 runtime capture/Vite entry를 검색한 범위에서 이두proof문서의 소비자는 없었다. 실제 capture는 명시views/state를 읽고 Vite는 package/config/source를 소비한다. 임의docs를 runtime에 import하는 경로는 이번두파일에 확인되지 않았다. 정적품질검사의 documentation budget/index 대상이 될 수 있다는 것과 게임runtime입력이라는 것은 구분한다.

`.omo/evidence/heath-main-core-freeze.json`은 fresh cached+others source/public/scripts/tests/tools, 명시rootconfigs/provenance/ledger,42fixture를 고정한4,308입력이다. `.omo/evidence/heath-main-core-doc-race-check.txt`의 실제remote검사결과는 HEAD931,4,308SHA일치,퇴역6+B/C2 부재8, differences[] PASS다. 문서2는 이runtimefreeze에 포함되지 않으며 거짓전체clean을 증명하는 방식으로 freeze숫자를 읽지 않는다. 새임의untracked 전체/`.omo`의모든파일까지 동일하다고 주장하지 않는다.

## 수락 문구와 후속조건

- 실제metadata: `exportStartMetadataDirty=false`, `actualTrackedDirty=true`, `NON_RUNTIME_DOCUMENT_DRIFT`, exact2path와before/exportSHA를 유지한다.
- 실제runtime의 제품코드·아트·fixture는 committed931의동일입력으로 확인된 한정증거라고 기록할 수 있다. 원래startdirty0를 삭제하거나true로 덮어쓴 가짜원영수증을 만들지 않는다.
- numerical/core30/원본시각결과가 통과해야 runtime통과가 되며 이문서drift판정이 그결과를 대신하지 않는다.
- 다음run은 문서작업을 동결하거나 별도출력으로 격리해 export도중tracked변경을 피한다. 후속정상문서commit+최종HEADcleanclone에서 문서정정도 검증한다. 전체clean이라는표현이 필요한 최종게이트는 이번run으로 충족되지 않는다.

검토자 원격/제품/시험/commit 실행 없음. 실제remote명령은 실행담당자의 보존원문과 명령확인으로 검토했고 로컬HEAD/byte/source관계는 직접대조했다. 보고서 외 변경하지 않았다.
