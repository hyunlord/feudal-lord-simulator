# 권리·영지·정치 — 잉글랜드 1300–1450의 권력 이동과 행위자 기반 정치 설계

## 핵심 답변

**첫째**, 현재의 “직영지(demesne) / 위임 가능한 권리(franchise) / 국왕에게서 받은 상위 권한” 3층 가설은 방향은 맞지만 법적 구조로는 수정해야 한다. *demesne*은 주로 영주가 자기 손에 보유한 토지·자산의 상태이고, *franchise/liberty*는 관할권·면책·수입권 같은 권능이다. “국왕에게서 받은 권한”은 제3층이라기보다 **각 권리의 법원(法源, authority/provenance)** 으로 두는 편이 정확하다. 시장·박람회는 늦어도 12세기 말~13세기 초에는 왕실이 허가하는 franchise로 정착했고, *Quo Warranto*에서는 행사자가 왕실 grant 또는 시효적 권원(prescription)을 제시해야 했다. citeturn13search3turn13search7  
**둘째**, 따라서 핵심 데이터는 단순 `holder`보다 **de jure holder / operator / beneficiary / source / scope / term / obligations / recognition / contest state**다. 영주 소유 방앗간과 세입자의 *suit of mill*은 같은 것이 아니며, 영주가 시장 franchise를 보유한 채 징수권만 도시에게 farm할 수도 있다.  
**셋째**, `fee farm`은 “권리” 자체보다는 **권리 묶음을 대가로 하는 재정 의무·계약**으로 분리하는 편이 좋다. 반대로 officer election, low court, toll collection, bylaw 같은 것은 독립된 원자적 권리로 두고 UI에서 “charter bundle”로 묶어 보여주는 구조가 적합하다.  
**넷째**, 강제 회수는 곧 법적 소멸이 아니다. 게임은 반드시 **de jure 권리와 de facto 통제**를 분리해야 한다. 1285년 런던의 경우 왕은 도시를 자기 수중으로 넣고 왕실 warden을 두었지만, 1298~99년에 자치가 복구되었다. citeturn13search0turn13search8  
**다섯째**, Bury St Edmunds와 St Albans의 사례는 “도시의 자치도가 수치 하나씩 오르는” 모델보다 **특정 권리·문서·법정·방앗간·관직을 둘러싼 반복 분쟁** 모델을 지지한다. 1327년 Bury의 대규모 충돌과 1381년 St Albans에서 강제로 liberties를 받아낸 사건은 특히 강한 사례다. citeturn13search1turn13search5turn13search9  
**여섯째**, 상인 권력은 “돈이 많으면 영주의 권리를 직접 소유”하기보다 **도시 공동체가 보유한 권리를 관직·신용·길드·친족망을 통해 사실상 통제**하는 경로가 더 중요하다. 왕실 대출을 통한 대상인의 영향력은 확실하지만, 이를 소규모 시장도시의 “상인 가문이 영주에게 대출 회수를 위협한다”로 그대로 축소하는 것은 **게임적 외삽**이다.  
**일곱째**, “일방 회수 → 모든 행위자 신뢰 하락”도 수정해야 한다. 직접 피해자는 크게 반응하되, 제3자는 사건의 공공성·권리의 명확성·소문에 따라 `lordReliability`를 갱신해야 한다.  
**여덟째**, 정치 시스템의 최소 단위는 **행위자 3개 수치**가 아니라 `구조적 힘(power/capacity) + 현재 태도(trust) + 원인이 남는 grievance/memory`다. grievance는 반드시 원인 `SourceRef`를 보존해야 한다.  
**아홉째**, 게임 비교에서 가장 유용한 조합은 **CK3의 양자 계약·정당한 사유/폭정 구분 + Victoria 3의 경제가 정치세력의 힘을 만드는 구조 + Frostpunk 2의 요구·협상·의회식 가시화 + EU4의 privilege registry**다. Frostpunk 2는 공식 설명 자체가 “상충하는 파벌 이해관계와 Council Hall”을 핵심으로 명시한다. citeturn23view0  
**열째**, Manor Lords는 중세 경제·공간 표현에는 참고가 되지만, 현재 Early Access의 핵심 설명은 도시건설·자원·burgage·전투에 있고, 이번에 필요한 **권리 보유자 간 정치**의 직접적인 준거는 아니다. citeturn23view3  
**결론적으로**, 시제품은 “복잡한 정치 시뮬레이션”을 전부 만들기보다 **권리 등록부(right registry) + 도시 공동체 한 행위자 + grievance 기록 + 합법/불법 회수 차이**까지 넣고, E단계부터 상인·왕실 청원·신용을 추가하는 것이 현재 로드맵과 가장 잘 맞는다.

## 파트 A — 역사: 영주·도시·상인·교회·국왕 사이의 권리 이동

### 권한의 층은 “소유권 → 권리 → 국왕”이라는 깔끔한 피라미드가 아니었다

**[확정]** 중세 잉글랜드에서 *demesne*과 *franchise/liberty*를 같은 종류의 권한으로 취급하면 안 된다. *Demesne*은 넓게는 영주가 자기 손에 보유하여 직접 수취·경영하는 토지와 부속 자산을 가리키는 토지보유상의 개념이고, *franchise*는 보통 일반 법질서에서는 왕에게 귀속될 법한 관할권·시장·면책·수입권 등을 특정 주체가 행사하는 법적 권능을 뜻한다. 왕권이 모든 지방 관습을 “창조”했다는 뜻은 아니지만, 13세기 왕권은 여러 franchise에 대해 “무슨 권원으로 행사하는가?”를 물었고, 시장·박람회는 왕실이 독점적으로 허가하는 franchise로 확립되어 있었다. *Quo Warranto* 자료에서는 왕실 grant 또는 1189년까지 소급하는 prescription이 시장·박람회 권원의 전형적인 답이었다. citeturn13search3turn13search7

따라서 의뢰서의 세 층은 다음처럼 바꾸는 것이 더 정확하다.

| 설계상의 층 | 역사적으로 더 정확한 해석 | 판정 |
|---|---|---|
| `demesne` | 영주가 자기 손에 보유하는 토지·건물·재고·자산. 성채·직영지·곡창·방앗간 건물 등이 여기에 들어갈 수 있음 | **수정** |
| `franchise / liberty / customary right` | 시장·재판·징수·면책·관직 선출·공동이용권 등, **특정 대상에 대해 무엇을 할 수 있는가** | **맞음, 세분 필요** |
| `상위 권한` | 별도 층보다는 각 권리의 `authority/source chain`: 왕실 charter, 영주 charter, prescription, custom, lease 등 | **수정** |

특히 **방앗간**은 이 구분을 시험하기 좋은 사례다. 물리적 mill은 영주의 demesne 자산일 수 있지만, 세입자에게 그 방앗간 사용을 강제하고 *multure*를 받는 *suit of mill*은 토지 자체가 아니라 별도의 관습적·영주적 권리다. 반대로 숲도 “영주의 demesne woodland”일 수 있지만, 마을 주민에게 장작·방목 등의 common right가 중첩될 수 있고, royal forest에 들어간다면 별도의 왕실 관할 문제가 발생한다. 즉 **한 타일·건물 위에 소유권과 여러 권리가 동시에 얹힐 수 있어야 한다.**

**[확정]** “특권은 모두 왕에게서 왔다”는 문장은 너무 강하다. 더 정확한 표현은 **왕권이 regalian franchise라고 주장한 권리에는 왕실 grant 또는 인정된 prescription이 필요했다**이다. 특히 시장·박람회는 강한 사례다. Centre for Metropolitan History의 전국 조사에 따르면 늦어도 12세기 말~13세기 초 왕은 시장·박람회를 허가할 배타적 권리를 갖는 것으로 취급되었고, Charter Rolls가 이를 체계적으로 기록한다. 동시에 오래된 시장은 별도의 현존 charter 없이 prescriptive market으로 인정될 수 있었다. citeturn13search3turn13search7

이 때문에 영주가 도시에게 무엇이든 임의로 “선물”할 수 있었던 것은 아니다. 영주는 **자기가 실제로 가진 범위 내에서** burgage 조건, 자기에게 귀속되는 rent/service, 자기 법정의 운영 일부, 자기가 받은 toll의 수취 또는 farm, 관리 선임 방식 등을 양보할 수 있었다. 그러나 영주 자신에게 없는 왕실 franchise를 새로 만들어 줄 수는 없다. 왕실 시장 franchise가 없는 영주가 도시에게 독자적으로 합법적 weekly market을 “창설”해 주는 식의 시스템은 피하는 편이 좋다. 시장·박람회 grant가 실제 운영을 자동 보장하지도 않았고, 1200년 이후의 grant에는 이웃 시장에 대한 피해가 없어야 한다는 조건이 붙는 것이 일반적이었다. citeturn13search3

따라서 **“국왕 확인이 필요한가?”를 권리 전체의 Boolean으로 두면 안 된다.** 시장·박람회처럼 명백히 왕실 franchise인 것은 upstream royal authority가 핵심이다. 반면 영주 소유 자산의 임대나 자기 manorial court 내부의 행정 위임은 그 자체로 매번 새 왕실 charter를 요구하지 않는다. 왕실의 *confirmation/inspeximus*는 후계 영주, 외부 분쟁, Quo Warranto 같은 상황에서 권원의 강도를 높이는 별도의 상태로 구현하는 편이 낫다. 14세기에 기존 charter의 confirmations가 크게 늘었다는 CMH 조사도 “원래 grant”와 “후대 확인”을 분리해야 함을 보여준다. citeturn13search3

