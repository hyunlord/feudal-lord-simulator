# 도시 합성 독립 시각 검토

**판정: PASS_STATIC_COMPOSITION — 실제 접점 배치 재검사 통과.** 외부 사람의 승인 아닌 독립 AI 시각 검토다.

실제 1380년 봄 런타임 원본 1장, 최종 `after-01..10-z1.jpg` 10장과 `after-01..10-z06-proxy.jpg` 10장을 모두 직접 열었다. 추가한 60개 배치는 각각 확대 잘라보기로도 확인했다. 원본은 과거 실행 캡처이고, 추가 소품은 오프라인 합성이다. 0.6은 60% 크기 축소본이다.

## 발견한 문제와 수정 확인

|초기 위치|문제|수정·재검사|
|---|---|---|
|A4 (465,573)|02 뒤공방의 윗보와 06 대장간 차양이 방앗간 아래 벽/기단에 붙어 보임.|A4 (465,600). 10장 모두 풀밭 여백 확인.|
|A7 (1140,869)|10장의 마당 소품이 남동 밭의 울타리·작물 경계에 걸침. 02/06/08 차양은 특히 뚜렷함.|A7 (1170,910). 10장 모두 밭과 분리. 지도 가장자리 밖으로 잘린 소품 없음.|

초기 불합격 이미지는 해시 저장 전에 교체되었다. 아래 해시는 최종 검토 파일에만 해당한다.

## 최종 판단

- 60개 배치에서 기존 벽·지붕·인물·작물과의 겹침이 보이지 않는다. A4/A7은 풀밭에서 독립 지지된다.
- Front A는 작은 집 앞 흙마당/길 연결부 가까이에 있으나 그림상 건물이나 사람을 가리지 않는다. 이는 통행·충돌 허가가 아니다.
- Front B는 최종 (1523,474)로 옮겨 나무줄기와 분리했다. 실제 접점 적용 직후 (1511,452)에서 03/06이 줄기에 붙었고, y474 이동 후 04/07에 접선이 남아 x1523으로 추가 이동했다. 최종 10개 확대 영역 모두 재검사하여 해소를 확인했다.
- 약19px의 역사 캡처 사람 자에 대해 작업대·통·약28px 표지의 크기는 납득 가능하다. 따뜻한 나무색과 상부 밝음은 배경과 크게 어긋나지 않는다.
- 0.6 축소에서 6개씩 흩어진 배치는 혼잡하지 않다. 마당의 큰 윤곽과 표지는 남지만 직업별 작은 그림을 확실히 식별할 수는 없다.

## 접점 최종 재검사

실제 지면 접점 등록 후 전체 20장과 전면·거리 40개 확대 영역을 직접 재검토했다. 마지막 Front B 위치 수정 후 10개 해당 확대 영역을 다시 확인했다. 원본 발점은 `provenance/asset_anchors.json`, 합성의 최종 상자는 JSON 보고서에 함께 기록했다. 대장간 여름 점토기와 지붕 최종본의 06페이지 1.0·0.6 이미지와 마당 A/B 확대 영역을 추가로 직접 확인했다. 기와 크기·밝기는 배경과 무리 없고, 지주에 지지되며 건물·밭·길과의 분리가 유지된다. 겨울 B 정리로 공통 계절 크롭이 바뀐 최종 여름 B도 06페이지 1.0·0.6·B 확대 영역에서 다시 확인했다. 건물·밭·길과의 간격, 지면 지지, 기와 크기·밝기에 새 문제는 보이지 않는다. 겨울 그림 자체는 이 도시 검토 범위 밖이다.

## 60개 개별 배치 확인

