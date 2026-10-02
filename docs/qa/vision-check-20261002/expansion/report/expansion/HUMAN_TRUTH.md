# 사람 검사 확장 시험지의 블라인드 정답

## 동결

- 파일: truth-humans-frozen.json
- SHA256: `fee9c131f24f1a7514af3bd8435bc2f366c2ff665c8de1ca99e6411dcc0694b8`
- 멈춘 사람: **7개 인물/공간 양성**. 기존5명 유지 + 다른 위치의 새2명.
- 지붕/건물 겹침: **6개 공간/인물 양성**. 고정 지붕 손님5명(기존2+새3) + 이동 인물의 NW벽 겹침1곳.
- 새 검출 결과·기존 enhanced 후보·점수를 열지 않았다. 원본PNG, capture.json의 drawAlehouseDrinkers 위치, QA문헌으로 탐색하고 실제 픽셀을 직접 판독했다. 이전에 직접 판독한5+2개와NW벽1곳은 기존정답을 보존한다.
- 검출기 개발에 관여했던 같은 세션 내 확장 판독이다. 외부 독립 평가자나 완전히 미사용 holdout 시험이라고 주장하지 않는다.

## 관측 단위와 중복 방지

7명의 멈춤 양성은 동일 프레임에 서로 다른 화면 위치에 존재하는 다른 장식 인물이다. 같은 인물을 다른 줌·다른 시간으로 다시 찍어 개수를 늘리지 않았다. 5명의 지붕 양성도 동시에 다른 위치의 인물이다. 같은 도시 저장과 에일집 장식 원인을 공유하므로 **서로 독립적인 버그 원인7종/6종이 아니다**. 인물 인스턴스별 관측 수다.

멈춤 양성과 지붕 양성 사이에는 같은 인물이 포함된다. 이는 서로 다른 검출기 속성을 판정한 것이며 검출기별 분모에서만 센다. 전 검출기 양성 합계를 고유 인물 수로 표현하면 안 된다. NW벽은 같은 벽 위치의 여러 시간 통과를 사건1곳으로 센다.

## 출처와 QA ID 의미 보정

- docs/qa/round01/FINDINGS.md:19: QA002의 일부 인물 위치 고정, 몸흔들림 및 원인미확정.
- docs/qa/round01/FINDINGS.md:22: QA005의 곡창벽/집지붕 표면 앞 인물 겹침. **원래 round01 QA005도 고정 건물 군중 유형을 포함한다.**
- docs/qa/round01/repro/independent-visual-review.md:77–80: 10초간 같은 건물위치에 남은 인물, 다른 활동 진행, 교착/장식정상여부미확정.
- docs/qa/round03-14/history/03-FINDINGS.md:5, 04-FINDINGS.md:5: NW성벽의 이동인물 겹침 유형.
- docs/qa/round03-14/history/07-FINDINGS.md:6: 지붕표본0070–79 흰운반체의 또다른 겹침. 동일인물ID/논리경로미확정이므로 이번표본과동일사례라고연결하지 않았다.
- docs/qa/round03-14/history/09-REGRESSION.md:8 및14회최종FINDINGS.md의정지 이유 미검증은 정지 상태만으로 엔진 고장이라고 단정하면 안 된다는 근거다.

앞선 HUMAN_QA005.md가 원사례를NW벽으로만설명한부분은 너무좁았다. 같은 QA005가회차에따라 **고정 건물 군중·이동 벽 겹침** 두하위유형을포함한다. 이번확장은이를명시적으로분리한다. 문헌에등장하는특정개체와이번새2/3개체가같은ID라고주장하지않는다.

## 원본·카메라

- `report/recall/prenat1/raw/prenat1-city-confirm`: zoom1.3, pan(633.5999755859375,-1280.4000244140625), ticks320046→320273, span11400.0ms; capture.json SHA256 `cb32b859b7075dd80ee97c89b339ce4652dc3a9e2cc2cb0114d2110479b91110`.
- `report/recall/prenat2-fixed/raw/prenat2-city-confirm`: zoom1.0, pan(672.0,-863.5), ticks320046→320274, span11400.0ms; capture.json SHA256 `6e84c90875873b912e1f4d0d24fde907eb2f9c00651c92763d28bdcadd2242de`.
- `report/recall/prenat1-roof/raw/prenat1-roof-confirm`: zoom2.0, pan(544.0,-2277.0), ticks320046→320273, span11400.0ms; capture.json SHA256 `0305e97018c8f798a755e73653076c41e00b056766e7eebea75cc5fba7b89236`.