**[확정] 교회·수도원 영주 도시**도 별도의 헌정체제가 아니라 기본적으로 토지·manor·franchise를 가진 lordship이었다. 다만 세속 영주와 달리 abbey 자체가 장기간 지속되는 법인적 공동체였고, 수도원 자체의 liberty·ecclesiastical jurisdiction과 세속 lordship이 결합할 수 있었다. 그 결과 도시민에게는 “영주를 바꾸면 해결될 수 있는 사적 갈등”이 아니라 수도원 제도 자체와의 지속적인 관할 갈등으로 나타나기 쉬웠다. Bury St Edmunds와 St Albans의 반복 분쟁은 이러한 구조를 잘 보여준다. citeturn13search1turn13search2turn13search9

### 권리는 어떻게 넘어갔는가

**[확정]** 도시 특허(charter)는 현대적인 의미의 일괄 “자치권 레벨 업”이 아니었다. 서로 다른 시점에 rent, toll, court, officer, exemption, collective farm 등을 취득·확인하면서 **bundle이 누적되는 과정**에 가까웠다. 시장·박람회 자료에서도 최초 grant, 재grant, 날짜 변경, confirmation, prescription이 구별되며, charter를 얻었다고 실제 시장이 곧 작동했다고 볼 수도 없다. citeturn13search3turn13search7

영주 측의 동기는 네 가지로 분해하는 편이 안전하다.

**[확정] 수입의 현금화와 예측 가능성.** 영주가 하나하나 징수·관리하는 대신 borough/community 또는 farmer에게 수취를 맡기고 고정 farm을 받는 구조는 행정비용과 수입 변동을 바꾼다. 다만 이 경우 “법적 권리 보유자”와 “현재 수취·운영자”가 다를 수 있다. 이것이 게임에서 `holder` 하나로는 부족한 가장 중요한 이유다.

**[유력] 정착과 상업 유치.** 유리한 tenure, 시장 접근, 일정 수준의 자치·법적 예측 가능성은 상인·장인을 끌어들이는 수단이 될 수 있었다. 중세 잉글랜드의 시장망 확대가 인구·정착·상업화와 밀접하게 연결되어 있었다는 CMH의 전국 연구가 이 해석을 지지한다. citeturn13search3

**[확정] 정치적 타협.** 권리 양보는 항상 영주의 주도적 “개혁”이 아니었다. Bury나 St Albans처럼 압력이 폭력화된 뒤 도시민이 새로운 liberties를 받아내려 한 경우도 있었다. 따라서 grant에는 `voluntary / bargained / coerced / adjudicated` 같은 체결 맥락을 남길 가치가 있다. citeturn13search1turn13search9

**[유력] 목돈·채무·군사적 필요.** 왕과 대영주는 현금 필요 때문에 도시·상인과 교섭했고, 왕실 finance에서는 상인 신용의 영향력이 특히 분명하다. 그러나 이것을 모든 작은 시장도시에서 “영주가 도시에게 자치권을 팔았다”는 보편 규칙으로 일반화해서는 안 된다. 해당 메커니즘은 규모에 따라 빈도를 낮추는 편이 역사적으로 안전하다.

여기서 **기한부 임대(lease/farm)와 권리 자체의 영구 양여를 구분**해야 한다. 예를 들어 toll을 몇 년간 farm하는 것은 toll franchise의 영구 alienation과 다르고, mill을 farmer에게 맡기는 것은 *suit of mill* 자체를 넘기는 것과 다르다. 게임에서 이 둘을 같은 `right.transfer()`로 구현하면 이후 회수·승계·분쟁을 표현하기 어려워진다.

### 회수·정지·몰수와 도시의 대응

런던의 1285–1298/99 사례는 회수 시스템의 핵심 모델이다.

**[확정] 런던, 1285.** Edward I 치하에서 City는 왕의 손에 들어갔고 왕실 warden 아래 놓였다. 이는 “도시 삭제”가 아니라 **자치 정부를 정지시키고 왕실 관리가 통치하는 custody**였다. BHO가 공개한 런던 연대기는 1285년 City가 왕의 손에 압류되었다고 기록하며, London Record Society의 연구는 1285–1298년 왕실 warden에 의한 직접 통치와 1299년 charter를 통한 liberties 회복을 정리한다. citeturn13search0turn13search8

게임적으로 매우 중요한 결론은 이것이다.

> **“몰수(confiscation)”는 `right.owner = king` 한 줄이 아니라 `exercise suspended → custodian appointed → revenue/control redirected → restoration/confirmation negotiated`라는 상태 전이일 수 있다.**

따라서 `active / suspended / seized / disputed / restored`가 필요하다.

Bury St Edmunds는 반대 방향의 사례다.

**[확정] Bury St Edmunds, 1327.** 대규모 도시-수도원 충돌에서 townsmen은 abbey를 공격하고 재산·기록·mint 관련 물품까지 가져갔다. BHO의 VCH는 이를 “Great Riot of 1327”로 기록하며, 런던의 Plea and Memoranda Rolls도 당시 Bury의 심각한 town–abbey quarrel을 따로 언급한다. 왕권이 사후 개입했고, 폭력으로 강요된 양보가 안정된 새 헌정질서로 그대로 굳어진 것은 아니었다. citeturn13search1turn13search5

**[확정] St Albans, 1381.** VCH의 borough history는 townsmen이 abbot과 monks를 포위해 “force and fear”로 특정 liberties를 grant하게 했다는 고발을 기록한다. 즉 도시민은 추상적인 “independence”를 요구한 것이 아니라 **영주의 실제 권리행사를 불능으로 만들고 문서화된 양보를 받아내는 방식**으로 움직였다. 수도원 lordship은 이후에도 지속되었으므로, 일시적 de facto 승리와 안정적인 de jure 권리 취득을 분리해야 한다. citeturn13search9turn13search2

대표 사례를 게임 관점으로 압축하면 다음과 같다.

| 장소·연도 | 권력 이동 | 수단 | 결과와 게임적 의미 | 등급 |
|---|---|---|---|---|
| **Letheringham, 1297** | priory가 fair 권리를 받음 | 왕실 grant | 교회 영주도 시장·박람회 franchise의 royal source를 필요로 했음을 보여주는 13세기 배경 사례 | **확정** citeturn2search8 |
| **London, 1285** | City liberties의 실질적 행사가 왕실 통제로 이동 | royal seizure/custody | “회수”와 “영구 소멸”은 다름 | **확정** citeturn13search0 |
| **London, 1298–1299** | civic government/liberties 회복 | restoration + charter | 압류 뒤에도 권리 묶음 복구 가능 | **확정** citeturn13search8turn13search4 |
| **Bury St Edmunds, 1327** | townsmen이 abbey lordship에 강제 양보를 요구 | riot, coercion, 문서·재산 장악 | 강제 grant는 높은 `contestState`를 가져야 함 | **확정** citeturn13search1turn13search5 |
| **St Albans, 1327 전후 분쟁** | borough와 abbey의 자치·관할 갈등 | 집단 압력·법적 분쟁 | 단회 사건보다 장기적인 rights dispute로 보는 편이 적절 | **유력** citeturn13search2turn13search9 |
| **St Albans, 1381** | townsmen이 abbot에게 liberties를 강제로 grant시킴 | siege/coercion | de facto 양보와 지속 가능한 legal title을 분리해야 함 | **확정** citeturn13search9 |
| **Bury St Edmunds, 1381** | 1327의 구조적 갈등이 다시 폭발 | 반란·문서/영주권 공격 | grievance가 수십 년간 동일한 제도적 쟁점을 재점화할 수 있음 | **유력**, 세부는 Gottfried·1381 연구와 교차 확인 필요 |

첨부 선행 경제조사의 **Chichester 1316**과 **15세기 초 Arundel toll lease**는 이번 조사에서 BHO 원문을 다시 안정적으로 검증하지 못했으므로, 이 보고서의 “확정 사례” 근거로는 사용하지 않았다. 설계 자료에는 유지하되 `sourceRefs`가 원 사료·VCH 페이지에 다시 연결될 때 확정으로 승격하는 편이 안전하다.

도시의 대응도 한 단계가 아니었다. 평시에는 charter와 관습을 증거로 제시하고 왕실 법정·청원·중재를 이용할 수 있었고, 정치적 조건이 맞으면 집단 거부·시설 장악·문서 강탈·폭력으로 넘어갔다. *Quo Warranto* 자체가 “누가 무슨 권원으로 이것을 행사하는가”를 소송 가능한 쟁점으로 만들었기 때문에, **법적 정당성은 추상적인 morality가 아니라 들고 갈 수 있는 문서·관습·시효·증언의 강도**여야 한다. citeturn13search7

### 상인 과두정과 신용의 실제 한계

**[확정]** 도시가 더 자치적이 되었다고 도시의 모든 거주자가 같은 권력을 얻은 것은 아니다. 중세 후기 borough에서는 burgesses, merchant elite, office-holding families가 mayor/bailiff/alderman/council 같은 자리를 반복 점유하여 공동체의 권리를 실제로 행사하는 범위를 좁힐 수 있었다. 따라서 게임에서는 **`Town Community`가 법적 holder이고 `Merchant Elite`가 그 행위자의 관직과 의사결정을 장악**하는 상태가 가능해야 한다. “시장 특허의 holder = Merchant Family A”만으로 과두정을 표현하면 역사적 관계를 거꾸로 만들 가능성이 크다.

