# Earliest-receipt pause opens chronicle; round-trip gate remains incomplete

Historical original engine2485/productc5d2, toolf1163d1f8. DGX official run engineB-live-manual-early-f1163d1 exited1. Preparation7.7s, wait68.4s, command31.9s. This is independent manual discovery, not current trunk/common answerEffects integration or automatic-delivery acceptance. Product sources/dependencies remain byte-identical to c5d2.

First future receipt h-002663 at40800 has because h-002653/payment_flow(part:true). Normal Pause before/after tick40800, no modal. KeyC opened the chronicle. Full before/after KeyC AND final presentation bytes have identical SHA cdf24d0738fdf670ddf07c42d978cdb73b7ed2af23454697cfbc76208daee3e2. Registry occurrences and decision history were not changed, and no choice was answered/dismissed. Nine focused DGX tests passed. The red test checks new export/admission absence, not a browser regression by itself.

Manual round-trip verified=false: the existing helper tried the 1310 option without scrolling its dropdown, and the covered-control guard stopped it. final.png shows years1300–1305 in the visible dropdown viewport;1310 is below it. This is a harness interaction limit, not demonstrated product inability to discover the receipt. The screenshot already displays the first-market-dues receipt and a causal-decision link, but exact answer→receipt→answer traversal is unverified. Future bounded correction may scroll the option into view normally before retaining the covered-control check; never force-click or bypass the guard.

Direct automatic=false, canonical thread automatic=false, overall valid=false remain unchanged. Early pausing interrupts natural automatic continuation and cannot adjudicate later automatic delivery. Modal-time refusal is separately preserved in ../live-manual-modal.

Raw screenshots: ../replay-captures/engineB-live-manual-early-f1163d1/eb-live-speed/manual-before-keyc.png, manual-after-keyc.png, final.png. Both runtime and cleanup error arrays empty. Unit inactive/dead, owned Vite PID absent, run-CWD processes0, port4302 listener absent were checked after terminal. No pending execution.

Command from clean pinned branch:
```
scripts/remote/run.sh engineB-live-manual-early --heavy --experiment --detach --keep -- env EB_BROWSER_REVISION=f1163d1f8b87303d0f22cadb889bb6526658af42 EB_MANUAL_ON_RECEIPT=1 bash scripts/engineBLiveSpeedManualRun.sh
```

The wrapper fixes input manifest e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d and input ck_evt_005-answer-h-002653.save.json.gz SHA7c01f32f3e48e5cd18229838c322385cb6b48edc6247b5027f19e287b1b31b16. Node24.21.0/Playwright1.62.1, proof-input equality and process-owned localhost port checks remain enforced.


## 영속 원본 보관

실제 게임 재생 PNG·presentation은 기존 재플레이 캡처 분류의 `../replay-captures/`에, 작은 로그·manifest·도구 fixture는 이 보고서 폴더와 `originals/`에 추적 보관한다. 크기 검사나 예외 목록은 바꾸지 않았다. JSON·로그는 gzip으로 무손실 압축했으며 `provenance.json.gz`의 각 `files` 항목에 원래 SHA·크기와 보관 경로·압축 SHA가 있다. 검토에는 임시 작업 디렉터리가 필요 없다.


영속 화면 링크: [final](../replay-captures/engineB-live-manual-early-f1163d1/eb-live-speed/final.png) · [manual-after-keyc](../replay-captures/engineB-live-manual-early-f1163d1/eb-live-speed/manual-after-keyc.png) · [manual-before-keyc](../replay-captures/engineB-live-manual-early-f1163d1/eb-live-speed/manual-before-keyc.png)
