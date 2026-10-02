# 출처·읽기 범위

기준 가지 `codex/phase15-organic-ground`, 코드 HEAD `83b06802661d6eef33ebf7dc5b7c31a18aa9fae8`. 확인일 2026-10-02.

## 정본 문서와 원본 이력

- [docs/design/glossary.md](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/docs/design/glossary.md): 저장소 정본 `/Users/rexxa/fls-astra-content/docs/design/glossary.md` 사용. SHA256 `30827ee61c89b83741cb955e7c57b83c21164759412405ffd3e14f3ec19a0cb5`. 사용자 지시에 따라 pull 후 저장소 경로를 기준으로 전환했다. 이전 /tmp 원본과의 대조 이력은 provenance.json에 있다.
- [docs/design/copy-audit-20261002/SOURCES.md](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/docs/design/copy-audit-20261002/SOURCES.md): 저장소 정본 `/Users/rexxa/fls-astra-content/docs/design/copy-audit-20261002/SOURCES.md` 사용. SHA256 `ce2fea7e061b37a18ff601521a3a7e3739d883172272d6a14fa3971eef130e30`. 사용자 지시에 따라 pull 후 저장소 경로를 기준으로 전환했다. 이전 /tmp 원본과의 대조 이력은 provenance.json에 있다.

사료의 금액·빈도를 게임 수치로 환산하지 않았다. 모든 선택 효과의 수치는 게임 규칙 또는 명시한 튜닝 범위다. 조사 문서의 자동 인용 표식은 근거 링크로 재사용하지 않았다. 학술 출판사 초록·기관 색인만 확인된 자료는 아래에 그 범위를 표시했다.

## 저장소 독해

- [docs/design/lord-mode.md](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/docs/design/lord-mode.md)
- [docs/design/trades-and-force.md](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/docs/design/trades-and-force.md)
- [docs/design/art-bible.md](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/docs/design/art-bible.md)
- [docs/research/2026-09-24-content-catalog.md](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/docs/research/2026-09-24-content-catalog.md)
- [docs/research/2026-09-26-research15-ui-state-design-claude.md](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/docs/research/2026-09-26-research15-ui-state-design-claude.md)
- [docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md)
- [docs/research/2026-09-30-indirect-rule-expansion-loop-gpt.md](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/docs/research/2026-09-30-indirect-rule-expansion-loop-gpt.md)
- [docs/research/2026-10-02-lordly-force-gpt.md](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/docs/research/2026-10-02-lordly-force-gpt.md)
- [docs/research/2026-10-02-market-town-trades-gpt.md](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/docs/research/2026-10-02-market-town-trades-gpt.md)

연구 문서 6개를 역할별로 모두 읽었다. 장원·간접통치 연구 2개는 [조사 기록](records/research-land-kin.md), 콘텐츠 목록·생업·무력 연구 3개는 [조사 기록](records/research-trade-force.md), UI 연구는 통합 담당이 읽었다. UI 연구는 기존 직접 건설 모드를 다루므로 현행 영주 모드의 권한 근거로 쓰지 않았다.

엔진 효과는 [현행 경로 목록](records/engine-effects.json)과 각 초안의 코드 링크로 추적한다. `eventSchedule` 구현은 `src/engine/eventSchedule.ts`, 데이터는 `src/content/eventConfig.ts`에 있다.

## 외부 근거

### HK01