|페이지|ID|발점|정적 겹침|관찰|
|---:|---|---|---|---|
|01|`yard_street_front_shop_a_summer`|[465, 600]|PASS|방앗간·길과 떨어진 잔디. 수정 후 벽/지붕/인물/밭 겹침 보이지 않음.|
|01|`yard_street_front_shop_b_summer`|[1170, 910]|PASS|밭과 곡창 아래 잔디. 수정 후 울타리·작물과 분리, 지도 가장자리 안쪽에 전부 남음.|
|01|`front_butcher_a`|[860, 804]|PASS|남쪽 작은 집 앞 흙마당. 집·인물·작물 줄과 분리. 길 연결부의 소품으로 보이며 통행 가능 여부는 미검증.|
|01|`front_butcher_b`|[1523, 474]|PASS|동쪽 길 북쪽 풀밭. 최종 (1523,474)에서 나무줄기와 분리, 벽/지붕/인물/밭 겹침 보이지 않음.|
|01|`street_baker`|[716, 373]|PASS|북서 넓은 흙광장. 성벽·지붕·기존 인물과 분리, 넓은 보행 여백 유지.|
|01|`street_brewer`|[849, 334]|PASS|곡창 북서 흙광장. 성벽·곡창·인물과 분리, 표지의 바닥 지지 구조 보임.|
|02|`yard_rear_workshop_a_summer`|[465, 600]|PASS|방앗간·길과 떨어진 잔디. 수정 후 벽/지붕/인물/밭 겹침 보이지 않음.|
|02|`yard_rear_workshop_b_summer`|[1170, 910]|PASS|밭과 곡창 아래 잔디. 수정 후 울타리·작물과 분리, 지도 가장자리 안쪽에 전부 남음.|
|02|`front_tailor_a`|[860, 804]|PASS|남쪽 작은 집 앞 흙마당. 집·인물·작물 줄과 분리. 길 연결부의 소품으로 보이며 통행 가능 여부는 미검증.|
|02|`front_tailor_b`|[1523, 474]|PASS|동쪽 길 북쪽 풀밭. 최종 (1523,474)에서 나무줄기와 분리, 벽/지붕/인물/밭 겹침 보이지 않음.|
|02|`street_butcher`|[716, 373]|PASS|북서 넓은 흙광장. 성벽·지붕·기존 인물과 분리, 넓은 보행 여백 유지.|
|02|`street_miller`|[849, 334]|PASS|곡창 북서 흙광장. 성벽·곡창·인물과 분리, 표지의 바닥 지지 구조 보임.|
|03|`yard_large_yard_a_summer`|[465, 600]|PASS|방앗간·길과 떨어진 잔디. 수정 후 벽/지붕/인물/밭 겹침 보이지 않음.|
|03|`yard_large_yard_b_summer`|[1170, 910]|PASS|밭과 곡창 아래 잔디. 수정 후 울타리·작물과 분리, 지도 가장자리 안쪽에 전부 남음.|
|03|`front_shoemaker_a`|[860, 804]|PASS|남쪽 작은 집 앞 흙마당. 집·인물·작물 줄과 분리. 길 연결부의 소품으로 보이며 통행 가능 여부는 미검증.|
|03|`front_shoemaker_b`|[1523, 474]|PASS|동쪽 길 북쪽 풀밭. 최종 (1523,474)에서 나무줄기와 분리, 벽/지붕/인물/밭 겹침 보이지 않음.|
|03|`street_innkeeper`|[716, 373]|PASS|북서 넓은 흙광장. 성벽·지붕·기존 인물과 분리, 넓은 보행 여백 유지.|
|03|`street_tailor`|[849, 334]|PASS|곡창 북서 흙광장. 성벽·곡창·인물과 분리, 표지의 바닥 지지 구조 보임.|
|04|`yard_dirty_yard_a_summer`|[465, 600]|PASS|방앗간·길과 떨어진 잔디. 수정 후 벽/지붕/인물/밭 겹침 보이지 않음.|
|04|`yard_dirty_yard_b_summer`|[1170, 910]|PASS|밭과 곡창 아래 잔디. 수정 후 울타리·작물과 분리, 지도 가장자리 안쪽에 전부 남음.|
|04|`front_carrier_a`|[860, 804]|PASS|남쪽 작은 집 앞 흙마당. 집·인물·작물 줄과 분리. 길 연결부의 소품으로 보이며 통행 가능 여부는 미검증.|
|04|`front_carrier_b`|[1523, 474]|PASS|동쪽 길 북쪽 풀밭. 최종 (1523,474)에서 나무줄기와 분리, 벽/지붕/인물/밭 겹침 보이지 않음.|
|04|`street_weaver`|[716, 373]|PASS|북서 넓은 흙광장. 성벽·지붕·기존 인물과 분리, 넓은 보행 여백 유지.|
|04|`street_smith`|[849, 334]|PASS|곡창 북서 흙광장. 성벽·곡창·인물과 분리, 표지의 바닥 지지 구조 보임.|
|05|`yard_nuisance_yard_a_summer`|[465, 600]|PASS|방앗간·길과 떨어진 잔디. 수정 후 벽/지붕/인물/밭 겹침 보이지 않음.|
|05|`yard_nuisance_yard_b_summer`|[1170, 910]|PASS|밭과 곡창 아래 잔디. 수정 후 울타리·작물과 분리, 지도 가장자리 안쪽에 전부 남음.|
|05|`front_fuller_a`|[860, 804]|PASS|남쪽 작은 집 앞 흙마당. 집·인물·작물 줄과 분리. 길 연결부의 소품으로 보이며 통행 가능 여부는 미검증.|
|05|`front_fuller_b`|[1523, 474]|PASS|동쪽 길 북쪽 풀밭. 최종 (1523,474)에서 나무줄기와 분리, 벽/지붕/인물/밭 겹침 보이지 않음.|
|05|`street_carpenter`|[716, 373]|PASS|북서 넓은 흙광장. 성벽·지붕·기존 인물과 분리, 넓은 보행 여백 유지.|
|05|`street_shoemaker`|[849, 334]|PASS|곡창 북서 흙광장. 성벽·곡창·인물과 분리, 표지의 바닥 지지 구조 보임.|
|06|`yard_forge_a_summer`|[465, 600]|PASS|방앗간·길과 떨어진 잔디. 수정 후 벽/지붕/인물/밭 겹침 보이지 않음.|
|06|`yard_forge_b_summer`|[1170, 910]|PASS|밭과 곡창 아래 잔디. 수정 후 울타리·작물과 분리, 지도 가장자리 안쪽에 전부 남음.|
|06|`front_cooper_a`|[860, 804]|PASS|남쪽 작은 집 앞 흙마당. 집·인물·작물 줄과 분리. 길 연결부의 소품으로 보이며 통행 가능 여부는 미검증.|
|06|`front_cooper_b`|[1523, 474]|PASS|동쪽 길 북쪽 풀밭. 최종 (1523,474)에서 나무줄기와 분리, 벽/지붕/인물/밭 겹침 보이지 않음.|
|06|`street_carrier`|[716, 373]|PASS|북서 넓은 흙광장. 성벽·지붕·기존 인물과 분리, 넓은 보행 여백 유지.|
|06|`street_merchant`|[849, 334]|PASS|곡창 북서 흙광장. 성벽·곡창·인물과 분리, 표지의 바닥 지지 구조 보임.|
|07|`yard_warehouse_shop_a_summer`|[465, 600]|PASS|방앗간·길과 떨어진 잔디. 수정 후 벽/지붕/인물/밭 겹침 보이지 않음.|
|07|`yard_warehouse_shop_b_summer`|[1170, 910]|PASS|밭과 곡창 아래 잔디. 수정 후 울타리·작물과 분리, 지도 가장자리 안쪽에 전부 남음.|
|07|`front_wheelwright_a`|[860, 804]|PASS|남쪽 작은 집 앞 흙마당. 집·인물·작물 줄과 분리. 길 연결부의 소품으로 보이며 통행 가능 여부는 미검증.|
|07|`front_wheelwright_b`|[1523, 474]|PASS|동쪽 길 북쪽 풀밭. 최종 (1523,474)에서 나무줄기와 분리, 벽/지붕/인물/밭 겹침 보이지 않음.|
|07|`street_fuller`|[716, 373]|PASS|북서 넓은 흙광장. 성벽·지붕·기존 인물과 분리, 넓은 보행 여백 유지.|
|07|`street_dyer`|[849, 334]|PASS|곡창 북서 흙광장. 성벽·곡창·인물과 분리, 표지의 바닥 지지 구조 보임.|
|08|`yard_institution_a_summer`|[465, 600]|PASS|방앗간·길과 떨어진 잔디. 수정 후 벽/지붕/인물/밭 겹침 보이지 않음.|
|08|`yard_institution_b_summer`|[1170, 910]|PASS|밭과 곡창 아래 잔디. 수정 후 울타리·작물과 분리, 지도 가장자리 안쪽에 전부 남음.|
|08|`front_mercer_a`|[860, 804]|PASS|남쪽 작은 집 앞 흙마당. 집·인물·작물 줄과 분리. 길 연결부의 소품으로 보이며 통행 가능 여부는 미검증.|
|08|`front_mercer_b`|[1523, 474]|PASS|동쪽 길 북쪽 풀밭. 최종 (1523,474)에서 나무줄기와 분리, 벽/지붕/인물/밭 겹침 보이지 않음.|
|08|`street_tanner`|[716, 373]|PASS|북서 넓은 흙광장. 성벽·지붕·기존 인물과 분리, 넓은 보행 여백 유지.|
|08|`street_cooper`|[849, 334]|PASS|곡창 북서 흙광장. 성벽·곡창·인물과 분리, 표지의 바닥 지지 구조 보임.|
|09|`yard_no_shop_labor_a_summer`|[465, 600]|PASS|방앗간·길과 떨어진 잔디. 수정 후 벽/지붕/인물/밭 겹침 보이지 않음.|
|09|`yard_no_shop_labor_b_summer`|[1170, 910]|PASS|밭과 곡창 아래 잔디. 수정 후 울타리·작물과 분리, 지도 가장자리 안쪽에 전부 남음.|
|09|`front_spicer_a`|[860, 804]|PASS|남쪽 작은 집 앞 흙마당. 집·인물·작물 줄과 분리. 길 연결부의 소품으로 보이며 통행 가능 여부는 미검증.|
|09|`front_spicer_b`|[1523, 474]|PASS|동쪽 길 북쪽 풀밭. 최종 (1523,474)에서 나무줄기와 분리, 벽/지붕/인물/밭 겹침 보이지 않음.|
|09|`street_wheelwright`|[716, 373]|PASS|북서 넓은 흙광장. 성벽·지붕·기존 인물과 분리, 넓은 보행 여백 유지.|
|09|`street_mercer`|[849, 334]|PASS|곡창 북서 흙광장. 성벽·곡창·인물과 분리, 표지의 바닥 지지 구조 보임.|
|10|`yard_itinerant_a_summer`|[465, 600]|PASS|방앗간·길과 떨어진 잔디. 수정 후 벽/지붕/인물/밭 겹침 보이지 않음.|
|10|`yard_itinerant_b_summer`|[1170, 910]|PASS|밭과 곡창 아래 잔디. 수정 후 울타리·작물과 분리, 지도 가장자리 안쪽에 전부 남음.|
|10|`front_vintner_a`|[860, 804]|PASS|남쪽 작은 집 앞 흙마당. 집·인물·작물 줄과 분리. 길 연결부의 소품으로 보이며 통행 가능 여부는 미검증.|
|10|`front_vintner_b`|[1523, 474]|PASS|동쪽 길 북쪽 풀밭. 최종 (1523,474)에서 나무줄기와 분리, 벽/지붕/인물/밭 겹침 보이지 않음.|
|10|`street_spicer`|[716, 373]|PASS|북서 넓은 흙광장. 성벽·지붕·기존 인물과 분리, 넓은 보행 여백 유지.|
|10|`street_vintner`|[849, 334]|PASS|곡창 북서 흙광장. 성벽·곡창·인물과 분리, 표지의 바닥 지지 구조 보임.|