새 scene 이름 exp-*는부모작업자가기존raw를새시험폴더에복사할때쓴접두사이며, 다른 세이브나 새 회차 촬영으로 위장하는 뜻이 아니다. 위원본 이미지 바이트를재사용한확장주석이다.

## 정답 상자

| 장면 | 정답ID | x,y,w,h | 판독프레임 |
| --- | --- | --- | --- |
| exp-prenat2-city-confirm | QA002-visible-1 | 928,472,22,22 | 0–19 / 대표0 |
| exp-prenat2-city-confirm | QA002-visible-4 | 864,440,22,22 | 0–19 / 대표0 |
| exp-prenat2-city-confirm | QA002-visible-6 | 870,452,22,22 | 0–19 / 대표0 |
| exp-prenat2-city-confirm | QA002-visible-8 | 800,472,22,22 | 0–19 / 대표0 |
| exp-prenat2-city-confirm | QA002-visible-19 | 1024,456,22,22 | 0–19 / 대표0 |
| exp-prenat2-city-confirm | EXP-QA002-visible-54 | 1120,312,22,22 | 0–19 / 대표0 |
| exp-prenat2-city-confirm | EXP-QA002-visible-82 | 1120,248,22,22 | 0–19 / 대표0 |
| exp-prenat1-city-confirm | PRENAT1-static-roof-4 | 881,414,28,28 | 0–19 / 대표0 |
| exp-prenat1-city-confirm | PRENAT1-static-roof-19 | 1089,435,28,28 | 0–19 / 대표0 |
| exp-prenat1-city-confirm | EXP-QA005-static-roof-36 | 1089,393,28,28 | 0–19 / 대표0 |
| exp-prenat1-city-confirm | EXP-QA005-static-roof-54 | 1214,248,28,28 | 0–19 / 대표0 |
| exp-prenat1-city-confirm | EXP-QA005-static-roof-82 | 1214,164,28,28 | 0–19 / 대표0 |
| exp-prenat1-roof-confirm | QA005-NW-wall-moving-figure | 416,199,31,49 | 0–19 / 대표16 |

## 직접 영상 판독

- 새지붕36: 작은붉은지붕위파란옷인물. 뒤건물벽·연기와달리인물의몸/발이지붕면앞에보인다.
- 새지붕54: 다른집의붉은지붕상단앞파란옷인물. 주변이동인물이프레임별로바뀌어도해당인물은그지붕위치에남는다.
- 새지붕82: 북쪽의다른집붉은지붕중앙에파란옷인물. 20프레임내내지붕면앞에보인다.
- 새멈춤54/82: preNAT2원본의서로다른두집. 00–19,11.4초동안몸만흔들고보행이동하지않는다. 주변통행/연기는계속진행한다.
- NW벽: 대표frame16; 첫프레임그림위에사건상자를그리지않는다. 시간정의는20프레임중발생하는동일공간결함이다.

## 음성·판독범위·보류

- 기존정상통행ROI(445,25,60,65)를멈춤음성으로유지한다. 사람이이동하고화면밖으로나가므로10초고정인물이없다.
- 기존맨땅파란손님ROI는지붕 검사 음성으로유지한다. 이사람은멈춤 검사의 음성이아니다.
- regions는판독된양성주변작은 상자와정상 ROI만뜻한다. **이시험지정밀도는ROI안의조건부정밀도이며전후보정밀도가아니다.**
- full-main36장면과full-holdout6장면의capture.json을점검했다. 모두20프레임/1900ms라10초 정지 판정에 불충분하다. 이 자료를정지 양성으로추가하지않았다.
- 새원인/새도시종류가추가된것은아니다. 다른회차문헌중영구정지미재현·역할미확정사례는확정양성분모에넣지않았다.

## 증명 이미지

- HUMAN_TRUTH_roof_search0..2.jpg: 원본의에일집인물84위치주변을탐색한접촉판. 빨간상자는캔버스draw위치일뿐전부정답이아니다.
- HUMAN_TRUTH_new_temporal0..3.jpg: 새3지붕+2멈춤인물의00–19모든 프레임과문맥을직접 판독한접촉판.
- HUMAN_TRUTH_exp-*.jpg: 최종정답만그린장면사진. NW벽파일명은frame16.