[Lancaster University, Cumbrian Manorial Records: Glossary](https://www.lancaster.ac.uk/fass/projects/manorialrecords/glossary/index.htm)

- 뒷받침하는 관행: 공유지 방목·연료/수선 목재 이용권, 입주금, 직영지, 직책과 법정 기록의 구분. 사망 부과금(헤리엇), 제분료와 지정 방앗간 이용 의무(multure)의 구분.
- 사용 한계: 기관 해설. Cumbria의 특정 보유관행·부담은 잉글랜드 남부 전체의 보편 관행으로 일반화하지 않는다.
- 확인 수준: 2026-10-02 웹 원문 열람. common rights, estovers, cattle-gate, entry fine, demesne 항목 확인. 집필 교정 때 Heriot·Entry fine·Multure 항목을 원문 재확인했다.
- 사용 초안: 001, 010, 021, 026, 036, 041, 044, 048
- 내부 대조: `docs/design/glossary.md`, `docs/design/copy-audit-20261002/SOURCES.md#H06`

### HK02

[Seneschaucy, Elizabeth Lamond 1890 번역: The Organization of a Medieval Manor](https://www.medievalists.net/2024/05/organization-medieval-manor/)

- 뒷받침하는 관행: 연례 회계 검사, 씨앗·곡물 계량, 수선 책임, 무단 접대 제한, 가축 돌봄, 공동체의 마을 대표 선임.
- 사용 한계: 13세기 관리 규범의 번역 재게시. 1300~1450 모든 장원의 실제 준수·의학적 효능을 입증하지 않는다.
- 확인 수준: 2026-10-02 웹 본문 열람. Office of Reeve, Lord, Auditors 구간 확인. UWM 및 Bloomsbury 원문 링크는 열기 오류여서 확인 자료로 쓰지 않음.
- 사용 초안: 002, 003, 004, 007, 013, 015, 016, 017, 019, 023, 025, 029, 031, 034, 035, 037, 041, 046, 050, 052, 054, 055, 059
- 내부 대조: `docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md#여러-장원은-어떻게-굴렸는가`

### HK03

[The National Archives, Manors and manorial records](https://www.nationalarchives.gov.uk/help-with-your-research/research-guides/manors)

- 뒷받침하는 관행: 법정 기록·보유권을 증명하는 사본·장원 관리 회계는 서로 다른 증거다.
- 사용 한계: 기관 연구 안내이며 개별 관습이나 가격의 근거가 아니다. 직접 열기는 오류.
- 확인 수준: 2026-10-02 기관 검색 색인 본문 확인. 원문 전체 열람 아님.
- 사용 초안: 006, 009, 010, 032, 033, 034, 036, 038, 051, 053
- 내부 대조: `docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md#법정과-회계의-리듬`

### HK04

[Samantha Letters, Gazetteer of Markets and Fairs to 1516: Basic Introduction](https://archives.history.ac.uk/gazetteer/intro.html)

- 뒷받침하는 관행: 시장은 주간 요일, 정기시는 연례 축일과 기간이 정해졌으며, 이웃 시장의 손해 주장이 특허의 실제 개설을 막을 수 있었다.
- 사용 한계: 왕실 문서를 종합한 연구 안내. 특정 가공 도시의 시장 존속·실현 수익을 보장하지 않는다.
- 확인 수준: 2026-10-02 웹 원문 열람. What was a market, Granted Markets and fairs, charter conditionality 확인.
- 사용 초안: 005, 012, 024, 042, 055, 056, 057, 058
- 내부 대조: `docs/research/2026-09-30-indirect-rule-expansion-loop-gpt.md#협상이-도시를-바꾸는-통로`

### HK05

[Paston Letters II, 문서 4: William Paston 혼인 재산설정, 1420](https://www.gutenberg.org/files/40989/40989-h/40989-h.htm#letter4)

- 뒷받침하는 관행: 혼인 계약에 부부·후손의 재산과 상대 부모의 생애권을 함께 설정한 사례.
- 사용 한계: 직접 문서의 편집자 초록. Norfolk 가문 사례이며 남부의 보편 법률이나 수익률 아님.
- 확인 수준: 2026-10-02 공개 편집본 문서 4 원문 초록 및 Add. Charter 17,225 표기 확인.
- 사용 초안: 011, 018, 020, 047, 060
- 내부 대조: `docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md#거래·협상과-도시의-대응`

### HK06

[Paston Letters II, 문서 35: Mauteby 재산 임대 초안, 약1440](https://www.gutenberg.org/files/40989/40989-h/40989-h.htm#letter35)

- 뒷받침하는 관행: 과부의 생애권 뒤 딸과 다른 친족의 차순위 승계가 이어지는 설정.
- 사용 한계: 편집자 초록과 연대 추론. 정확한 작성년은 1439~1442 범위. 혼인 즉시 전 재산 획득으로 쓰지 않는다.
- 확인 수준: 2026-10-02 문서 35 및 편집자의 날짜 설명 직접 열람.
- 사용 초안: 047, 053
- 내부 대조: `docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md#실제-문서에서-보이는-조건·금액·결과`

### HK07

[Paston Letters II, 서한 62: Agnes가 Edmund에게, 1445-02-04](https://www.gutenberg.org/files/40989/40989-h/40989-h.htm#letter62)

- 뒷받침하는 관행: 길 경계 말뚝·지대 다툼과 법률교육의 필요를 연결한 가족 서한.
- 사용 한계: 당사자 주장. 분쟁의 최종 판결을 입증하지 않는다. Norfolk 사례.
- 확인 수준: 2026-10-02 서한 62 직접 열람. 길 변경 허가에 관한 편집 주석은 1443년으로 구별.
- 사용 초안: 044, 056
- 내부 대조: `docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md#정치·후원·소송·폭력은-토지와-어떻게-연결됐는가`

### HK08

[Paston Letters II, 문서 70: William Pope 약정, 1447-09-03](https://www.gutenberg.org/files/40989/40989-h/40989-h.htm#letter70)

- 뒷받침하는 관행: 토지 설정과 정기 추도미사를 연결한 약정 사례.
- 사용 한계: 직접 문서 편집자 초록. 종교적 효능이나 모든 교회의 수입 구조를 입증하지 않는다.
- 확인 수준: 2026-10-02 문서 70과 Add. Charter 17,235 출처 표기 열람.
- 사용 초안: 043, 060
- 내부 대조: `docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md#거래·협상과-도시의-대응`

### HK09

[Paston Letters II, 서한 129: 숲과 체납, 약1450](https://www.gutenberg.org/files/40989/40989-h/40989-h.htm#letter129)

- 뒷받침하는 관행: 울타리 미비의 손실·곡물 저가·체납이 함께 거론된 관리 보고.
- 사용 한계: 편집자의 잠정 연대. 재해 빈도·전국 가격·표준 배상액으로 환산하지 않는다.
- 확인 수준: 2026-10-02 서한 129 초록과 불확실한 날짜에 관한 편집 주석 열람.
- 사용 초안: 046, 054
- 내부 대조: `docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md#여러-장원은-어떻게-굴렸는가`

### HK10

[Paston Letters II, 서한 127~131: Gresham 권원·점유 분쟁, 1450](https://www.gutenberg.org/files/40989/40989-h/40989-h.htm#letter131)

- 뒷받침하는 관행: 소송 문서·상층 중재와 분쟁 수입의 중립 보관 제안은 권원과 점유의 차이를 보여준다.
- 사용 한계: 당사자 서한. 명령·제안이 그대로 집행되었다는 근거 아님. 1448 징수와 1449 축출을 하나의 날짜로 합치지 않는다.
- 확인 수준: 2026-10-02 서한 127, 128, 131 본문 직접 열람. 문서 131의 훼손 표기 확인.
- 사용 초안: 032, 038, 051, 058
- 내부 대조: `docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md#법적-권원과-실제-점유는-같은-변수가-아니었다`

### HK11

[J. Cave-Browne, Otham Rectors, Archaeologia Cantiana 23](https://www.kentarchaeology.org.uk/journal/23/otham-rectors)

- 뒷받침하는 관행: Kent의 Otham에서 후원자의 추천과 교회 측 임직을 구분하며, 친족 추천·혼인으로 이어진 추천권·과부의 추천 사례를 기록한다.
- 사용 한계: 사제 등록기록을 이용한 오래된 지방사 연구. 한 교구 사례를 보편 특권으로 확대하지 않으며 OCR 이름 오독 주의.
- 확인 수준: 2026-10-02 KAS 원문 페이지 열람. 1318, 1349, 1385 사례와 Canterbury Sede Vacante 기록 인용 확인.
- 사용 초안: 007, 008, 009, 022, 033, 043, 057
- 내부 대조: `docs/design/glossary.md#땅·권리·혼인·청원`, `docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md#사료-범위와-먼저-고쳐야-할-전제`

### HK12

[Paston Letters II, 서한 34: Agnes가 William에게, 약1440](https://www.gutenberg.org/files/40989/40989-h/40989-h.htm#letter34)

- 뒷받침하는 관행: 혼담 접촉을 가족이 중개하고 의복 증여를 협의한 사례.
- 사용 한계: 잠정 연대의 개인 서한. 혼담 성공률·지참금 가격표의 근거 아님.
- 확인 수준: 2026-10-02 서한 34 본문과 편집자의 혼인 직전 날짜 추론 열람.
- 사용 초안: 011, 018, 020
- 내부 대조: `docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md#Paston-현금을-토지로-바꾸고-혼인으로-다시-한-번-도약한-가문`

### HT01

[CAMPOP: Other sources of occupational data](https://www.campop.geog.cam.ac.uk/research/projects/occupationalstructure/maleoccothersources/)

- 뒷받침하는 관행: 1377·1379·1381 인두세는 직업사 자료이지만 지역·여성·하인의 기록 누락과 표본 한계가 있다. 직업별 청원은 가능한 지역 생업으로 제시한다.
- 사용 한계: 도시별 장인 수·전국 직업 비율을 확정하지 않는다. 성씨를 곧 실제 직업으로 읽지 않는다.
- 확인 수준: 2026-10-02 원문 페이지 열람; 연구기관 자료
- 사용 초안: 보조 조사만; 초안 직접 인용 없음
- 내부 대조: `docs/research/2026-10-02-market-town-trades-gpt.md:연구 기준과 빈도 해석`

### HT02

[Judith M. Bennett, Ale, Beer, and Brewsters in England: Women's Work in a Changing World, 1300–1600](https://academic.oup.com/book/47408)

- 뒷받침하는 관행: 중세 잉글랜드 에일 생산·판매에서 여성의 비중이 컸고 1350년 뒤 남성의 상업 양조 참여가 점진적으로 커졌다. 여성 양조업자·과부의 생업 유지 청원에 적합하다.
- 사용 한계: 열람한 출판사 초록과 목차만 사용. 전 책을 읽었다고 주장하지 않는다. 여성 양조가 특정 연도에 사라졌다는 효과 금지; 1600년 상황을 1450년에 투영하지 않는다.
- 확인 수준: 2026-10-02 출판사 초록 원문·목차 열람
- 사용 초안: 006, 024
- 내부 대조: `docs/research/2026-09-24-content-catalog.md:맥아·에일`, `docs/research/2026-10-02-market-town-trades-gpt.md:식품·숙박`

### HT03

[The fortunes of urban fullers in fourteenth-century England](https://academic.oup.com/histres/article/93/260/227/5826632)

- 뒷받침하는 관행: 14세기 중엽 이후 모직 산업 성장과 함께 도시 축융공의 위상이 높아졌다. 축융업자의 수력·공간·독립 영업 요구를 뒷받침한다.
- 사용 한계: 원문 직접 열기는 CDN 접근 오류. 출판사 검색 색인 초록 확인 범위만 사용. 도시별 인원이나 모든 축융공의 부유화를 확정하지 않는다.
- 확인 수준: 2026-10-02 출판사 검색 색인 초록 확인; 직접 open 실패
- 사용 초안: 028, 030, 039, 045, 049
- 내부 대조: `docs/research/2026-10-02-market-town-trades-gpt.md:가장 분명하게 커지는 직종은 Fuller다`

### HT04

[Wendy Childs, The English export trade in cloth in the fourteenth century](https://www.cambridge.org/core/books/progress-and-problems-in-medieval-england/english-export-trade-in-cloth-in-the-fourteenth-century/8F4C6A2347607D673B9AC95E87A02D38)

- 뒷받침하는 관행: 1347년 전에도 염료·매염제 수입과 국내 직물 산업 지원이 있었다. 직물 산업을 흑사병 뒤 처음 생긴 것으로 쓰지 않는다.
- 사용 한계: 출판사 발췌 범위. 수출량·가격 상승률·지역별 성장률은 사용하지 않는다.
- 확인 수준: 2026-10-02 출판사 검색 발췌 확인
- 사용 초안: 030, 039, 045, 049
- 내부 대조: `docs/research/2026-09-24-content-catalog.md:양모·직물`, `docs/research/2026-10-02-market-town-trades-gpt.md:흑사병 이후와 15세기 초의 변곡점`

### HT05

[Historic England, Medieval Settlements: Introductions to Heritage Assets](https://historicengland.org.uk/images-books/publications/iha-medieval-settlements/)

- 뒷받침하는 관행: 중세 정착지는 단독 농장·작은 촌락·큰 마을 등 다양했으며 가구 필지와 뒤뜰이 경관의 단위를 이루었다. 필지·생활공간의 중첩을 표현한다.
- 사용 한계: 기관 소개 페이지 및 PDF 검색 부분 확인. 모든 남부 도시를 동일한 개방경지·규격 필지로 만드는 근거가 아니다.
- 확인 수준: 2026-10-02 기관 페이지 및 PDF 색인 문단 확인
- 사용 초안: 001, 004, 008, 012, 015, 026, 028, 035, 050
- 내부 대조: `docs/research/2026-09-24-content-catalog.md:도시 안팎의 토지 어휘`

### HT06

[Historic England, Pre-industrial Lime Kilns](https://historicengland.org.uk/images-books/publications/iha-preindustrial-lime-kilns/)

- 뒷받침하는 관행: 석회가마는 석회석·백악 등을 소성하여 인근 건물의 모르타르용 석회를 공급했다. 건축 수요에 얽힌 재료·운송·연료 청원에 적합하다.
- 사용 한계: 소성 자원을 현 엔진 재고로 새로 만들 수 있다는 뜻은 아니다. 공사 인근 입지와 물자 부담만 사용하고 신자원은 새 효과로 분리한다.
- 확인 수준: 2026-10-02 기관 소개 페이지 검색 본문 확인
- 사용 초안: 보조 조사만; 초안 직접 인용 없음
- 내부 대조: `docs/research/2026-09-24-content-catalog.md:석회·기와·도기`

### HT07

[Philip Slavin, The Great Bovine Pestilence and its economic and environmental consequences in England and Wales, 1318–50](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1468-0289.2011.00625.x)

- 뒷받침하는 관행: 1319~1320년 가축 역병은 소 사육과 낙농 공급에 큰 충격을 주었다. 초록은 잉글랜드·웨일스 소 약 62% 손실 추정을 제시한다.
- 사용 한계: 전국 추정치를 플레이어 장원의 확정 손실률로 사용하지 않는다. 뒤의 흑사병과 영양부족 사이 인과는 논문의 질문이며 확정 사실이 아니다.
- 확인 수준: 2026-10-02 학술지 출판사 초록 검색 본문 확인
- 사용 초안: 017
- 내부 대조: `docs/research/2026-09-24-content-catalog.md:변곡점과 실제 충격·회복 경로`

### HT08

[William Chester Jordan, The Great Famine: Northern Europe in the Early Fourteenth Century](https://www.jstor.org/stable/j.ctt7s2mz)

- 뒷받침하는 관행: 1315년 이후 수년에 걸친 북유럽 기근은 한 철의 단순 수확 감소보다 넓은 생계 위기였다.
- 사용 한계: 출판물 소개 확인 범위. 장원별 사망률·수확량 수치는 제시하지 않는다. 구체적 종자 배급 청원은 관행을 바탕으로 한 합성 창작이다.
- 확인 수준: 2026-10-02 Princeton University Press 출판물 JSTOR 소개 검색 확인; 저자 Princeton 연구 등록으로 서지 대조
- 사용 초안: 016
- 내부 대조: `docs/research/2026-09-24-content-catalog.md:1315–17 대기근`

### HT09

[W. R. Jones, Purveyance for War and the Community of the Realm in Late Medieval England](https://www.cambridge.org/core/journals/albion/article/abs/purveyance-for-war-and-the-community-of-the-realm-in-late-medieval-england/8658443BD38F3ABFDEE0807574A54EC3)

- 뒷받침하는 관행: 왕실 조달은 식량·군수품·운송 확보를 포괄했고 1297~1362년 그 부담과 제한을 둘러싼 갈등이 있었다. 물자 납부와 운송 차출을 돈 하나로 환원하지 않는다.
- 사용 한계: 발췌 확인 범위. 모든 영주에게 동일 면제권·보상기일이 있었다고 쓰지 않는다. 고정 조달량과 관계 효과는 게임 추정이다.
- 확인 수준: 2026-10-02 Cambridge 출판사 발췌 원문 열람
- 사용 초안: 014, 027
- 내부 대조: `docs/research/2026-10-02-lordly-force-gpt.md:Purveyance는 반드시 경제 시스템으로 연결`

### HT10

[The Soldier in Later Medieval England, The English army in 1415](https://medievalsoldier.org/about/agincourt/the-english-army-in-1415/)

- 뒷받침하는 관행: 1415년 왕실 원정은 지휘관과 왕 사이 계약으로 병종과 인원을 정했다. 원정 복무를 평시 상비병이나 무차별 농민 소집과 구별한다.
- 사용 한계: 1415년 원정 기록을 1300년 전체의 동일 모집제도로 쓰지 않는다. 병사의 개별 부상·귀환 여부와 금액은 별도 초안상 추정이다.
- 확인 수준: 2026-10-02 연구 프로젝트 원문 열람; E101·E404 등 기록군 설명 확인
- 사용 초안: 보조 조사만; 초안 직접 인용 없음
- 내부 대조: `docs/research/2026-10-02-lordly-force-gpt.md:실제 원정 retinue의 크기`, `docs/research/2026-10-02-lordly-force-gpt.md:국왕 원정은 계약 협상`

### HT11

[Historic England, The Armada Beacon, Alderley Edge, listing 1019850](https://historicengland.org.uk/listing/the-list/list-entry/1019850?section=comments-and-photos)

- 뒷받침하는 관행: 봉화망 일반 해설은 봉화 사용이 1325년 무렵 공식화되었다고 설명한다. 봉화는 조기 경보라는 맥락으로 쓴다.
- 사용 한계: 등록 대상 자체는 북서부 사례다. 남부 모든 봉화의 설치 연대나 경보 도달 시간을 증명하지 않는다. 경보가 반드시 피해를 막는다는 보장도 없다.
- 확인 수준: 2026-10-02 국가유산 등록문 검색 색인 확인
- 사용 초안: 보조 조사만; 초안 직접 인용 없음
- 내부 대조: `docs/research/2026-10-02-lordly-force-gpt.md:봉화는 실제 조기경보망`

### HT12

[Southampton City Council, History of Southampton's monuments](https://www.southampton.gov.uk/culture-leisure-tourism/history-and-preservation/monuments-and-landmarks/history-southampton-monuments/)

- 뒷받침하는 관행: 1338년 프랑스 습격 뒤 Southampton의 방어벽 확충이 이어졌다. 해안 습격·방어비·기존 상업공간 사이 갈등의 지역 사례다.
- 사용 한계: Southampton은 특정 항구이며 모든 시장도시의 보편 경험이 아니다. 페이지의 1338년 뒤 Edward II 명령 표기는 재위 연도와 맞지 않는 오류라 사용하지 않는다. 국왕을 언급하지 않고 피해와 방어공사 연관만 사용한다.
- 확인 수준: 2026-10-02 시의회 페이지 검색 전체 본문 확인; 왕명 오류 별도 배제
- 사용 초안: 보조 조사만; 초안 직접 인용 없음
- 내부 대조: `docs/research/2026-10-02-lordly-force-gpt.md:Southampton과 Rye`

### HT13

[The National Archives, E179 Document notes: grant 407](https://www.nationalarchives.gov.uk/e179/notes.asp?action=3&slctgrantid=407)

- 뒷받침하는 관행: 1379년 징수 절차의 재사용과 1381년 징수·봉기의 연결.
- 사용 한계: 엔진의 1d/3d·14세·계절 일정의 근거가 아니다. 1377·1379·1380 승인세의 세율과 대상은 서로 같지 않다.
- 확인 수준: 2026-10-02 역사 조사 담당이 기관 검색 색인을 확인. 원문 열기 403.
- 사용 초안: 040
- 내부 대조: `docs/design/copy-audit-20261002/SOURCES.md#H04`, `docs/research/2026-09-24-content-catalog.md`

### HT14

[The National Archives, E179 Document notes: 1377 poll tax, grant403](https://www.nationalarchives.gov.uk/e179/notes.asp?action=3&slctgrantid=403)

- 뒷받침하는 관행: 1377년 인두세의 1인당4d 부과,14세초과 대상과 구걸인 예외,지역 대표가 산정·징수한 절차.
- 사용 한계: 게임의 주민당1d/3d 수입과 계절별 징수는 사료의4d 세율을 재현하지 않는 게임 간소화다.
- 확인 수준: 2026-10-02 통합 담당이 TNA 페이지 검색 색인 본문 확인. 원문 전체 열람으로 표시하지 않는다.
- 사용 초안: 040
- 내부 대조: `docs/design/copy-audit-20261002/SOURCES.md#H03`

## 배제한 일반화

Cely 서한(1475~1488)과 Caister 포위(1469)는 기간 밖이다. Paston 사례는 주로 Norfolk에서 왔으므로 남부 가공 가문의 가능성으로만 각색했다. 1338년 Southampton 설명 페이지의 Edward II 표기는 재위와 충돌하여 사용하지 않았다. 1349년 노동자 조례와 1351년 노동자법을 구분하며, 칼레 스테이플 중단을 영구 이전으로 쓰지 않는다.

