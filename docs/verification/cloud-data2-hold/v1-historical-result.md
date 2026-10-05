# CLOUD DATA2 실제 v1 — 실패 영수증

**FAIL: DATA native blit 추적기 설치 시점 결함. 재시도0 / 원본 실행 보존 / 승격 금지.**

단일 official heavy/detach/keep `astra-cloud2-data-v1-66b8e1e`, actual HEAD `66b8e1ef2d5e4e9ec8d610cc21c583fbfd56bf6b`, freeze `fa59cbb097d928fe0180deed7b736aa646ca7d54c99846c8ed5589ff5b2afdb4`. exit1, actual10뷰·회수75파일. 직전 status heavy0/대기0, slot1/2 port4300, sync30.4s/prepare7.0s/wait0s/command164.5s.

## 실제 관측과 실패 경계

- A/A10 일치, CORE→DATA 양성8 전체픽셀 변화, 음성2 전체RGBA 동일. 허용 expectedRequests 차이 외 full identity와 raw descriptor/common fields 비교는 로컬 회수 후 통과했다.
- 양성8 × first/repeat16에서 new2 request/decode512×256/기존 frozen-window paint 증가가 확인됐다. old2 settled-window 증가는0. 음성2는 all4 cumulative paint 부재 및 grass control 검사가 오류 없이 끝났다.
- 그러나 추가 cloudDataTrace가 모든 open에서 빈 배열이다. 양성16 open에 `DATA pair/source/rect/transform/opacity native trace mismatch`가 각각1개, 총16오류. capture pass=false, wrapper checkPass=false이다. 따라서 실제 exact rect/transform/opacity 관문을 통과했다고 주장하지 않는다.
- pre/post full source/LFS/export/HEAD clean PASS, 회수 후 local freeze 재검증 PASS. external 기존 dependency5488 bytes 보존 및 허용 Vite/keyart 추가만 발생했다. 상세는 JSON; 전체 external이 byte-identical했다는 뜻은 아니다.

## 확인된 원인과 좁은 수정 제안

`scripts/renderCommitProbe.mjs:88`의 phase10-proof=1로 시작한다. `src/testing/phase10ProofRuntime.ts:169`–176은 render-stages=0이 아니면 stage probe를 설치한다. `src/render/renderStageProbe.ts:115`–127은 원래 메서드를 잡아 context own drawImage를 만든다. 현재 DATA 추적기는 page open/readiness 이후 prototype.drawImage를 교체하므로 이 own method 아래로 연결되지 않는다. 기존 init paint observer는 own wrapper가 잡은 원래 체인에 남아 paint 증가를 계속 기록한다.

실제 installRenderStageProbe 함수를 가져온 Node boundary 재현: own drawImage=true, late prototype observer 기록0/native call1; stage dispose 후 동일 호출은 기록1. native 자료와 source 연결을 함께 확인했다. URL 불일치·소스 미로딩은 new2 실제 decode/frozen paint로 배제되고, freeze clear 이후 호출이 없었다는 가설도 양수 증가로 배제된다.

수정 제안(아직 적용하지 않음): supplementary observer를 context.addInitScript로 proof 설치 전에 설치. 처음엔 disarmed로 원래 paint를 전달만 하고, 같은 freeze 평가에서 clear+arm하여 초기 로딩의 가변시간 trace/overflow를 피한다. 기존 cloudPaintObserver는 byte 그대로. 제품/캡처 상태/clock/등록값을 바꾸지 않는다. meaningful guard test는 실제 installRenderStageProbe가 observer 설치 뒤 context own wrapper를 만들어도 freeze 이후 두 관측이 모두 기록됨을 확인하고, 기존 late-install 재현을 음성 회귀로 보존한다. receiver/args/return/throw 및 disarmed 호출0기록도 검사한다. 독립 검토 후 별도 승인 전에는 실행하지 않는다.

## 한계 및 원본

수치 변화와 draw lineage는 native 가독성 PASS가 아니다. fixed .12 신그림 가시성·B 오른쪽 경계·지붕/수면/사람 가림은 독립 시각 관문이며, 실제 성능 비교도 미통과다. 호스트 command 시간은 동결된 JS frame-performance 측정이 아니다.

로컬 첫 diagnostic import는 stdin argv 부재로 heavy guard가 거부(exit3)했으며 브라우저는 실행되지 않았다. 명시적 stdin 프로그램 `node --import tsx --input-type=module -`에서 순수 파일 비교만 수행했다. FLS_ALLOW_LOCAL 미사용.

raw75 SHA는 동반 JSON에 전부 있다. `.remote-runs/astra-cloud2-data-v1-66b8e1e`와 kept remote 원본은 유지한다. 제품·driver·freeze·PNG·provenance·ledger 수정0, commit0, 재제출0.

|뷰|DATA native|CORE native|
|---|---|---|
|summer-normal-z1-t0|[after](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/results/summer-normal-z1-t0.png)|[before](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/baseline/results/summer-normal-z1-t0.png)|
|summer-normal-z1-t5000|[after](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/results/summer-normal-z1-t5000.png)|[before](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/baseline/results/summer-normal-z1-t5000.png)|
|summer-normal-z06-t0|[after](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/results/summer-normal-z06-t0.png)|[before](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/baseline/results/summer-normal-z06-t0.png)|
|summer-normal-z06-t5000|[after](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/results/summer-normal-z06-t5000.png)|[before](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/baseline/results/summer-normal-z06-t5000.png)|
|winter-normal-z1-t0|[after](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/results/winter-normal-z1-t0.png)|[before](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/baseline/results/winter-normal-z1-t0.png)|
|winter-normal-z1-t5000|[after](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/results/winter-normal-z1-t5000.png)|[before](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/baseline/results/winter-normal-z1-t5000.png)|
|winter-normal-z06-t0|[after](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/results/winter-normal-z06-t0.png)|[before](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/baseline/results/winter-normal-z06-t0.png)|
|winter-normal-z06-t5000|[after](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/results/winter-normal-z06-t5000.png)|[before](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/baseline/results/winter-normal-z06-t5000.png)|
|spring-wet-negative-z1-t0|[after](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/results/spring-wet-negative-z1-t0.png)|[before](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/baseline/results/spring-wet-negative-z1-t0.png)|
|summer-off-negative-z1-t0|[after](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/results/summer-off-negative-z1-t0.png)|[before](/Users/rexxa/fls-astra-renderB-cloud-core/output/art-architecture/cloud2-data-v1/baseline/results/summer-off-negative-z1-t0.png)|