런던의 guild·회사와 civic elite는 규모가 너무 크므로 소도시에 그대로 복제해서는 안 되지만, 왕실이 런던을 1285–1298년 직접 통치한 뒤에도 도시의 조직된 merchant/craft bodies가 살아남았다는 것은 “도시 권리”와 “도시 내부 세력”을 별도 객체로 두어야 함을 보여준다. citeturn13search8

**[확정, 왕실 규모]** William de la Pole 같은 14세기 대상인이 Edward III의 전쟁재정과 연결되어 막대한 정치적 영향력을 행사했다는 것은 중세 왕권-상인 credit 관계의 대표 사례다. 다만 이는 왕과 국제 wool merchant/financier의 규모다. Barron, Fryde와 중세 상업금융 연구는 상인 신용과 공직·관세·왕실 후원을 연결하지만, 이것이 곧 “남부의 작은 lord’s market town에서도 상인 두 가문이 영주에게 loan call을 걸어 charter를 얻는다”는 증거는 아니다.

따라서 의뢰서의 상인 권력 경로는 다음처럼 등급을 나누는 것이 좋다.

| 경로 | 역사 판정 | 게임 적용 |
|---|---|---|
| 상업적 부 → 도시 관직 | **확정** | Merchant power의 기본 |
| 관직 → 공동체 권리의 사실상 통제 | **확정/유력**, 도시별 편차 큼 | `officeControl`로 표현 |
| 길드·친족·혼인 → 결속 | **유력** | `cohesion/network` |
| 왕·대영주에게 credit 제공 → 영향력 | **확정**, 큰 규모에서 가장 명확 | 고성장 후기 기능 |
| 소도시 상인 가문이 lord loan을 전략적으로 회수 | **가설/게임적 외삽** | E단계 이후 드문 pressure action |
| 조직적으로 교역을 떠나 영주를 굴복시킴 | **가설에 가까움** | “즉시 파업 버튼” 대신 점진적 capital/merchant flight |
| royal petition·소송 | **확정적인 수단** | 가장 먼저 구현할 대외 견제 |
| riot/armed defiance | **확정, 특정 위기** | 최종 escalation |

`fee farm 지연`도 같은 주의가 필요하다. **체납이 있었다 = 정치적 파업이었다**고 보면 안 된다. 실제 체납은 재정난·징수 실패·재난 때문일 수 있다. 따라서 게임에서는 `arrearsCause = incapacity | dispute | deliberate_withholding`을 나누는 편이 좋다.

### 교회·국왕·빈민과 1381년

**[확정]** abbey town에서는 수도원이 단순히 “종교 파벌”이 아니라 **landlord + court-holder + franchise-holder + ecclesiastical institution**이 될 수 있다. 그래서 교회 행위자를 일반적인 opinion faction으로 만들기보다, 특정 시나리오에서 실제 rights holder로 만드는 것이 훨씬 역사적이다. Bury와 St Albans의 VCH가 보여주는 충돌은 바로 수도원과 town community가 같은 시장·법정·자치 공간을 두고 충돌한 사례다. citeturn13search1turn13search2

국왕도 매 순간 마을에 상주하는 “상위 영주 AI”라기보다 다음 기능으로 등장시키는 편이 정확하다.

**권리의 권원 제공자** — royal charter·confirmation.  
**심판자/집행자** — quo warranto, royal court, commission, custody.  
**재정 요구자** — taxation, levy, royal finance.  
**위기 개입자** — 반란·무질서·abbey-town dispute에 대한 사후 처벌·중재.

시장과 박람회의 royal franchise, Quo Warranto의 warrant 심사는 특히 첫 두 기능을 강하게 보여준다. citeturn13search3turn13search7

**[확정]** 1381년의 중요한 정치 언어 가운데 하나는 영주권을 물리적으로 지탱하는 **문서와 기록**에 대한 공격이었다. Bury와 St Albans 같은 지역에서 charter, court record, obligation의 통제가 자치·영주권 분쟁의 핵심이었고, St Albans에서는 강제 grant 자체가 반란의 쟁점이 되었다. citeturn13search1turn13search9

이 점은 게임에 매우 유용하다. “빈민 만족도 0 → 반란군 spawn”보다, 1381형 위기에서는 반란군의 목표가 다음처럼 **제도적**일 수 있다.

`court rolls 파기 → 부역·벌금 청구의 증거 약화`  
`charter 강제 교부 → autonomy claim 생성`  
`mill/market 시설 장악 → monopoly의 de facto 집행 중단`  
`gaol·court 공격 → lord's justice 마비`

다만 **빈민·소작인을 평시의 통일된 법인 행위자로 만드는 것은 역사적으로 과도하다.** 평소에는 household/tenant population으로 존재시키고, grievance가 공유되고 조직화 계기가 생겼을 때 `Commons Movement`라는 임시 집합 행위자가 생성되는 구조가 더 설득력 있다.

### 흑사병 이후 권리의 “법적 존재”와 “실효성”은 달라졌다

**[유력, 지역차 큼]** 흑사병 이후 노동력 부족과 임금·토지협상력 변화는 lordship을 하루아침에 없애지 않았지만, 노동부역과 이동 통제를 집행하는 비용과 난도를 높였다. 후기 중세 영국 serfdom 연구 역시 serfdom을 토지소유자가 농민에게 행사하는 강제적 관계로 보며, 그 쇠퇴가 장기간의 협상·법·시장 변화 속에서 일어났음을 강조한다. citeturn17search1

따라서 게임에서 Black Death 뒤 `suit of mill = false`, `labour service = false`로 일괄 삭제하는 것은 부정확하다. 더 좋은 모델은 다음이다.

**권리는 남지만 enforceability가 내려간다.**

예를 들어 lord가 법적으로 labour service를 요구할 권리가 있어도, tenant가 다른 곳에서 더 좋은 조건을 찾고 manor court의 강제가 비싸지면 실제 수취량은 낮아질 수 있다. 같은 방식으로 mill suit도 법적으로 지속되면서 우회·불복·합의에 의한 현금화가 늘어날 수 있다. 즉 권리 객체에 `legalStrength` 외에 **`enforceability`** 가 필요한 역사적 이유가 생긴다.

이는 Mark Bailey, John Hatcher 등의 후기 중세 노동·serfdom 연구와도 잘 맞는다. 흑사병을 “농민 즉시 해방 이벤트”가 아니라 **오래된 권리의 실효성과 협상력을 재배열하는 충격**으로 보는 편이 안전하다.

## 파트 B — 게임 설계: 복잡한 행위자 정치를 어떻게 읽히게 만들 것인가

먼저 검증 수준을 분명히 해야 한다. **Frostpunk 2와 Manor Lords는 현재 공식 개발자/퍼블리셔 Steam 설명을 직접 확인했다.** CK3의 공식 Steam 페이지도 확인 대상이 되었으나 이번 세션에서 상세 개발일지 본문을 안정적으로 불러오지 못했다. Victoria 3와 Tropico 6은 Steam age-check 너머 상세 본문 확보에 실패했다. 따라서 사용자가 요구한 규칙에 따라, 아래에서 현재 패치의 세부 계산·수치·쿨다운을 기억에 의존하는 부분은 **`미확인`** 으로 표시한다. Frostpunk 2의 “강한 파벌·Council Hall·파벌별 ideology와 power 경쟁” 및 Manor Lords의 도시·경제 구조에 관한 서술은 공식 페이지로 확인된다. citeturn23view0turn23view3

