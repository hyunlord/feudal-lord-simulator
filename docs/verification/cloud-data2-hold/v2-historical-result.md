# CLOUD DATA2 actual v2

**FAIL — zoom.6 Canvas transform Float32 표현을 exact-double oracle이 거부. 자동 재시도0.**

단일 `astra-cloud2-data-v2-66b8e1e`, HEAD `66b8e1ef2d5e4e9ec8d610cc21c583fbfd56bf6b`, exit1, 10뷰/회수75파일. v1 실패/pins/raw 보존. 제출 전 heavy1(infra trend)/대기0, slot2/2, port4303, sync50.1s/prepare7.0s/wait0s/command175.4s.

A/A10 일치, positive8 CORE 대비 변화, negative2 fullRGBA 동일. full identity는 expected newURL 차이 외 동일하고 raw cloud descriptors/일정/크기는 그대로다. 모든 양성16 open에 new2 frozen-window paint 증가와 실제 native blit 기록이 있다. v1의 late hook 우회는 해결됐다. 그러나 zoom.6 4뷰×2open에서 transform 기대 double과 Canvas Float32 표현이 달라 총8오류. zoom1 양성4와 음성2에는 오류가 없다.

실제 transform `[0.6000000238418579,0,0,0.6000000238418579,640,-214.39999389648438]`, 기대 `[0.6,0,0,0.6,640,-214.39999999999998]`. 모든20 trace집합을 독립 재검사하여 source/crop/destination/alpha/blend/dimensions/nowMs는 exact 일치, transform6성분은 기대값의 Math.fround와 exact 일치함을 확인했다. 임의 epsilon이나 관측값에서 기대값을 만드는 oracle은 사용하지 않았다. 이 사후 진단으로 원래 pass=false/exit1을 PASS로 바꾸지 않는다.

pre/post 및 local fullfreeze PASS: tracked26887/input27342/export27343/LFS6384. 기존 외부 dependency bytes와 runtime/binary 보존, 허용 cache추가만 확인했다. raw75 SHA·all20 Float32 성분 비교·A/B/A-A는 동반 JSON 및 diagnostic-recheck에 있다.

v3 제안은 transform 성분에만 수학적 double 또는 exact Math.fround를 허용하는 좁은 oracle 변경이다. source/crop/target/.12/multiply·상태·카메라·zoom·일정은 exact 유지하며 별도 독립검토와 실제 실행 승인이 필요하다. 본 작업에는 입력/제품/원본/알파/CSV/ledger 수정과 재실행이 없다. 가독성/성능도 미통과다.
