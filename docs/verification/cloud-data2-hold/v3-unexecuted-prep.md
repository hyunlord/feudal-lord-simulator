# CLOUD DATA2 v3 exact Float32 oracle 준비

**준비 PASS / 독립검토 필요 / 실제 재제출0. v1·v2 FAIL은 그대로다.**

HEAD `66b8e1ef2d5e4e9ec8d610cc21c583fbfd56bf6b`. v2 raw20open의 모든 trace를 검사하여 차이는 행렬6성분의 정확 Math.fround 표현만으로 설명됨을 확인했다. 다른 미설명 source/crop/destination/alpha/blend/time 차이는0이다.

v3은 transform6성분 각각에 mathematical expected double 또는 exact Math.fround(expected)만 허용한다. arbitrary epsilon/tolerance 없음. 관측 transform에서 camera/rect를 역산하지 않고 같은 승인view/zoom으로 기대값을 계산한다. source/crop/destination/.12/multiply/dimensions/nowMs는 exact 비교 그대로다. 별도 v3 output/wrapper 경로 외 동작 변경은 이 oracle 하나다.

기존14 + 신규3 =17/17 PASS. 신규시험은 actual v2 모든20trace집합 수용, demonstrated float32 수용, 6성분 각각1e-10 drift/scale/translation/shear·NaN/Infinity/잘못된길이 거부, crop/destination/alpha/blend 변경 거부를 확인한다. guard6/6 PASS(skip0). product tracked clean, 상태9/views/두observer byte동일, v2 pinned27342 및 v1/v2 실패raw75+75 SHA 보존.

freeze `0cad800795fad49a26eed2fa78ccffaae26b8521d99fa13f6dc40af891d61bda`: tracked26887/input27518/export27519/LFS6384. 정확 diff는 동명patch, 입력SHA는 JSON.

승인 후 예정 명령:
```
node_modules/.bin/tsx .omo/evidence/cloud2-data-v3-runtime-run.mjs 0cad800795fad49a26eed2fa78ccffaae26b8521d99fa13f6dc40af891d61bda
```

이번에는 DGX/브라우저/제품/CSV/ledger/원본/알파/commit 변경0. 실제 v3 등록·가독성·성능 PASS 주장이 아니다. 독립검토 뒤 부모의 단일실행 승인을 기다린다.