| 게임 | 행위자 모델 | 권리·법 모델 | 견제·갈등 | 가독성에서 가져올 것 | 이 프로젝트에서의 역할 |
|---|---|---|---|---|---|
| **Crusader Kings III** | named character·vassal 중심. opinion, 관계, traits, faction 참여. 세부 modifier/기억 감쇠는 **미확인** | 개별 vassal contract·title·법적 cause를 가진 양자관계라는 패턴. 현재 패치 세부는 **미확인** | 불만을 가진 인물이 faction으로 결집 → 요구/ultimatum → 거부 시 전쟁이라는 구조가 핵심 패턴. 세부 임계치는 **미확인** | “왜 이 인물이 싫어하는가”를 modifier 목록으로 분해 | **영주↔도시/가문 간 양자 권리관계**, 정당한 회수와 폭정성 회수의 구분 |
| **Victoria 3** | Interest Group과 이를 지지하는 population. `clout/approval` 계열 구조로 이해 가능하나 현재 패치 계산은 **미확인** | 권리는 개인 소유물보다 country-wide law로 구현 | 경제구조가 정치세력 힘을 바꾸고 law change를 둘러싼 지지·반대가 정치화됨. 현재 movement 세부는 **미확인** | 법 변경이 어느 집단을 강·약화시키는지 사전 표시하는 패턴 | **“경제 → 세력 힘 → 정치”** 연결 |
| **Frostpunk 2** | 서로 다른 ideology·future vision을 가진 factions/communities. 공식 설명은 faction power와 Council Hall을 핵심으로 명시 citeturn23view0 | 법과 연구 방향을 사회집단 간 정치문제로 처리 | Council Hall에서 파벌 이해를 조정한다는 구조는 **확인**; 개별 promise의 정확한 현재 계산은 이번 조사에서 **미확인** citeturn23view0 | 한 정책을 “누가 좋아하고 누가 싫어하는가”로 즉시 읽힘 | **요구·협상·파벌 반응의 표면 UI**에 가장 유용 |
| **Tropico 6** | factions + electorate라는 패턴은 알려져 있으나 이번 조사에서 최신 공식 상세 자료 미확보 → **미확인** | constitution/edict가 집단 태도와 연결되는 패턴으로 참고 가능, 세부는 **미확인** | faction demand와 election 압박의 순환 패턴. 최신 계산은 **미확인** | 복잡한 정치보다 “요구 하나 → 만족/불만”을 명확히 표면화 | **짧은 요구 이벤트와 정치적 피드백** 참고 |
| **Manor Lords** | 현재 공식 설명의 중심은 주민·경제·정착지이지 독립된 정치 파벌이 아님 | 중세 lord가 마을·burgage·자원·생산을 관리. Early Access라 변동 가능 citeturn23view3 | 이번 과제의 rights-holder 간 견제 모델은 핵심 기능이 아님 | 공간·경제 결과가 도시 성장으로 보이는 직접성 | **정치 설계의 양성 사례보다 ‘정치가 없는 기초층’ 비교군** |
| **Europa Universalis IV** | Estates라는 집합 행위자 패턴 | Estate Privilege를 주고 되찾는 구조는 이번 프로젝트와 매우 가까움. 최신 수치·조건은 **미확인** | 특권이 세력의 힘·충성·국가 능력 사이 trade-off를 만든다는 설계 패턴 | privilege 목록 자체가 “누가 무엇을 받았나”의 registry 역할 | **권리 등록부와 회수 비용**의 가장 직접적 참고 |

### CK3에서 가져올 것은 “Opinion 점수”보다 합법성 구조다

CK3식 정치의 중요한 부분은 수치 자체가 아니라 **동일한 행동도 법적 원인이 있느냐에 따라 다른 정치적 의미를 갖는다는 점**이다. 이 구조를 그대로 번역하면 다음과 같다.

`도시가 charter obligation을 명백히 위반 → lord의 intervention cause 생성`  
`cause를 근거로 일시 정지 → 제3자 반응 작음`  
`cause 없이 같은 권리를 회수 → grievance + lord unreliability`

따라서 Feudal Lord Simulator에는 CK식 “opinion” 하나보다 **`cause` 객체**가 더 중요하다.

```ts
type Cause =
  | "breach_of_grant"
  | "arrears"
  | "public_disorder"
  | "royal_judgment"
  | "expired_term"
  | "none";
```

그리고 UI는 반드시 `정당한 사유: 체납 조항 위반` 또는 `정당한 사유 없음`을 행동 버튼 바로 옆에서 보여줘야 한다.

CK3의 개별 character 기억·opinion modifier 감쇠 세부는 현행 버전 공식 자료를 이번 조사에서 확인하지 못했으므로 **미확인**으로 남긴다. 이 프로젝트에는 그것을 그대로 복제하기보다 “과거 행동이 named grievance token으로 남고 필요하면 감쇠한다”는 일반 구조만 차용하는 편이 안전하다.

### Victoria 3에서 가져올 것은 “부유한 상인은 정치적으로 강해진다”의 자동 연결이다

Victoria 3형 모델의 가장 유용한 부분은 플레이어가 `Merchant Influence +10` 버튼을 직접 누르지 않아도 **경제구조가 정치권력의 기반을 바꾼다**는 사고방식이다. 현재 버전의 Interest Group 계산식·movement 구조는 이번 조사에서 공식 자료를 충분히 검증하지 못했으므로 세부는 **미확인**이지만, 이 설계 원리는 Feudal Lord Simulator와 강하게 맞는다.

즉 상인 가문에는 별도의 “정치 XP”를 주기보다 다음이 자동으로 이어져야 한다.

`trade surplus / warehouses / credit claims`
→ `wealth & credit capacity`
→ `office candidacy / patronage`
→ `town council control`
→ `ability to coordinate petition or withholding`

이 구조라면 플레이어가 상인에게 직접 권리를 하나도 주지 않아도, **도시에 넘긴 권리가 상업성장을 만들고 → 성장한 상인이 도시의 권리를 장악해 → 영주를 견제**하는 의뢰서의 핵심 목표가 자연스럽게 발생한다.

### Frostpunk 2에서 가져올 것은 “정치가 먼저 말을 걸어오는 것”이다

Frostpunk 2의 공식 소개는 플레이어를 Steward로 두고, 도시 내부의 강한 factions가 Council Hall에서 매 행동을 주시하며 서로 다른 ideology와 미래상을 가지고 power를 추구한다고 명시한다. 또한 도시가 커질수록 factional power를 관리하는 문제가 커진다고 설명한다. citeturn23view0

이것은 이번 프로젝트에 매우 좋은 힌트다. 도시 정치가 단순히 `Politics` 탭에 들어갔을 때만 존재하면 안 된다.

예:

> **상인 대표단이 찾아왔습니다**  
> “올해 시장 통행세 징수권을 도시가 직접 맡게 해 주십시오.”  
> 수락 시: 고정 farm 확보 · 영주 직접수입 감소 · 도시 상업 기대 상승  
> 거절 시: 즉시 반란 X · `toll grievance` 생성

그 뒤 플레이어가 다른 결정을 내릴 때 기존 grievance가 새 사건과 합쳐져야 한다.

Frostpunk식 “요구/협상/약속”의 정확한 현행 알고리즘은 이번에 공식 개발일지 본문으로 확인하지 못했기 때문에 수치·기간을 가져와서는 안 된다. 차용할 것은 **행위자가 먼저 의제를 제시하고, 그 의제를 플레이어가 명시적으로 받아들이거나 거절한다는 UI 문법**이다.

### Tropico 6에서 가져올 것은 짧은 요구 루프, 가져오지 말 것은 평면적 faction approval다

현행 Tropico 6의 세부 faction 계산은 이번 조사에서 공식 자료 확인에 실패하여 **미확인**이다. 설계 패턴 수준에서 유용한 것은 “집단이 요구를 내고 → 플레이어가 대응하고 → 선거/정치적 지지가 반응한다”는 짧은 피드백 루프다.

하지만 Feudal Lord Simulator는 faction approval만 사용하면 부족하다.

`Merchants: 42 approval`

보다

`Merchants distrust Lord`
- `− 강제 toll 회수, 3년 전`
- `− William atte Bridge의 대출 미상환`
- `+ 최근 시장 법정 항소 인정`
- `현재 요구: 도시 bailiff 선출권 확인`

이 훨씬 목표에 맞다.

즉 **approval은 summary이며 원본 데이터가 아니다.**

### Manor Lords는 의도적으로 “정치의 하한”으로 보는 편이 좋다

Manor Lords의 공식 설명은 late-14th-century Franconia를 참고한 lord 중심의 도시건설, resource/production chain, burgage plot, 주민의 생산활동과 세금 등을 강조한다. 또한 여전히 Early Access이며 mechanics가 추가·조정될 수 있음을 명시한다. citeturn23view3

이번 프로젝트에 주는 교훈은 역설적이다.

Manor Lords 수준의 **영주 → 경제 → 정착지 성장**만으로도 도시건설 core loop는 성립한다. 따라서 rights politics는 첫날부터 모든 생산 시스템을 덮어쓰는 메타게임일 필요가 없다. C단계에서는 Manor Lords에 가까운 직영·도시운영을 유지하고, 도시가 충분히 성장했을 때 “직접 운영의 부담을 줄이기 위해 권리를 넘긴다”는 정치가 등장하게 하는 것이 자연스럽다.

### 정치의 “기억”은 세 종류로 분리하는 것이 좋다

지정 게임들의 서로 다른 방식을 종합하면, 한 개의 `trust`에 역사를 압축하지 않는 편이 좋다.

**현재 태도(current stance)**  
현재 세금, 식량, 관직, 권리 분배에 대한 즉각 반응. 비교적 빨리 변한다.

**사건 기억(grievance/memory)**  
`unlawful_toll_seizure`, `broken_charter_promise`, `protected_market`, `pardoned_arrears`처럼 원인을 가진 레코드다. 일부는 시간이 지나 감쇠하지만, 문서화된 charter violation이나 피살·몰수 같은 것은 오래 남을 수 있다.

**평판(reputation)**  
특정 actor의 감정이 아니라 “이 영주에게 받은 grant를 믿을 수 있는가?” 같은 사회적 신호다. `grantReliability`, `legalReputation`가 여기에 해당한다.

의뢰서의 “일방 회수는 모든 행위자 신뢰를 낮춘다”는 규칙은 이 셋을 섞고 있다. 더 좋은 방식은:

`피해 actor grievance: 매우 큼`  
`관련 merchant/town reliability update: 중~큼`  
`멀리 떨어진 actor: 사건이 알려지고 이해관계가 있을 때만 반응`

이다.

### 규모의 현실적 하한

이 부분은 역사적 사실이 아니라 **시제품 설계 가설**이다.