## 미검증 범위

- No installed runtime rendering, movement, collision, navigation, animation, DPR, native zoom 0.6 LOD, or depth-occlusion test.
- Only six sprites per page on the same old scene; no dense simultaneous 60-sprite stress case.
- Tiny occupational pictograms are not reliably distinguishable at 0.6 proxy; silhouette/clutter judgment only.
- Front A objects occupy open dirt near a road connection; pass is visual separation, not walkability permission.
- Shade/light match is qualitative. No calibrated photometric or ground-contact-shadow measurement.
- JPEG city proofs cannot certify original PNG alpha integrity.
- Candidate review only; no external human acceptance.

## 최종 파일 SHA-256

|파일|SHA-256|
|---|---|
|`references/city/city-1380-spring-z1-source.png`|`a628b1720ff2b3cafd68fe8552274ca5518d567a4a6247d64aaceb177960459f`|
|`provenance/CITY_SOURCE.md`|`9b7bb1b47ce023703c86e08147e3f54df59ad0c113689444ed5639aedcb560ec`|
|`proofs/city/placements.json`|`af5a66c03f19ab7136807d1e354bdfb509004721a3712fec95bc565afca7b534`|
|`proofs/city/after-01-z1.jpg`|`94dd43a76a7e3521d084df70d792eb5af56694f711449a986737c0249c6d62db`|
|`proofs/city/after-01-z06-proxy.jpg`|`e57c96088314e0dc222159529e7d3d667ebece6d3a6fe3601eea77962747ecec`|
|`proofs/city/after-02-z1.jpg`|`26f2978e3a00eb9fe2cc221b30fb0094ee018be4e589c445e4ca5be7d98d8522`|
|`proofs/city/after-02-z06-proxy.jpg`|`2fef1428b9fb16ff101f9b8d8d1ce174fc2463ac5bf1745df8db059d2c1f5967`|
|`proofs/city/after-03-z1.jpg`|`f4588ba4d47822bd2f78344b542b148ee021ab53814ef3e2004b4be7c7a6efcc`|
|`proofs/city/after-03-z06-proxy.jpg`|`079974ad56fed4ce4f6b86488d2212fc4ce9c7d7ee5167a50e41cacaf864cb6b`|
|`proofs/city/after-04-z1.jpg`|`8634ecf2f9e3ac1c307cc62e33762a6285063c6bee089d2a2ebe4dace90b2aad`|
|`proofs/city/after-04-z06-proxy.jpg`|`f2b55dab87a0d42311499e80e26e90dda65ac6abe78bf15363468c905864bdca`|
|`proofs/city/after-05-z1.jpg`|`7fe8e0435829bf93e0d8131ed72556a8152870ae03644cb0f5d83022599b19bd`|
|`proofs/city/after-05-z06-proxy.jpg`|`e8871e431e33dea7182d9ec08f94b873d50ba5cab384754a3cfdb409cdb377a7`|
|`proofs/city/after-06-z1.jpg`|`666a15f2ce1527078bd4e010842c5458d2db6e9a41318c47c9c4b9bb8a38fe41`|
|`proofs/city/after-06-z06-proxy.jpg`|`49a6a9d2156cb118346bcb8787e2593289dc3ca4a6bba72518888e925fdd9a5c`|
|`proofs/city/after-07-z1.jpg`|`7f8166bf790998d5268e7e2fcf0e8ce4cd7f130baaff07bfce194a2858a6bc4c`|
|`proofs/city/after-07-z06-proxy.jpg`|`d837c4530fe4fa5c7bc356af0615a9c29c9ab022b0a6450011ed3759bcedc425`|
|`proofs/city/after-08-z1.jpg`|`e5c95bd04eb568b4b5c2d75a990580643cc73b8141d66bb92ae1d9cc6ad1348b`|
|`proofs/city/after-08-z06-proxy.jpg`|`4a5f8778927f9c559a513fc46009e72b36519952c816b7ba8a26becb61122ac2`|
|`proofs/city/after-09-z1.jpg`|`4977ae71af8162cc348ad716ad78b0d10c53891f4c7091486b041cd6868b254b`|
|`proofs/city/after-09-z06-proxy.jpg`|`57f21a54ff3e47906507bd9829f04a3a39f3c37b106f0e5b05479c60c0281d0c`|
|`proofs/city/after-10-z1.jpg`|`313e7f2da3025af41e2c08b8335f879ec492fee097217235dc0c9e6cdf25afec`|
|`proofs/city/after-10-z06-proxy.jpg`|`cdaa707e60694cd531beff0747c29b8e3138ada3911f7dabb461c3b70cee2787`|
|`provenance/asset_anchors.json`|`24a9b66e963b639014b47e3cb61845f65fb123d482392c45fcdab055ce1334f5`|
