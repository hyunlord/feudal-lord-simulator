# EB-WEIGHT: 실제 수동 답 → 결과 → 원인 왕복

관문: **수동 왕복 한 사례 통과, 자동 전달과 전체 관문은 미달**. DGX `engineB-live-manual-visible-344c3d9`, 도구 `344c3d9480331c8d49b2f19d1bb0aa54ce4911cd`. 엔진2485af4·제품c5d2b35를 고정한 역사판 후속이다. 현재 본선이나 공통 `answerEffects` 통합 화면 검증이 아니다. 제품 src/package/lock diff0.

## 실제 동작

1. 기존 seed1 답 `h-002653`, tick40015의 정확한 저장을 그대로 불러 정상10배속 진행했다.
2. 정확한 미래 결과 `h-002663`이 tick40800에 발생했다. `because`는 `h-002653/payment_flow`, `part:true`다.
3. 그 최초 관측 때 정상 정지 인장을 눌렀다. 전후 tick40800, 열린 모달0이다. 이 조기 정지는 자동 전달 이후의 자연 진행을 대신하지 않는다.
4. 정상 KeyC로 연대기를 열고 중요도/1310년 필터를 골랐다. 정상 스크롤과 기존 중심점 hit-test를 통과한 입력만 썼다. 강제 클릭·가림 검사 완화가 없다.
5. 답 h-002653 선택 → 정확한 결과 링크 h-002663 선택 → 원인 링크 h-002653 복귀를 실제 선택 DOM ID와 각 화면으로 확인했다. `manualDiscovery.verified:true`다.
6. KeyC 전/후·답·결과·복귀·최종 **6개 전체 presentation JSON 바이트 SHA가 모두 동일**하다: `cdf24d0738fdf670ddf07c42d978cdb73b7ed2af23454697cfbc76208daee3e2`. tick·registry occurrence·답변 기록을 바꾸지 않았다. proof port의 presentation 동일성이지 원시 browser store 관측은 아니다.

## 자동 결과와의 구분

`automaticVisible:false`, `automaticThreadVisible:false`, 원래 전체 `valid:false`, 종료1을 그대로 보존한다. 수동 성공을 자동 성공으로 합산하지 않는다. 8bd의 자동 흐름은 중대 결정까지 관측한 별도 실패이며, 이번 판은 최초 결과에서 정지한 수동 한 사례다. 전체56사건·163선택, 청지기10회, 네이티브 포인터 사용성/실시간 성능의 통과가 아니다.

실질 결정이 열린 tick41149에서 KeyC가 열리지 않는 결과는 ../live-manual-modal 에 별도 보존했다. 모달 배타 동작을 수동 탐색의 일반 실패로 확대하지 않는다. 이전 dropdown/답행 스크롤 실패도 ../live-manual-early 와 ../live-manual-scroll 에 원문 그대로 남았다.

## 검증과 정리

- DGX 집중 시험9/9. baseline red는 새 대상 선택 export 부재를 잡은 시험이며 브라우저 회귀 자체의 증명은 아니다.
- 실제 별도 브라우저 context의 스크롤 fixture2/2: 화면 아래 버튼 scrollTop0→150, 일부 잘린 버튼240→260, 같은 공통 helper의 정상 클릭 확인. 게임 context와 분리했다. fixture를 게임 결과로 세지 않는다. bbox JSON·overlay negative 시험은 이번 범위에 없다.
- 준비7.9초·대기2.0초·명령34.9초. 런타임/정리 오류0. unit inactive/dead, Vite PID1989431 없음, 해당 run-CWD 프로세스0, port4304 리스너 없음.
- P-C3: 정확한 답·결과·원인 ID 왕복만 주장한다. `part:true` 결과를 유일 원인으로 바꾸지 않는다. P-T1: 실제 영주 결정을 임의로 답하거나 닫지 않았다. P-D2: 효과를 만들기 위한 상태/처리 기록 추가가 없다.

## 원본과 재현

원본은 `provenance.local`의 `eb-live-speed/` 아래에 있다. `manual-answer.png`, `manual-receipt.png`, `manual-return.png`가 실제 왕복 화면이다. `scroll-fixture-*-before/after.png`는 별도 도구 시험이다. 원문 manifest 압축과 전체 파일 해시·크기는 이 폴더에 보존했다. 원문 SHA `e04b620e7d36404f4f874e8530c2483a9ee51dac1fa712022f44684bca0867a7`.

```
scripts/remote/run.sh engineB-live-manual-visible --heavy --experiment --detach --keep -- env EB_BROWSER_REVISION=344c3d9480331c8d49b2f19d1bb0aa54ce4911cd EB_MANUAL_ON_RECEIPT=1 bash scripts/engineBLiveSpeedManualRun.sh
```

입력 manifest `e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d`; gzip `ck_evt_005-answer-h-002653.save.json.gz` SHA `7c01f32f3e48e5cd18229838c322385cb6b48edc6247b5027f19e287b1b31b16`. Node24.21.0·Playwright1.62.1·1280×800/DPR1. 입력 동등성·깨끗한 소스·소유 localhost 프로세스 검사는 그대로 유지한다.
