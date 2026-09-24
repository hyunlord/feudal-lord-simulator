# R1fix 보안·저장 경계 검토

- 검토일: 2026-09-24
- 커밋 범위: `1c09e99..d3d391c9f467ad2242f1f22ffcea2262021d9bef`
- 추가 검토: 현재 미추적 `scripts/autoplaySearchReplay.ts`, `fixtures/autoplay-search-budget/`, `fixtures/rule-repair-probes/`, `scripts/ruleRepairUiProof.ts`
- 판정: **PASS — 보안·신규 저장 경계 차단 없음. SEC-01(Low)은 수정 후 재검증 완료.** 장시간 자연 진행·성능 게이트의 미완료는 이 보안 판정의 실패 사유가 아니다.
- 제품 수정 및 무거운 테스트 없음. 정적 검토, 5가지 잘못된 저장값의 즉시 로드 재현, 아카이브 메타데이터 읽기만 수행했다.

## SEC-01 — v4 목재 부족 시간의 타입·범위 검증 누락

- 위치: `src/save/saveCodec.ts:178`의 `assertGameStateSnapshot`; 소비처 `src/engine/autoplayTimberRecovery.ts:33`–`34`.
- 새 `timberProductionWindow.expansionShortageSinceTick`은 외부 저장 JSON에서 로드되지만 검증되지 않는다. 선언 타입은 number지만 런타임에는 null, 문자열, 객체, 음수 및 현재 tick 이후 값도 통과한다.
- 재현: `fixtures/saves/v4/timber-shortage.save.json`을 복제하고 기존 선택적 checksum을 제거한 뒤 해당 필드를 `null`, `"invalid"`, `{}`, `-1`, `92685`(fixture tick+1)로 각각 교체하여 `decodeSave` 호출. **5/5 모두 accepted=true**, 해당 값이 그대로 복원됐다. checksum은 이전부터 선택적이며 인증 수단이 아니다. 이 검토는 checksum 설계 변경을 요구하지 않는다.
- 영향: `state.tick - since < 2400`에서 null은 0으로, 문자열/객체는 NaN으로 변환된다. 따라서 부족 관측 기간의 조건이 잘못 통과하거나 미래값으로 연기될 수 있다. 다른 자원·인력 조건은 유지된다. 로컬 게임 상태 무결성 문제이며 원격 실행·정보 노출을 주장하지 않는다.
- 수정: 필드가 있을 때 finite nonnegative integer이고 `<= state.tick`인지 검사하여 `SaveFormatError`로 거부한다. v2/v3 migration에서 필드 누락은 그대로 허용하고 관측 이력을 발명하지 않는다. 정상값 roundtrip과 잘못된 타입/범위 거부 회귀를 추가한다.
- 상태: **해결됨.** leader 수정은 존재하는 필드에 `typeof === 'number'`, `Number.isSafeInteger`, `>= 0`, `<= state.tick` 검증을 적용했다. 재검토 시 HEAD는 `d0db74b2cc8d82f6a90e2239c4e3c76f04e6ca03`였으며, 이 수정은 해당 HEAD 위의 작업 트리에서 확인했다.
- 독립 재검증: 동일 실제 `decodeSave` 경로에서 null/string/object/음수/소수/미래 tick 6/6 거부, 0/현재 tick/필드 누락 3/3 허용. `timber-save-boundary-green.log`의 v3 migration·정상 roundtrip·invalid regression **3/3 PASS**도 읽어 확인했다. 기존 v3의 관측 누락 의미는 보존된다.
- 최종 재확인: 수정 커밋 `d9af1f61d4f83ae489989e6a204e8066110cc607`, 두 파일 dirty 없음. `saveCodec.ts` SHA256 `4dc67dc818717fc5b054a7716f5b675b10a1d94c93863cf507ec4a52c67f81aa`; `autoplayTimberSave.test.ts` SHA256 `637e2fa760add7499e93a7523bf2f016a21798eb655499c5d33d313c19d86284`.

## 확인된 경계

1. `operationPaused`는 존재할 때 boolean만 허용한다(`saveCodec.ts:184`). 신규 테스트는 string/number/null/object 거부와 pause/resume 저장 복원을 다룬다. v2→v3 및 v3→v4는 envelope version만 변경하여 기존 재고·참조·누락 기본값을 유지하고, 최종 envelope 검증을 생략하지 않는다.
2. 지정 diff에 인증·네트워크 요청·명령 실행 입력·HTML 삽입·의존성 변경은 없다. 로컬 상태 변화이며 신규 문자열 UI도 React 텍스트로 소비한다. 기존 전체 저장 구조 검증의 포괄적 확장은 범위 밖이다.
3. portable R1 probe 7개는 저장소 상대 import와 합성/정상 엔진 상태를 사용하는 개발 스크립트다. 새 외부 서비스 호출·파일 삭제·동적 eval은 없다. `timber-expansion.ts` CLI tick 숫자는 개발자 입력이며 README는 외부 실행 시간 상한을 명시한다. 제품 입력 경계로 노출되지 않는다.
4. UI proof는 고정 loopback URL과 임시 Chrome profile을 사용한다. `execFileSync('git', argv)`는 shell 문자열을 만들지 않으며 selector/text/state는 JSON serialization을 거쳐 CDP 코드에 넣는다. profile cleanup은 생성한 임시 profile에 한정된다. 실제 사용자 profile을 사용하지 않는다.

## Portable archive / replay harness

- `scripts/autoplaySearchReplay.ts:35`: 저장소의 고정 `slow-inputs.tar.xz`를 `spawnSync('tar', argv)`로 새 `mkdtempSync` 디렉터리에 해제한다. shell interpolation이 없으며 child replay는 25초 timeout을 가진다. cleanup은 `finally`에서 생성한 디렉터리만 제거한다.
- `:39`–`:40`: 선택 fixture의 SHA256을 manifest와 대조한 뒤 실행한다. 실제 fixture JSON은 데이터로 파싱되고 코드로 실행되지 않는다. 출력 경로와 `--case` 경로는 의도적인 개발자 CLI 인수이며 게임 UI/네트워크에 노출된 파라미터가 아니다.
- 실제 아카이브를 **해제하지 않고** tar metadata로 검사: 69개 전부 일반 파일, 절대경로/상위 경로 이동/심볼릭링크/하드링크 없음. manifest 69개 모두 아카이브에 존재. 총 비압축 크기 495,795,949 bytes.
- 검사한 아카이브 SHA256: `8d2ccef7c1e433a998aaf1614544645a8961452bb16b34361e064169f0814144`.
- 현재의 저장소 소유 fixture 위협 모델에서는 보안 차단 없음. 개별 파일 SHA는 해제 후 검사하므로, 이 하네스를 향후 임의 외부 archive 수입 도구로 바꾸려면 해제 전 path/type/size/manifest 검증이 필요하다. 현재 scope의 취약점으로 승격하지 않는다.

## 검증 한계

- 전체 런타임/성능/자연 진행 테스트, 의존성 전수 감사 및 전체 기존 save 검증 감사는 수행하지 않았다.
- archive member별 payload SHA는 하네스가 검증하는 구조임을 확인했지만 이 검토에서 496MB를 모두 읽어 재검산하지는 않았다.
- 검토 이후 커밋 또는 파일이 바뀌면 해당 차이를 재검토해야 한다.