도시 한 곳을 다루는 게임이라면 정치적으로 의미 있는 행위자를 수백 명 만들 필요가 없다. 오히려 최소 정치가 성립하려면 “서로 다른 자원과 견제수단을 가진 3~4개의 의사결정 주체”면 충분하다.

최저선은 다음 정도다.

`Lord + Town Community + Merchant Elite + Commons`

그리고 매 actor에 범용 변수 7~8개를 넣기보다 **보이는 핵심 상태 2~3개**만 두고, 나머지는 rights/ledger/event에서 계산하는 편이 좋다.

정치 사건도 수십 개의 bespoke event보다 먼저:

`request`
`petition`
`breach`
`arrears`
`revocation`
`confirmation`
`collective_defiance`

같은 **재사용 가능한 사건 문법**을 만드는 것이 중요하다.

복잡성의 원천은 event 수가 아니라 **권리·경제·기억의 조합**이어야 한다.

## 과제 C — Feudal Lord Simulator 적용안

### 초기 설계 가설 판정

| 초기 가설 | 판정 | 수정안 |
|---|---|---|
| demesne / franchise / 상위 권한의 3층 | **수정** | `Asset/Tenure`와 `Right/Jurisdiction`를 분리하고, 왕실 여부는 `authoritySource`로 기록. 왕실 시장 franchise의 성격은 명확히 확인됨. citeturn13search3turn13search7 |
| `holder, grantor, source, obligations, term, legitimacy, revocability` | **대체로 맞음** | `holder` 외에 `operator`, `beneficiary`; `scope`, `recognition`, `enforceability`, `reversion`, `contestState` 추가 |
| `grantor` 연쇄 | **수정** | custom/prescription에는 grantor가 없을 수 있으므로 nullable. 대신 `authorityChain[]` |
| legitimacy 하나 | **수정** | `legalStrength`, 각 actor의 `recognition`, 실제 `enforceability` 분리 |
| revocability 하나 | **수정** | 숫자보다 `terminationClauses`, `validCause`, `confirmation`, `term`에서 파생 |
| Lord / Town / Merchant Family / Guild / Church / King / Poor | **맞음, 단계화 필요** | 시작부터 전부 활성화하지 말고 C는 Town, E는 Merchant+Crown, 이후 Church/Commons |
| 계약 위반 회수 / 재협상 / 왕실 청원 / 일방 회수 | **맞음, 보강** | `expiry/reversion`, `temporary suspension`, `custody/seizure`, `restoration` 추가. 런던 1285–99가 좋은 suspension/custody 사례. citeturn13search0turn13search8 |
| 일방 회수 → 모든 actor trust 감소 | **틀림에 가까운 과도한 단순화** | 직접 피해자의 grievance + 사건을 안 제3자의 `lordReliability`만 갱신 |
| wealth / office / lord-credit / guild-marriage → merchant power | **대체로 맞음** | `office control`을 핵심으로 승격. 소도시 loan coercion은 **가설** |
| loan refusal / court defiance / farm delay / petition / trade exit / riot | **수정** | petition·litigation은 강한 역사 근거. deliberate arrears·loan pressure·trade flight는 상황적/게임적 선택 |
| Influence / Discontent / Trust | **수정** | `power/capacity`, relational `trust`, 원인을 가진 `grievances[]`로 나눔 |
| 내부는 복잡하게, 표면은 원인 한 줄 | **맞음** | 첨부 CORE_LOOP의 “행동 전 예측 / 문제 후 원인 / 요청 시 상세”와 정확히 일치 |

**가장 중요한 빠짐**은 다섯 가지다.

**holder와 operator의 분리.** toll의 법적 보유자와 실제 징수자가 다를 수 있다.

**de jure와 de facto의 분리.** 무력 장악은 권리의 법적 소멸이 아니다. London과 abbey-town 사례에서 특히 중요하다. citeturn13search0turn13search9

**scope.** 같은 “court right”라도 도시 경계, 특정 burgesses, 특정 종류의 plea에만 적용될 수 있다.

**recognition.** 영주는 유효하다고 보고, 도시는 부인하고, 국왕은 아직 판결하지 않은 상태가 가능해야 한다.

**instrument/document.** charter·lease·custom·judgment가 정치적 증거다. 1381형 반란에서 문서를 공격하는 행동을 만들려면 처음부터 권리와 문서의 연결이 있어야 한다. citeturn13search1turn13search9

### 행위자 최소 세트와 확장 세트

시제품에서 **정치적 actor는 네 개를 넘기지 않는 편**을 권한다. 다만 Lord는 플레이어이므로 실제 AI 의사결정자는 3개뿐이다.

| Actor | 목표 | 화면에 보일 핵심 변수 | 가능한 행동 |
|---|---|---|---|
| **Lord — 플레이어** | 수입, 통제, 영지 성장, 왕실에 대한 의무 수행 | `authority`, `grantReliability`, `royalStanding` | grant, lease, confirm, suspend, litigate, seize, pardon |
| **Town Community** | 예측 가능한 세금·시장 운영, self-government, collective liberties | `trustInLord`, `cohesion`, `autonomyStake` | request, petition, negotiate farm, collective payment, legal resistance |
| **Merchant Elite** — 초기에는 composite | 상업수익, 안전한 법, toll 부담 완화, 관직 접근 | `creditCapacity`, `officeControl`, `trustInLord` | offer/refuse credit, lobby town, petition, redirect investment, support faction |
| **Commons / Tenants** | 생계, customary rights, 낮은 coercion | `subsistencePressure`, `customaryGrievance`, `mobilization` | petition, evade obligation, crowd action, join revolt |

C단계에서는 Town Community만 완전히 활성화하고, Merchant/Commons는 population tag 또는 hidden pressure로 남겨도 된다. 즉 **데이터 타입은 네 actor를 지원하되 AI는 Town 하나만 돌리는 방식**이다.

확장 시에는 다음과 같이 분해한다.

`Merchant Elite` → 2~3 named merchant houses + guild/merchant fraternity  
`Commons` → urban craftsmen / rural tenants를 필요할 때만 분리  
`Church` → parish/abbey/bishopric 중 실제 rights holder인 경우  
`Crown` → off-map adjudicator에서 능동 actor로 승격

교회는 모든 맵에 generic “Church faction”을 만드는 대신 **abbey-town 시나리오에서 영주 또는 co-lord 역할**로 등장시키는 편이 Bury/St Albans 사례에 더 가깝다. citeturn13search1turn13search2

### 권리 등록부의 초기 세트

아래의 11개는 “모든 도시에 반드시 존재”하는 목록이 아니라 **엔진이 표현할 수 있어야 하는 초기 vocabulary**다. 일부는 처음부터 비활성 상태로 두면 된다.

| Right | 종류·역사 근거 | 기본 보유 상태 | 위임/이전 | 회수 난이도 | 장부 연결 |
|---|---|---|---|---|---|
| **Market holding right** | royal franchise. 시장·박람회는 왕실 grant/prescription이 핵심 citeturn13search3turn13search7 | 왕실 grant를 받은 Lord 또는 borough | holder가 가진 범위에서 operation 위임 가능 | **높음**: upstream royal title이면 임의 삭제 불가 | 시장수익의 근원 `SourceRef`, 자체로 현금은 아님 |
| **Market toll collection** | market franchise와 구별되는 실제 징수·farm | Lord가 직접 운영 또는 Town/farmer | **쉬움~중간** | 계약 term·charter에 따라 | 일반 현금 / farm payment |
| **Suit of mill / multure** | manorial/customary obligation | Lord | 일부 운영은 miller에게 farm 가능; obligation 자체는 별도 | 관습·tenure에 따라 중~높음 | mill income, in-kind grain |
| **Low borough/manorial court** | local civil/manorial jurisdiction | Lord 또는 chartered Town | jurisdiction/administration 일부 위임 가능 | **중~높음** | court fees/amercements |
| **Leet / view of frankpledge 계열** | 더 강한 jurisdictional franchise; 모든 lord에게 자동 아님 | 권원을 가진 Lord | 권원 범위 내 | **높음** | court revenue + policing rule |
| **Officer nomination** | Lord가 bailiff/reeve 등을 임명 | Lord | Town에 nomination/election 일부 양보 | **중간** | 직접 현금보다 rule |
| **Officer election** | borough liberty bundle의 핵심 요소가 될 수 있음 | 초기에는 없음/제한 | charter로 Town에 부여 | **높음**: 명시 charter이면 정치적 회수 비용 큼 | administration modifiers |
| **Bylaw / ordinance power** | 공동체의 내부 규율 | Lord/borough가 범위별 보유 | scope를 나눠 grant | **중간** | `EffectSpec.rule` |
| **Guild/merchant association recognition** | 도시 상업조직과 privilege의 결합. 지역차 큼 | Lord/Town/Crown 관계에 따라 | grant/recognition 가능 | **중간~높음** | market access, membership fee 등 |
| **Common pasture/wood use** | custom으로 중첩되는 주민 이용권 | Commons가 customary claimant | 매각보다 규제·확인이 일반적 | **높음**: 일방 enclosure/제한은 grievance 큼 | in-kind access, household cost |
| **Murage collection authority** | 기존 경제조사에서 다룬 temporary/earmarked grant | grant 대상 | 기한·목적에 따라 | term 만료는 쉬움, 일방 전용은 어려움 | **earmarked fund** |

여기서 **fee farm은 이 표에 넣지 않는 것**을 권한다.

