# v4.1 역사 소재 연구

확인일: 2026-10-05. 역사적 선례는 엔진 구현 증거가 아니다. 아래의 새 가구·재난·수장·계절 키는 **설계상 필요한 맥락**이며, 실제 읽기 함수와 영속 중복 방지가 확인될 때만 등록 후보로 채택한다. 전체 세부 기록은 `sources.json`.

## 사용 가능한 소재 14개

|소재|종류|시대|역사 근거|각색 한계|
|---|---|---|---|---|
|이번 장날의 통행세 면제 다툼|도시|1300–1450|H41-GUILD|실제 새 거래 맥락 필요. 왕실 수출관세와 시장 통행세를 구분|
|새 가구의 자리와 보증인|도시|1400–1450|H41-MIGRATION, GUILD|새 가구를 모두 외국인으로 부르지 않음|
|봉인이 다른 저울|도시|1300–1450|H41-GUILD|규약을 모든 도시의 동일 법으로 단정하지 않음|
|새 길드 수장의 공동 궤짝|세력|1300–1450|H41-GUILD|실제 수장 교체 식별자가 없으면 보류|
|집회철의 공동 구제 몫|세력|1300–1450|H41-GUILD|회원 구제와 현대 보편 복지권을 구분|
|물이 빠진 뒤 제방을 맡을 사람|자연|1300–1450|H41-FLOOD|실제 홍수 맥락; 현대 치수기관 없음|
|재가 된 지붕의 이웃 부담|자연|1300–1450|H41-FIRE|런던 규정의 지역적 선례; 보험·소방차 없음|
|앓는 회원의 문 앞에 놓을 빵|자연|1300–1450|H41-GUILD|구제가 병을 완치한다고 약속하지 않음|
|반란 뒤에도 남은 품삯 다툼|도시|1381–1424|H41-LABOUR|1381에 임금통제가 사라졌다고 쓰지 않음|
|일손과 활터 사이|세력|1388–1424|H41-ARCHERY, LABOUR|1477 법령을 앞당기지 않음|
|새 왕 아래 옛 특권을 묻다|세력|1399–1413|H41-HENRYIV, CHARTERS, JERSEY|왕조 변경이 모든 권리 자동 소멸을 뜻하지 않음|
|프랑스로 보낼 몫|세력|1415–1424|H41-WAR|1450년대 영토 상실을 1424 이전 사실로 쓰지 않음|
|원모와 직물 사이의 장터|도시|1381–1424|H41-WOOL, CUSTOMS|후기 원모·직물 변화는 지역의 매년 가격을 결정하지 않음|
|수확철에 들어온 품팔이 가구|도시|1381–1424|H41-LABOUR, MIGRATION|영구 정착권·농노 해방 효과를 발명하지 않음|

## 확인한 출처

