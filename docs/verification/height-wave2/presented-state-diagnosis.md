# Wave2 브라우저 상태 SHA 차이 — 읽기 전용 진단

**원인 확인: proof.state()는 저장된 엔진 상태가 아니라 장식 주민이 추가된 렌더 상태를 반환한다.** 기존 92뷰의 모든 입력에 현재 실제 `presentedState` 함수를 로컬 Node로 적용하니 브라우저 SHA와 **92/92 정확히 일치**했다. 입력 저장은 92/92 불변이고 달라진 최상위 필드는 `walkers` 하나였다. 원래 SHA가 달랐던 46뷰에서만 장식 주민이 추가된다. `uiDismissal=0`과 모순되지 않는다.

## 실제 호출 경로

확인 HEAD: `1f4904a4bf8ed35d23aa410bc75db51660df99ba`, 작업 폴더 `/tmp/astra-height-wave2-install`.

1. `scripts/sceneInjection.mjs:32-33`: 봉투 입력을 `decodeSave(...).envelope.state`로 읽는다.
2. `src/state/gameStore.ts:255-257`: 저장 상태를 initialState/stateRef로 보관한다. 속도 초기값은 0이고 캡처의 `run:false`는 1배속을 누르지 않는다.
3. `src/render/useGameCanvasRuntimeRefs.ts:20,36`: 캔버스 stateRef는 **presentedState(store.getState())**다.
4. `src/render/presentation/presentedState.ts:14-17` → `residentWalkerState.ts:9-11`: 주민이 없으면 원본 그대로, 있으면 `{...state, walkers:[...state.walkers,...residents]}`를 반환한다. 저장 상태를 수정하지 않는다.
5. `src/render/useGameCanvasRuntime.ts:137`: 이 캔버스 stateRef를 proof 설치 함수에 넘긴다.
6. `src/testing/phase10ProofRuntime.ts:231`: proof.state()는 바로 그 stateRef.current를 반환한다.
7. 캡처는 `.omo/height-wave2-proof/capture.mjs`에서 이 값을 JSON.stringify하여 stateSHA256으로 저장했다. 필드명만으로 원본 저장 SHA라고 해석하면 안 된다.

## 증거와 가설 구분

- codec·키 순서: 입력과 로컬 decode SHA가 이미 같음. 추가 직렬화 보정 없이 실제 presentation 함수 한 번으로 전체 브라우저 해시가 맞는다.
- 일시정지 중 UI 명령·틱 진행: 원래 틱에서 UI 명령 없이 전체 해시를 재현했다. 이번 46개 차이를 설명할 필요가 없는 가설이다.
- 장식 주민 추가: 92개 전체 해시 재현 및 원본 JSON 불변으로 확인했다. 새 배우나 군사 사실을 추가한 작업이 아니라 기존 MOVE-1 표시 동작이다.

짝별 raw 저장 해시 비교와 presented state 해시 비교를 구분해 보고하면 된다. 기존 before/after의 rendered state 해시가 서로 같은지는 소유자의 완료된 쌍 비교로 확인할 항목이다. 이번 진단은 before 92뷰에 관한 것이며 진행 중 after 실행의 결과를 미리 통과로 판정하지 않는다. 브라우저의 전체 state 덤프가 저장되지 않았으므로 필드별 browser dump 차분이라고 부르지 않는다. 실제 제품 함수의 예상 전체 JSON SHA가 기존 브라우저 해시와 일치하는 재현이다.

## 재현 방법

새 파일이나 브라우저 없이 해당 checkout에서 `node --import tsx --input-type=module`로 다음을 호출했다.

```js
const source = loadSaveFile('.omo/height-wave2-proof/states/' + row.id + '.json');
const before = JSON.stringify(source);
const presented = presentedState(source);
const sha = createHash('sha256').update(JSON.stringify(presented)).digest('hex');
// 92/92 sha === row.runtimeHash
// 92/92 before === JSON.stringify(source)
// changed keys: walkers only
```

입력·예상·실제 SHA, 원본/표시 walker 수, 추가된 기존 주민 ID, source SHA와 가설 판정은 `/tmp/astra-wave2-state-hash-diagnosis.json`에 있다. 제품·하네스 편집, 새 브라우저, 새 DGX 실행은 없었다. Graft 탐색은 소스와 대조했고 탐색 도구의 자동 로컬 그래프 갱신만 발생했다.