```text
RightBundle
    └─ market_tolls
    └─ local_court
    └─ officer_selection

Grant/Settlement
    Town receives: [those rights]
    Town owes: annual_fee_farm
```

즉 fee farm은 `Right`가 아니라 **`ObligationSpec` 또는 `GrantInstrument`의 consideration**이다. 이것은 이후 체납 시 “권리 자체가 자동으로 사라지는가?”라는 문제를 훨씬 깨끗하게 처리한다.

마찬가지로 “market franchise”와 “market toll cashflow”를 떼어 놓아야 한다. CMH 자료가 보여주듯 charter는 시장을 열 수 있는 권원을 주지만 실제 시장이 반드시 생긴 것은 아니다. 게임에서도 `permission`과 `resource_flow`가 동일 객체여서는 안 된다. citeturn13search3

### 회수와 견제 규칙

회수는 다음 다섯 경로면 충분하다.

| 방식 | 역사 근거 | 즉시 결과 | 장기 결과 |
|---|---|---|---|
| **Expiry / Reversion** | **확정**: term·farm 종료의 기본 논리 | 권한이 예정된 holder로 돌아감 | grievance 거의 없음 |
| **Breach-based suspension** | **확정/유력** | 위반된 권리의 exercise를 일시 정지 | cause가 분명하면 제3자 신뢰 손실 작음 |
| **Negotiated surrender / buy-back** | **유력** | 대가를 지급하고 권리를 돌려받음 | Town grievance 낮지만 Lord cash cost |
| **Royal adjudication / confirmation** | **확정**: 왕실 charter·Quo Warranto·중재 구조와 일치 citeturn13search7 | legal status 재판정 | 양측이 불리한 판결을 받아도 legitimacy가 높음 |
| **Unilateral seizure** | **확정**: de facto 가능. London 1285처럼 custody 형태도 존재 citeturn13search0turn13search8 | operator 변경, 수입·관직 장악 | grievance, petition, litigation, reliability 손상 |
| **Force / suppression** | **확정**, abbey-town conflict에서 양 방향 모두 관찰됨 citeturn13search1turn13search9 | de facto control 강제 | legal claim은 남고 장기 grievance가 매우 큼 |

여기서 **Breach가 있으면 자동 회수 가능**으로 구현하면 안 된다.

예:

`Town missed one fee-farm payment`

이것만으로 영구 officer-election charter까지 몰수할 수 있다는 뜻은 아니다.

올바른 계산은:

```text
ValidCause =
    breach exists
    AND breach concerns this grant
    AND instrument contains remedy/termination path
    AND cure period or judgment requirements are met
```

이다.

**royal petition 역시 만능 취소 버튼이 아니다.** 왕실은 royal franchise의 권원, 법정, confirmation, public order에 강하게 개입할 수 있지만, 플레이어가 “왕에게 100 influence 지불 → 도시의 모든 권리 삭제”하는 시스템은 피해야 한다. Quo Warranto의 핵심도 arbitrary delete가 아니라 “by what warrant?”라는 권원 심사였다. citeturn13search7

상인 견제는 하나의 반란 threshold보다 **escalation ladder**가 낫다.

```text
불만 발생
  ↓
개별 청원 / 협상 요구
  ↓
도시 관직을 통한 집단 요구
  ↓
credit 조건 악화 / 투자 축소 / 법적 비협조
  ↓
왕실 청원·소송
  ↓
집단적 불복·체납·시설 장악
  ↓
폭동 / 반란
```

발동 가능성을 만드는 개념식은 다음 정도면 충분하다.

```text
PressureReadiness
≈ grievance severity
× organizational capacity
× stake in disputed right
× perceived chance of success
```

여기에 정확한 숫자를 확정할 필요는 없다.

상인별 행동은 역사 근거를 이렇게 구분한다.

**강한 역사 근거:** petition, litigation, office bloc, collective bargaining, charter confirmation 요구.  
**중간 근거:** credit 조건 악화, 새로운 lord loan 거부.  
**게임적 외삽:** 기존 대출을 즉시 회수해 lord를 굴복시키기, 조직된 trade strike.  
**위기 때 역사 근거:** facilities/records 장악, riot, armed support.

반대로 Commons의 escalation은 다른 자원으로 계산해야 한다. 상인은 `credit + office control`, Commons는 `numbers + shared grievance + mobilization opportunity`를 쓴다. 두 actor에게 같은 `Influence` 자원을 주면 정치가 평면화된다.

### 가독성 설계

첨부 `CORE_LOOP_AND_UI_PLAN.md`의 원칙:

> **행동 직전엔 예측, 문제 직후엔 원인, 깊이 볼 때만 상세**

을 그대로 정치에도 적용할 수 있다.

**행위자 패널**은 다음 정보만 1단계 화면에 보여준다.

```text
도시 공동체
관계: 불신
힘: 강함
현재 핵심 쟁점: 통행세 징수권

왜?
↓ 통행세 일방 회수
↓ bailiff 선출 약속 미이행
↑ 최근 시장 법정 판결 인정
```

여기서 `불신 37/100`보다 **“왜 불신하는가”가 한 줄 먼저** 나와야 한다.

**권리 등록부(Rights Register)** 는 자산창고 UI가 아니라 토지등기·charter book에 가까워야 한다.

```text
시장 통행세 징수
법적 보유자    Lord
현재 운영자    Town Community
수익 귀속      Town → annual farm to Lord
근거           Royal market grant → Lord → town lease
범위           weekly market
기한           lease until ...
인정 상태       Lord ✓  Town ✓  Crown ?
분쟁           없음
```

하단에서만 원문 chain을 펼친다.

**행동 전 예측**은 전체 정치 계산을 보여주지 말고 “바뀌는 원인”을 보여준다.

```text
[통행세 징수권 회수]

법적 근거       약함
즉시
  + 영주 직접 toll 수입
  − Town의 운영권

정치
  Town 신뢰       크게 하락
  Merchant 불만   증가
  Royal petition  가능

장기
  이 회수가 공개되면
  '영주의 grant 신뢰도'가 하락할 수 있음
```

중요한 것은 `−12`, `+7`을 앞세우지 않는 것이다. 내부적으로 숫자가 있더라도 표면에는 **작음 / 중간 / 큼 + 원인**이 먼저다.

**문제 발생 직후 원인 패널**:

```text
상인들이 새 대출을 거부했습니다.

주원인
  통행세 회수 grievance        45%
  미상환 lord debt             35%
  상업 경기 악화               20%

가능한 대응
  권리 재협상
  채무 일부 상환
  다른 creditor 탐색
```

퍼센트도 필수는 아니다. 핵심은 결과를 actor personality로 설명하지 않고 실제 state/source에 되돌려 연결하는 것이다.

**conflict ladder**도 미리 보여야 한다.

```text
Town dispute: Market Toll

현재  ● Petition
다음  ○ Royal appeal
      ○ Collective withholding
      ○ Riot

Royal appeal 가능성이 상승하는 이유:
  Town cohesion 높음
  charter evidence 강함
  Lord가 재협상을 거절함
```

이것이 Frostpunk 2식 “파벌이 무엇을 원하는지 보이는 것”과 CK식 “관계 원인을 분해하는 것”을 결합하는 방식이다. Frostpunk 2가 공식적으로 서로 다른 faction interests와 Council Hall을 게임의 중심 갈등으로 제시한다는 점은 이 UI 방향과 잘 맞는다. citeturn23view0

복잡도가 좌절을 만드는 지점은 **내부 계산의 수가 많아서가 아니라 causal chain이 끊길 때**다. 이 프로젝트에서는 특히 다음 세 상황을 피해야 한다.

`Town Trust -18`인데 무엇 때문인지 알 수 없음.  
Charter를 누르기 전에는 fee farm과 merchant reaction을 알 수 없음.  
사건 로그에서 “상인 불만”만 나오고 원래 회수한 Right의 `sourceRef`로 돌아갈 수 없음.

따라서 “내부는 복잡, 표면은 원인 한 줄”은 미학이 아니라 **데이터 구조 요구사항**이다.

### 현재 로드맵의 데이터 구조에 끼우는 방법

첨부 `ROADMAP_2026-09-23.md`의 B단계가 이미 좋은 접점을 가지고 있다.

현재:

```ts
SourceRef
EffectSpec
PredictionLine
AppliedEffect
LedgerEntry {
  tick,
  category,
  amount,
  account,
  sourceRefs
}
```

여기서 **새 effect engine을 만들지 않는 것**이 중요하다. Right는 기존 `EffectSpec`을 **발행하는 source**가 되면 된다.

권고 구조는 다음과 같다.

```ts
type ActorId = string;
type RightId = string;
type InstrumentId = string;

type RightStatus =
  | "active"
  | "suspended"
  | "seized"
  | "disputed"
  | "expired";

type AuthorityBasis =
  | "royal_charter"
  | "lordly_charter"
  | "custom"
  | "prescription"
  | "lease"
  | "judgment"
  | "seizure";

interface RightDefinition {
  id: RightId;
  kind:
    | "market"
    | "toll"
    | "court"
    | "officer_selection"
    | "bylaw"
    | "mill_suit"
    | "common_use"
    | "guild_recognition"
    | "public_levy";
  defaultEffects: EffectSpec[];
}

interface RightHolding {
  id: string;
  rightId: RightId;

  // 반드시 분리
  deJureHolderId: ActorId;
  operatorId?: ActorId;
  beneficiaryId?: ActorId;

  scopeRef: SourceRef;

  sourceInstrumentIds: InstrumentId[];
  authorityChain: SourceRef[];

  startTick: number;
  endTick?: number;

  status: RightStatus;

  obligations: ObligationSpec[];
  terminationClauses: TerminationClause[];

  reversionToId?: ActorId;

  legalStrength?: number;       // 내부 계산용
  enforceability?: number;      // 법적 권원과 별도

  contest?: {
    claimants: ActorId[];
    reasonRefs: SourceRef[];
  };
}
```

