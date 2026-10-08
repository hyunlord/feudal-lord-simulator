# Engine B → 엔진: EB-SLOT 공식 계약 채택 검토

관문: 격리 가지의 실제 엔진 연결 실증 24/24 통과(Mac). 공식 채택과 본선 병합은 미실행.

실증 기준 `8383f8470`, 가지 `codex/engine-b-slot-prototype`, 폴더 `/Users/rexxa/fls-astra-engineB-slot-prototype`. 코드와 검증은 이 가지에만 있다. 본선으로 옮길 대상은 이 요청과 [계약 후보](../design/module-state-contract.md) 문서뿐이다.

검토할 고정 커밋: `938f2f492a4cef74833913ac6e8758932112dd72`. 주 작업 가지에는 위 두 문서만 복사했으며 시제품의 코어·저장·원장·모듈·시험 코드는 합치지 않았다. 이 문서의 게시만으로 공식 슬롯 채택이 되는 것은 아니다.

## 필요한 결정

1. `GameState.modules`의 모듈 ID별 `{version, packId, packVersion, data}` 슬롯 및 저장 전체 판과 모듈 판의 분리.
2. 공식 팩/모듈 등록부, 지원 API 판·의존성·이행 순서, 미확인 모듈/판 오류 처리. 실증의 `core/prototype-1`은 공식 본편 팩 판이 아니다.
3. 소송 단계의 실제 비용/판결 앞 `continue/defer/terminate` 갈고리와 권원 변경 없는 합의종결 의미.
4. 실제 분기 수입 게시 직전의 분할 갈고리 및 지속 예치 잔액. 금고 차감이나 annualValue 추정으로 수입 예치를 대체하지 않는다.
5. 만료·중재자 사망·기존 소송 외부 종결·미결 예치·모듈 제거 때의 후속 처리 계약. 현재 예치금은 보존하며 만료/사망 뒤 새 양측 반환 동의가 있으면 한 번 해제한다. 자동 처분하지 않는다.

공식 등록·갈고리 순서·충돌 원자적 거부·모듈별 이행·명령/읽기 API·종료 표지 압축의 구체안은 계약 후보 1.1~1.3절에 적었다. 이 부분은 단일 135 실증을 넘어선 **제안**이며 구현 통과로 세지 않는다.

## 실제로 연결한 곳

| 표면 | 실증 |
|---|---|
| `src/engine/engine.types.ts` | 선택적 버전 슬롯 |
| `src/engine/modules/` | 135 중재 후보의 상태·명령·읽기·검증, 정해진 호스트 갈고리 |
| `src/engine/estateSuits.ts` | 계절 진행 앞 유예/종결, 읽기 모델 기한 일치 |
| `src/engine/stewardship.ts` | 실제 `reported`의 cash/restricted 분할 |
| `src/ledger/ledger.ts`, `ledger.types.ts`, `ledgerValidation.ts` | 선택적 fundId 보존과 형식 검증; 기존 플래그 없는 원장은 동작 보존 |
| `src/save/saveCodec.ts` | 알 수 없는 활성 모듈·판·자료·끊어진 참조 거부 |
| `src/save/migrations/v54ToV55.ts` | 모듈 없는 과거 상태를 그대로 유지 |
| `src/save/schemaFingerprint.v55.json` | 후보 저장 판의 형식 지문 |
| `tests/mediationPrototype.test.ts`, `tests/moduleSlotPrototype.test.ts` | 모의 엔진 없이 실제 전이·저장·압축 통합 시험 |

## 실행 증거

- `node --import tsx --test tests/mediationPrototype.test.ts tests/moduleSlotPrototype.test.ts tests/suitActions.test.ts tests/saveMigrationBrowserSafe.test.ts`: Mac **24/24**.
- `npm run typecheck`: Mac 통과.
- `npm run save:fingerprint`: Mac 통과, v55 `99c2fa02ca7b…`, 792 경로. 기존 판 지문은 보존.
- 대상 변경 파일 ESLint: Mac 통과, 억제 추가 없음.
- `tests/saveSchemaFingerprint.test.ts`, `tests/saveSchemaMigration.test.ts`: Mac **5/5** 통과.
- `tests/ledger.test.ts`: Mac **10/10** 통과(기존 고정 짧은 회귀 포함, 약 11초). 전체/장기 판 실행 아님.
- `VITE_CONFIG_NATIVE_IGNORE_WARNING=true npm run build`: Mac 통과(tsc + Vite, 종료 코드 0). 최초 실행은 기존 keyart 원본의 Git LFS 포인터로 실패했으며, 필요한 원본을 로컬 LFS 캐시에서 복원한 뒤 통과했다. 새 아트 생성이나 원격 다운로드는 하지 않았다. 기존 번들 크기/플러그인 시간 경고는 남는다.
- 최종 합동 재실행: 위 24개와 저장 지문/이행 5개를 한 명령으로 실행하여 **29/29**, 실패 0(약 3.8초).

전용 시험은 제안만으로 유예하지 않음, 독립 두 동의, 중복 명령 무효과, 중재자 부적격/사망, 실제 영주 원고 patronage, 기한 만료, 종결 뒤 권원/점유 보존, 수입 보존, 예치 별도 동의, 장부 압축 뒤 저장 복원/단 한 번 해제를 입증한다. 시험용 상태 준비와 계절 경계 호출을 사용했으며 자연 발생 빈도나 플레이어 노출을 측정하지 않았다.

## B가 넘기지 않는 범위

135 정본/활성 목록은 수정하지 않았다. 전체 001–200을 다시 켜거나, 195 source_date 등 편집 차단을 해제하지 않았다. 모듈 공식 채택 전에는 본선 슬롯·저장 버전·코어 틱을 수정하지 않는다. 렌더/UI·팩 로더·NPC 동의 생산자·채권/후견/문서 계약·재판에 의한 강제 예치 처분은 완료 범위가 아니다.

EXT-3 전체 팩 로더 완료나 EXT-4 전체 엔진 모듈화라고 부르지 않는다. 이 실증은 계약이 채택되면 B가 맡을 모듈과 엔진이 맡을 저장/전이 이음새를 실제 함수로 검증한 후보다. 예치 게시만 일반 플래그 `retainFundIdentity`로 fundId를 장기 아카이브까지 보존하고, 저장 시 그 fundId의 합을 계약 잔액과 대사한다. 무관한 제한 기금의 돈으로 잔액을 받치는 저장은 거부한다.

원칙 점검: P-D1 선택은 실제 대상의 전이를 만들며 제안/한쪽 동의를 성공 합의로 세지 않음. A3 같은 소송·예치 계약의 양측에게 별도 동의 요구. A4 기한 읽기와 실제 유예 일치. A5 상태와 금전 잔액을 저장/압축 뒤 보존. A7 수치·동의 규칙은 게임 실증이며 역사상 보편 법률이라고 주장하지 않음.

독립 재검토: 만료 예치의 영구 동결, 무관한 restricted 기금 대사, 종료된 과거 예치의 후속 차단 세 지적을 회귀시험으로 재현한 뒤 수정했다. 재검토자는 전용+ledger **30/30**을 별도로 확인했고, 두 보존 기금과 기존 murage를 장기 아카이브 두 번에 걸쳐 대조하여 서로 섞이지 않음을 확인했다.