- **H41-GUILD** — [Southampton Guild Organization, 14th Century](https://sourcebooks.web.fordham.edu/source/guild-sthhmptn.asp). Fordham IHSP의 1차 규약 번역. 임원 선출·집회·구제·면세·도량형 근거. 첫 11조는 1300 이전 기원이다. 본문 확인.
- **H41-LABOUR** — [The Statute of Labourers, 1351](https://www.umsl.edu/~gradyf/medieval/statute.htm). Statutes of the Realm 1:311–313의 번역. 공개 고용·임금·이동·집행 책임. 본문 확인.
- **H41-ARCHERY** — [Sporting discipline](https://www.cai.cam.ac.uk/discover/library/online-exhibitions/blood-sweat-and-ink/sporting-discipline). Cambridge Gonville & Caius 소장 법령 해설. 1388의 노동자·하인 놀이 금지와 축일 활쏘기 규정. 본문 확인.
- **H41-FLOOD** — [How Did Our Medieval Ancestors Cope with Flooding?](https://historicengland.org.uk/listing/what-is-designation/heritage-highlights/medieval-ancestors-cope-with-flooding). Historic England. 켄트 제방·배수의 반복 유지 비용. 본문 확인.
- **H41-FIRE** — [History of Building Regulations in the British Isles](https://www.buildinghistory.org/regulations.shtml). Liber Albus 등 판본을 지시하는 건축사 연구 안내. 중세 런던의 공동벽·배수·화재 규정 선례. 본문 확인. **직접 1차 판본은 별도이며, 사우샘프턴 공통법 증거가 아니다.**
- **H41-WAR** — [Funding the defence of the realm (or not…)](https://historyofparliament.com/2022/07/28/funding-the-defence-of-the-realm/). History of Parliament Trust. 1415 이후 원정 재정 부분만 사용. 본문 확인.
- **H41-CHARTERS** — [Eliza Hartrich, Charters and Inter-Urban Networks: England, 1439–1449](https://eprints.whiterose.ac.uk/104531/1/Hartrich%20Borough%20Charters%202.pdf). EHR 132(555), 2017, 219–249. PDF 본문 확인. 1399–1413 비교 논의와 특권 재확인이라는 일반 원리만 앞 시기에 적용.
- **H41-HENRYIV** — [Hereford City Council, City History](https://herefordcitycouncil.gov.uk/city-history/). 1399년 11월 20일 헨리 4세의 이전 헌장 확인 기록. 본문 확인. 남부도시 직접 사례가 아닌 잉글랜드 유사 사례.
- **H41-JERSEY** — [Tim Thornton, Jersey’s royal charters of liberties](https://www.jerseylaw.je/publications/jglr/Pages/JLR0906_Thornton.aspx). Jersey & Guernsey Law Review, June 2009. 1394·1400·1414 헌장의 차이와 특권 재확인. 본문 확인. 저지의 별도 법체계를 잉글랜드 본토에 복사하지 않음.
- **H41-CUSTOMS** — [The National Archives, Medieval customs’ accounts](https://www.nationalarchives.gov.uk/help-with-your-research/research-guides/medieval-customs-accounts/). 검색 색인 발췌만 확인, 직접 열기 403. 양모 및 직물 관세·항구 장부라는 제한된 사실에 사용.
- **H41-WOOL** — [Henry V and the crossing to France](https://www.tandfonline.com/doi/full/10.1080/03044181.2016.1236503), [Southampton 연구 저장소](https://eprints.soton.ac.uk/400231/). 원모 수출 감소·직물 수출 확대의 재정적 영향. 검색 색인 발췌와 저장소 서지 확인, 출판사 직접 열기 실패. 정량 배율·정밀 연도별 경기는 사용하지 않음.
- **H41-MIGRATION** — [The geographical origins and mobility of the inhabitants of Southampton, 1400–1600](https://research-repository.st-andrews.ac.uk/handle/10023/2759). 대학 학위논문 초록의 유입·도시 사회 진입만 사용. 검색 색인 초록 확인, 직접 열기 timeout. 16세기 제도·1496 이후 수치를 앞당기지 않음.

## 편집 판정

1. 역사적 구호·공동 부담을 현대 국가 복지·보험·소방 조직으로 바꾸지 않는다.
2. 길드의 선출·입회·회원 구제는 도시 반복 사건에 적합하지만, 실제 엔진 맥락이 없다면 연도 조건으로 대신 구현했다고 주장하지 않는다.
3. 1381–1424는 노동, 계절 고용, 교역의 이해관계로 넓게 채울 수 있다. 왕조·전쟁의 고유 역사 사건은 해당 시점 이후 실제 엔진 상황이 있을 때 사용한다.
4. 선택의 대가는 금전·재고·관계·정당성 등 **이미 있는 명령만**으로 표현한다. 새로운 장기 특권·치수 효과·완치·산업 지표를 서술만으로 보장하지 않는다.
5. 검색 발췌만 확인한 3개 출처는 확인 수준을 유지했다. 다른 자료로 수치·제도 상세를 덧붙이지 않았다.

## 205·209 근거 보강

- **H41-WATER** — [Erin Kurian, Industrial Waste Management and Urban Environments in Medieval England, 1300–1600](https://dspacemainprd01.lib.uwaterloo.ca/server/api/core/bitstreams/54773b4d-e44f-44bc-be43-bae178349b28/content), Waterloo MA, 2021, 인쇄면 78–80. PDF 본문 확인. 1310 관리인의 물 낭비 방지 의무, 1337 양조업자의 대량 취수로 주민이 물을 얻지 못한다는 민원, 1345 취수 제한, 1415 특정 수원 유료 사용을 Riley의 1차 사료 판본과 함께 지시한다. **허용:** 공용 급수의 우선순위·관리 비용·생업과 주민 수요 갈등. **불허:** 이 사례를 가뭄 또는 자연 우물 고갈의 증거로 제시. 205의 물 부족은 실제 게임 상태에 따른 각색이며, 해당 명령 없이는 우물 복구나 물 공급 개선을 약속하지 않는다.
- **H41-TIMBER** — [UK Parliament, The hammer-beam roof](https://www.parliament.uk/about/living-heritage/building/palace/westminsterhall/architecture/the-hammer-beam-roof-/). 본문 확인. 1393–1401 웨스트민스터 홀 공사에 쓸 목재는 Surrey Farnham 부근에서 짜맞춘 뒤 수레·바지선으로 옮겨 현장 조립했다. **허용:** 건축재 조달·운송·시공 순서와 대기 장면. **불허:** 전국 목재 부족, 특정 지역 가격 폭등, 일반 주택에 왕실 규모 수치 적용. 209의 자재 부족은 실제 게임 재고에서만 도출한다. [IHR 연구보고](https://archives.history.ac.uk/cmh/arpt93.html)의 Surrey–Kingston 목재·연료 상인과 수운 공급망도 본문 확인했다. 연료 수요를 건축용 목재 고갈로 치환하지 않는다.