`legitimacy`를 하나의 숫자로 저장하기보다 **recognition은 actor별 관계 데이터**로 두는 편이 좋다.

```ts
interface RightRecognition {
  rightHoldingId: string;
  actorId: ActorId;
  stance: "recognized" | "disputed" | "unknown";
  reasonRefs: SourceRef[];
}
```

grant/charter/lease는 별도 instrument다.

```ts
interface GrantInstrument {
  id: InstrumentId;

  fromActorId: ActorId;
  toActorId: ActorId;

  grantedRightIds: string[];

  basis: AuthorityBasis;

  consideration?: ObligationSpec[];
  conditions?: ConditionSpec[];

  confirmedByActorId?: ActorId;

  startTick: number;
  endTick?: number;

  status:
    | "valid"
    | "breached"
    | "challenged"
    | "voided"
    | "fulfilled";

  sourceRefs: SourceRef[];
}
```

행위자의 grievance도 modifier가 아니라 원인 기록으로 둔다.

```ts
interface Grievance {
  id: string;
  actorId: ActorId;
  againstActorId: ActorId;

  kind:
    | "unlawful_revocation"
    | "broken_promise"
    | "arrears_dispute"
    | "office_exclusion"
    | "customary_right_violation";

  severity: number;

  createdTick: number;
  decay?: {
    mode: "none" | "slow" | "normal";
  };

  sourceRefs: SourceRef[];
  relatedRightId?: string;
  relatedInstrumentId?: InstrumentId;
}
```

이 구조의 장점은 `EffectSpec`을 거의 건드리지 않는다는 데 있다.

기존 종류가:

```text
modifier
rule
permission
resource_flow
event_weight
```

라면 이미 충분하다.

예를 들어 market toll right는:

```text
permission:
  can_collect_market_toll

resource_flow:
  payer -> operator

event_weight:
  merchant_arrival +...
```

를 발행한다.

Town에게 operation을 넘기면 **EffectSpec 자체를 새로 정의하는 것이 아니라 적용 대상과 flow endpoint가 바뀐다.**

마찬가지로 officer-election right는:

```text
permission:
  town_can_select_bailiff

rule:
  lord_direct_appointment_disabled
```

이다.

따라서 “Right system”은 경제·정치 위에 또 하나의 독립 시스템이 아니라 **기존 effect graph의 법적 source layer**가 된다.

`LedgerEntry.sourceRefs`에는 지금부터 다음 source type을 비워 두는 것을 권한다.

```ts
type SourceRefType =
  | "building"
  | "zone"
  | "policy"
  | "event"
  | "scenario"
  | "trade"
  | "right"       // 지금 추가
  | "instrument"  // charter / lease / judgment
  | "actor"
  | "claim";
```

예:

```text
LedgerEntry
  category: market_toll
  amount: ...
  account: general
  sourceRefs:
    - right:market_toll_01
    - instrument:town_toll_lease_03
    - actor:town_community
```

그러면 플레이어가 수입 항목을 클릭하여:

`이번 toll 수입`
→ `도시가 징수`
→ `왜 도시가 징수?`
→ `131x charter/lease`
→ `왜 이 charter가 유효?`
→ `Lord의 royal market franchise`

까지 내려갈 수 있다.

이것이 첨부 문서의 **“문제 후 원인”** 원칙과 완전히 같은 causality graph다.

**지금 필드만 만들고 비워 둬야 하는 것**은 다음이다.

`operatorId`  
`beneficiaryId`  
`authorityChain`  
`scopeRef`  
`sourceInstrumentIds`  
`endTick`  
`conditions`  
`terminationClauses`  
`reversionToId`  
`contest`  
`recognition`  
`enforceability`

반대로 지금부터 `MerchantInfluence`, `ChurchTrust`, `RoyalFavor` 같은 고정 필드를 SimulationState에 박는 것은 피하는 편이 좋다. 행위자는 확장 가능한 entity여야 한다.

### 단계적 도입

**B단계 — 지금**

시뮬레이션하지 않는다.

`RightDefinition`, `RightHolding`, `GrantInstrument`, `ActorId` 타입과 `SourceRef` 확장만 넣는다. 기존 건물·구역·정책이 만든 effect와 ledger가 나중에 rights source를 받아도 깨지지 않는지만 확인한다.

예를 들어 현재 lord-owned mill income에:

```text
sourceRefs:
  building:mill_01
  right:mill_suit_default
```

를 달 수 있는 정도면 충분하다.

**C단계 — 영주 직영 + Town Community 하나**

활성 정치 actor는 사실상 Town 하나다.

초기 권리는 3~4개만 플레이한다.

`market toll operation`  
`mill suit`  
`local court administration`  
`bylaw/ordinance scope`

Town이 아직 완전 자치하지 않아도:

`이 권리를 직접 운영할 것인가`
`Town에 farm할 것인가`

를 선택할 수 있게 한다.

이 단계에서 반드시 검증할 것은 “정치가 재미있는가”가 아니라:

**권리를 클릭했을 때 돈·행위자·원인으로 추적되는가?**

이다.

**E단계 — charter와 실제 권력 이동**

여기서 처음으로 “자치 특허”를 bundle UI로 제공한다.

예:

```text
Limited Borough Charter

Town receives
  market toll operation
  internal bylaw power
  bailiff nomination

Lord retains
  market franchise title
  major court jurisdiction
  mill suit

Town owes
  annual fee farm
```

내부적으로는 세 개의 RightHolding 변경 + 하나의 GrantInstrument + 하나의 Obligation이다.

이때 Merchant Elite를 활성화한다.

처음에는 1개의 composite actor로 시작하거나, named family를 넣고 싶다면 2개 정도로 나눌 수 있다. 정확한 숫자는 이후 결정사항이다.

E단계에는 다음 loop까지 넣는다.

`charter`
→ `town grows`
→ `merchant wealth grows`
→ `office control grows`
→ `merchant/town demand`
→ `lord grant/refusal`
→ `grievance`
→ `petition to Crown`

Crown은 여기서 처음부터 전국 AI로 돌릴 필요가 없다. **off-map adjudicator**면 충분하다.

`Petition sent`
→ evidence/royal relation/public order 고려
→ confirmation / mediation / inquiry / refusal

로 구현한다.

**E 이후 — 권리가 서로 충돌하는 정치**

이후에 abbey town 시나리오를 추가하는 것이 좋다. Bury와 St Albans 자료는 “교회 파벌 +10”이 아니라 **수도원 자체가 lord/rights holder인 다른 시작조건**을 만드는 근거가 된다. citeturn13search1turn13search2

그다음 확장은:

`2~3 merchant families`
→ office competition

`craft guilds`
→ merchant oligarchy에 대한 내부 opposition

`Commons Movement`
→ customary rights crisis

`Crown active`
→ confirmation / quo warranto / seizure

`Document politics`
→ charter theft/destruction/forgery/evidence loss

순서가 자연스럽다.

이때 1381형 위기는 단순 “rebels spawn”이 아니라:

```text
Commons occupy court
Town radicals seize charter chest
mill suit enforceability collapses
abbot/lord forced to sign concession
Royal response pending
```

처럼 현재 rights graph 자체를 흔드는 위기가 된다. Bury와 St Albans의 사례가 이 형태를 역사적으로 뒷받침한다. citeturn13search1turn13search9

## 의뢰자 결정 질문

**자치 특허를 플레이어에게 어떻게 보여줄 것인가?**  
A. “Limited / Broad / Full Charter” 같은 패키지를 선택하되 내부적으로 원자적 권리를 사용 → 접근성이 가장 높고 현재 방향과 잘 맞음.  
B. 권리 하나씩 직접 협상 → 깊이는 크지만 초반 인지부하가 크게 증가.

**왕실은 E단계에서 어떤 존재인가?**  
A. `off-map adjudicator` → petition·confirmation·seizure 이벤트만 처리하므로 구현 부담이 낮음.  
B. 항상 상태를 가진 완전한 actor → 장기적으로 깊지만 초기 정치가 지나치게 전국정치화됨.

**상인을 처음 어떻게 표현할 것인가?**  
A. `Merchant Elite` 하나 → charter와 credit loop 검증이 빠름.  
B. 2~3 named families → 혼인·경쟁·관직 독점이 즉시 가능하지만 UI와 AI 부담 증가.

**도시 공동체와 상인 엘리트의 관계를 분리할 것인가?**  
A. 분리 → “Town이 권리를 보유하지만 merchants가 Town을 장악”하는 과두정을 표현 가능.  
B. 합침 → 시제품은 단순하지만 후에 oligarchy를 넣을 때 데이터 이행 필요.

**Commons를 평시 actor로 항상 둘 것인가?**  
A. 항상 둠 → customary right와 계층갈등이 계속 보임.  
B. grievance가 임계에 이를 때 Movement로 생성 → 화면이 덜 복잡하고 1381형 동원이 더 사건적으로 느껴짐.

**강제 회수 뒤 남는 평판을 어느 정도 전역화할 것인가?**  
A. `lordGrantReliability`라는 공개 평판 하나를 둠 → 플레이어가 “이번 배신이 향후 charter 가치에 영향을 준다”를 쉽게 이해.  
B. actor별 기억만 둠 → 역사적으로 더 국지적이지만 장기 전략 효과를 읽기 어려움.

**de jure / de facto를 UI에도 직접 보여줄 것인가?**  
A. 분쟁 중에만 `법적 보유 / 실제 통제` 두 줄로 표시 → 복잡성을 필요할 때만 노출.  
B. 항상 두 줄 → 체계는 명료하지만 평시 UI가 무거워짐.

**권리 문서 자체를 플레이 자원으로 만들 것인가?**  
A. source/evidence 데이터만 저장 → 구현이 가볍고 Quo Warranto·청원에 충분.  
B. charter chest·record destruction까지 물리화 → Bury/St Albans·1381 시나리오는 강해지지만 별도 문서 시스템이 필요. citeturn13search1turn13search9

**영주의 “부당한 회수”를 금지할 것인가?**  
A. 금지하지 않음, 단 de facto seizure로 처리 → 플레이어에게 권력은 주되 법적 claim과 정치비용이 남음.  
B. legal cause 없이는 버튼 비활성화 → 이해하기 쉽지만 중세 lordship의 강제·분쟁 가능성을 지나치게 정돈함.

**흑사병 이후 변화를 어떤 층에서 표현할 것인가?**  
A. 권리 삭제가 아니라 `enforceability`와 tenant bargaining 변화 → 장기간의 제도 변화 표현에 적합.  
B. 특정 obligations 자동 폐지 → 구현은 단순하지만 역사적 변화가 지나치게 단절적으로 보임. 후기 중세 serfdom이 강제 관계였고 그 변화가 장기적 과정이었다는 연구와는 A가 더 잘 맞는다. citeturn17search1

## 근거 목록

**온라인 사료·VCH·학술 데이터베이스 — 확인일 2026-09-23**

British History Online, *The French Chronicle of London: Edward I*. 1285년 City of London이 왕의 손에 들어간 사실을 확인하는 연대기 자료. citeturn13search0

London Record Society / British History Online, *The Emergence of the London Skinners*. 1285–1298년 royal warden 통치와 1299년 charter에 의한 liberties 복원을 확인하는 연구. citeturn13search8

British History Online, *Calendar of the Early Mayor’s Court Rolls*, 1298. 1298년 런던 mayoral government의 복귀를 교차 확인하는 시정 기록. citeturn13search4

Victoria County History, Suffolk, *Houses of Benedictine Monks: Abbey of Bury St Edmunds*. 1327 Great Riot, abbey mint 관련 약탈 등 Bury town–abbey 갈등의 기본 자료. citeturn13search1

British History Online, *Plea and Memoranda Rolls*, Roll A, 1326–1327. Bury St Edmunds townsmen–monks quarrel을 당시 기록 맥락에서 확인. citeturn13search5

Victoria County History, Hertfordshire, *Houses of Benedictine Monks: St Albans Abbey*. 수도원 liberties와 장기적 borough conflict의 배경. citeturn13search2

Victoria County History, Hertfordshire, *The City of St Albans: The Borough*. townsmen이 abbot과 monks를 포위해 force and fear로 liberties를 grant하게 했다는 1381 분쟁의 핵심 자료. citeturn13search9

Centre for Metropolitan History / Institute of Historical Research, *Markets and Fairs in England and Wales to AD 1540* project reports. 시장·박람회가 12세기 말~13세기 초 왕실 franchise로 확립되었다는 점, Charter Rolls·Quo Warranto·prescription의 관계, grant가 실제 market operation을 자동 보장하지 않는다는 점의 핵심 근거. citeturn13search3turn13search7

Victoria County History, Suffolk, *Priory of Letheringham*. 1297년 priory에 fair가 grant된 ecclesiastical lord 사례의 보조 근거. citeturn2search8

Manchester University Press, *Serfdom in Medieval England*. 중세 잉글랜드 serfdom을 coercive landowner–peasant relationship으로 규정하는 현대 연구의 개요. citeturn17search1

**주요 학술서 — 본 보고서의 해석틀과 사례 교차검증**

Donald W. Sutherland, *Quo Warranto Proceedings in the Reign of Edward I, 1278–1294*. Edward I기의 franchise·liberty 조사에 관한 고전적 연구.

Susan Reynolds, *An Introduction to the History of English Medieval Towns*. 영국 중세 도시의 borough status, lordship, urban liberties를 비교하는 기본 연구.

R. H. Hilton, *English and French Towns in Feudal Society: A Comparative Study*. 도시와 feudal lordship을 별개의 세계가 아니라 상호의존적 권력관계로 보는 데 중요한 연구.

Caroline M. Barron, *London in the Later Middle Ages: Government and People 1200–1500*. 후기 중세 런던의 civic government·상인·도시정치에 관한 표준적 연구.

Richard H. Britnell, *The Commercialisation of English Society 1000–1500*. 시장 확대, 상업화, lordship과 현금경제의 연결을 검토하는 기본 연구.

Robert S. Gottfried, *Bury St. Edmunds and the Urban Crisis, 1290–1539*. Bury의 도시 공동체와 수도원 lordship 간 장기 갈등을 이해하는 핵심 단행본.

E. B. Fryde, *William de la Pole: Merchant and King’s Banker*. 왕실 finance에서 merchant-creditor가 갖는 정치적 영향력을 검토할 때의 핵심 사례 연구. **소도시 상인-영주 관계에 그대로 일반화하지 않음.**

Rodney Hilton, *Bond Men Made Free: Medieval Peasant Movements and the English Rising of 1381*. 영주권·농민 저항과 1381년 반란의 사회구조에 관한 기본 연구.

R. B. Dobson, *The Peasants’ Revolt of 1381*. 1381년 관련 사료와 지역 사례를 종합하는 표준 자료집·연구.

John Hatcher, *Plague, Population and the English Economy, 1348–1530*. 흑사병 이후 인구·노동시장 변화의 장기 효과를 이해하는 기본 연구.

Mark Bailey, *The Decline of Serfdom in Late Medieval England: From Bondage to Freedom*. 흑사병을 단번의 농민해방 사건으로 보지 않고 법적·경제적 협상과 제도 변화의 장기 과정으로 보는 데 중요한 연구.

Mark Bailey, *After the Black Death: Economy, Society, and the Law in Fourteenth-Century England*. 인구 충격 뒤 경제·법·사회관계가 재편되는 방식을 검토하는 최신 종합 연구 가운데 하나.

**게임 공식 자료 — 확인일 2026-09-23**

11 bit studios, **Frostpunk 2 공식 Steam 페이지**. 개발사·퍼블리셔 공식 설명에서 “powerful factions”, “Council Hall”, 서로 다른 faction ideology와 power 경쟁, 도시가 커짐에 따라 커지는 factional politics를 직접 확인. 세부 promise 알고리즘은 본 보고서에서 별도 공식 개발일지로 재검증하지 못했으므로 **미확인** 처리했다. citeturn23view0

Slavic Magic / Hooded Horse, **Manor Lords 공식 Steam 페이지**. late-14th-century Franconia 기반, lord 중심 city building, resource chains, burgage plots, 주민 생산과 taxation, Early Access 상태를 확인. 현재 공식 소개에서 rights-holder faction politics는 핵심 기능으로 제시되지 않으므로 이번 조사에서는 “정치 시스템의 비교 하한”으로 사용했다. citeturn23view3

Paradox Interactive, **Crusader Kings III 공식 Steam 페이지 및 개발일지 계열**. 공식 제품 페이지는 확인했으나 vassal-contract/faction/memory의 현행 2026 세부 규칙을 이번 세션에서 개발일지 본문으로 충분히 교차 검증하지 못했다. 따라서 본문의 해당 세부는 **미확인**으로 명시했으며 특정 수치·쿨다운을 제안에 사용하지 않았다. citeturn23view4

Paradox Interactive, **Victoria 3 개발일지 계열 — Interest Groups / Laws**. 검색 과정에서 공식 개발일지의 존재는 추적했으나 현재 패치의 본문·세부 계산식을 신뢰성 있게 불러오지 못했다. 따라서 `clout`, `approval`, law/political movement의 구체적 수치나 현행 규칙은 모두 **미확인**으로 취급했다.

Kalypso, **Tropico 6 공식 자료 계열**. 현재 버전의 faction standing·election·demand 계산에 대한 공식 상세 자료를 이번 세션에서 확보하지 못했으므로, 본 보고서에서는 요구 이벤트·선거 압력이라는 알려진 설계 패턴만 **미확인 참고**로 사용했다.

Paradox Interactive, **Europa Universalis IV Estate/Privilege 개발 자료 계열**. privilege registry라는 설계 패턴만 비교에 사용했으며, revoke 조건·loyalty/influence 임계치·현행 패치 수치는 공식 현행 자료를 이번 조사에서 검증하지 못했으므로 **미확인**으로 남겼다.