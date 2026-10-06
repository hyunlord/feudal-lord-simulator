# 모바일 비교군 B: Lords Mobile / State of Survival / Evony / Clash of Clans

조사·접근일: **2026-10-06**. 공개 웹자료를 읽은 문헌 조사이며 앱 실플레이, 유료 분석 대시보드, 코호트 데이터 조회는 수행하지 않았다. 아래 ‘3–5분 세션’은 기능 구조에서 도출한 설계 추론이지 관측 평균 세션 길이가 아니다. 리뷰는 검색·스토어 노출로 선택된 표본이며 불만 발생률이나 전체 이용자 의견을 대표하지 않는다. 가격은 명시된 스토어·통화의 당시 공개 표시이고 한국 결제 가격이 아니다.

## 1. Lords Mobile

**분류·핵심 재미.** 영웅 RPG를 결합한 지속형 월드맵 4X/SLG다. 성·건물 성장 → 연구·병력 생산 → 영웅 편성 → 길드 공동 전투 → 보상 재투자가 핵심이다. 공식 스토어는 영웅 수집, 건설·연구·훈련, 길드 영토 경쟁을 명시한다. Guild Expedition은 병력이 영구 소실되지 않는 별도 전장이다. 따라서 모든 전투를 동일한 영구 손실 모델로 설명해서도 안 된다. [IGG 공식 스토어 설명](https://play.google.com/store/apps/details?hl=en-US&id=com.igg.android.lordsmobile&listing=cs011).

**대기열·자원·장비·가챠.** 건설/연구/훈련의 타이머와 자원 비용을 병렬 관리하는 구조다. IGG는 훈련에 필요한 보석·가속·자원을 계산하는 도구를 제공하며, 장비 시뮬레이터에는 건설·연구·채집·훈련 속도, 식량·석재·목재·광석·금 생산 계수가 별도로 있다. 장비는 전투 외에도 경제 효율을 바꾸므로 단순 외형 수집이 아니다. 영웅 획득 전체를 ‘가챠’라고 뭉뚱그리지 않는다. **확률형 장비 재료 상자·유물 상자**는 공식 확률표에서 직접 확인된다. [공식 훈련 계산기](https://lordsmobile.igg.com/project/game_tool/index.php?action=baobing), [공식 장비 시뮬레이터](https://lordsmobile.igg.com/project/game_tool/index.php?action=zhuangbeimoni&lang=jp), [공식 확률 공개](https://lordsmobile.igg.com/project/probability/?game_id=1051029902).

**과금.** 공식 App Store 설명에 Turf Club 월 US$9.99(건설/연구 속도와 퀘스트 편의), Mirage Realm 월 US$4.99(자동 사냥·채집 관련), 주간 가속/자원 번들이 기재되어 있다. 인도 storefront의 개발자 설명에 쓰인 USD 기준이며 지역 최종 결제 가격은 미검증이다. ‘시간 절약 + 생산 효율 + 확률형 성장재료’가 함께 판매된다. [공식 App Store](https://apps.apple.com/in/app/lords-mobile-angry-birds-shot/id1071976327).

**3–5분 추론.** 보상 회수 → 건설/연구 재설정 → 채집·사냥 출정 → 길드 기여 하나 → 종료는 짧게 나눌 수 있다. 그러나 길드 경쟁과 실시간 위협은 별도의 긴 접속·시간 약속을 요구할 수 있어 ‘캐주얼 3분 게임’의 증거가 아니다. 지속 계정과 반복 전장 이벤트를 구분해야 하며 매 시즌 모든 성장이 초기화되는 구조라는 근거는 확보하지 못했다.

**시장 근거.** Sensor Tower APAC Awards 2025는 Lords Mobile이 세계 4X 매출 상위 10개에 장기간 속했다고 평가한다. 이것은 **글로벌·장르 제한 순위 주장**이지 2026-10-06의 전체 모바일게임 정확 순위나 매출액이 아니다. 해당 공개 소개는 gross/net 산정 정의와 플랫폼별 수치를 제공하지 않는다. [Sensor Tower, 2025 수상작 소개](https://develop.sensortower.com/blog/sensor-tower-apac-awards-2025).

**불만·보존할 재미.** Google Play에 노출된 J Tani(2025-06-15)는 길드 가입 후 요구 시간이 커지고 설명이 부족하다고 평가했고, Braden Hall(2025-07-01)은 광고와 실게임 차이를 지적했다. 별도 Reddit 글(2025-11-03)에는 친구·채팅 때문에 남지만 반복 유료 이벤트에 지친다는 의견이 있다. 리뷰의 지불액·주장은 독립 검증하지 않았다. [스토어 리뷰](https://play.google.com/store/apps/details?hl=en-US&id=com.igg.android.lordsmobile&listing=cs011), [커뮤니티 표본](https://www.reddit.com/r/lordsmobile/comments/1onmtv5/does_lords_mobile_worth_playing_in_2025/).

**설계 판단:** 눈에 보이는 영지 성장, 영웅 역할 차이, 공동 목표·기여 보상은 보존할 가치가 있다. 건설을 누를 권한 대신 청원·정책을 선택하는 영주 게임이라면, 타이머 수십 개와 경제 장비 갈아입기를 복제하기보다 ‘내 결정 → 도시 변화 → 이유를 보여주는 결과 보고’로 치환해야 한다.

## 2. State of Survival

**분류·루프.** 좀비 생존 외피 아래 정착지 성장·영웅·동맹 경쟁이 결합된 4X다. 공식 소개는 정착지 재건과 동맹 협력을, 공식 업데이트는 신규 영웅, Alliance Tech, Behemoth, Cross State Capital Clash를 확인시킨다. 후자는 특정 테스트 버전에서 8시간 전쟁 단계를 4시간으로 줄였다고 명시하므로, 일상 점검과 집단 전쟁의 시간 규모가 다르다는 강한 근거다. 과거 패치의 4시간을 현재 모든 서버의 보장값으로 쓰지는 않는다. [FunPlus 공식 소개](https://funplus.com/games/state-of-survival/), [공식 1.17.30 업데이트](https://funplus.com/updates/state-of-survival-1-17-30/).

**대기·자원·장비.** 정착지 건물·병력·기술 성장과 영웅/장비 강화가 누적되는 구조다. 공개 스토어 이용자 기록에는 건물·병력 업그레이드, 행군, 영웅·장비가 함께 언급된다. 단, 정확한 동시 건설 슬롯 수, 현재 연구 항목, 서버 세대별 영웅 해금 조건은 이 조사에서 현행 클라이언트로 검증하지 않았다. 가챠는 Google Play의 ‘확률형 아이템 포함’ 표기를 확인했지만, 이를 모든 영웅의 획득 방식이라고 단정하지 않는다. [공식 배포 페이지 및 리뷰](https://apps.apple.com/us/app/state-of-survival-zombie-war/id1452474937), [Google Play 확률형 표기](https://play.google.com/store/apps/details?hl=en-US&id=com.kingsgroup.sos&listing=0430ai01).

**과금.** 미국 App Store 공개 IAP에는 Biocaps, Crate 상품이 있으며 Pouch of Biocaps US$0.99, Standard Crate US$4.99, Mega Crate US$49.99가 표시된다. 시간·성장재료 패키지 모델은 시장분석 자료가 보완한다. 구체 영웅 완성 비용에 관한 리뷰 숫자는 공식 가격표가 아니다. [미국 공식 스토어 IAP](https://apps.apple.com/us/app/state-of-survival-zombie-war/id1452474937), [Udonis 분석, 2026-07-16](https://www.blog.udonis.co/statistics/state-of-survival).

**3–5분 추론.** 완료 보상·짧은 영웅 전투·채집 재출정은 작은 세션으로 묶을 수 있다. 반면 동맹 전쟁 일정, 지속 경쟁 성장, 새 영웅/강화축은 ‘짧게 접속하지만 자주 돌아와야 하는’ 부담을 만든다. 계정 지속성, 서버 대전, 기간 이벤트를 전면 초기화 시즌제와 구분해야 한다.

**시장 근거.** Sensor Tower 공개 미국 통합 플랫폼 보고서에서 **2024 Q1 주간 매출 정점 약 US$1.4M(2월 초)**가 제시된다. 이는 과거 미국 주간 추정치이며 전 세계 연매출도 현행 순위도 아니다. 공개 글에 gross/net 정의가 없으므로 순매출로 표시하지 않는다. [Sensor Tower, 2024-04](https://sensortower.com/blog/2024-q1-unified-top-5-zombie%20games-revenue-us-600b2bd4241bc16eb88ccbaf).

보조자료 Udonis는 AppMagic 출처로 2025 IAP US$63M, 2024 US$118M을 제시하며 플랫폼 수수료 차감·세금 포함이라고 설명한다. 그러나 같은 글의 요약 MAU 5M과 본문 1.4–2M, 출시시점 기술이 일치하지 않는다. **현행 DAU/MAU·ARPDAU·리텐션 근거로 채택하지 않는 편이 타당**하며, 연매출도 원시 AppMagic 정의와 범위를 재확인하기 전에는 참고 추정치다. [문제의 원문](https://www.blog.udonis.co/statistics/state-of-survival).

**불만·보존할 재미.** Google Play Dennis Gracias(2026-08-20)는 강화 항목 증가와 빈 서버 병합 지연, 경쟁 지출 압박을 호소한다. App Store의 2022년 리뷰들은 동맹 친구와 쉬운 기본 건설 조작을 좋아하면서도 설명·버그·경쟁 과금에 불만을 보인다. 오래된 리뷰는 현재 결함의 증거가 아니다. [현행 노출 Google Play 리뷰](https://play.google.com/store/apps/details?hl=en-US&id=com.kingsgroup.sos&listing=0430ai01), [App Store 리뷰](https://apps.apple.com/us/app/state-of-survival-zombie-war/id1452474937).

**설계 판단:** 캐릭터와 공동체를 지킨다는 감정, 폐허가 생활 공간으로 바뀌는 피드백은 보존한다. 신규 강화축을 계속 쌓는 대신 소수 인물·가문·도시의 인과관계를 깊게 만들고, 장기 부재가 회복 불가능한 손실로 연결되지 않는 실험이 적합하다.

## 3. Evony: The King's Return

**분류·루프.** 광고의 퍼즐/슈팅만으로 분류하면 오판한다. 실제 장기 메타는 도시 성장 → 자원/연구 → 병력 → 역사 장군 → 동맹·실시간 월드 전쟁이다. 공식 설명은 7문명, 장군·외교·병종과 월드맵을 명시한다. [공식 App Store](https://apps.apple.com/us/app/evony/id1098157959).

**성장·영토·시즌 구분.** 공식 EvonyOps의 2026-09-04 소개는 격주 Server War의 Throne·Temple 점령과 반기 All-Star 전장의 거점 점령을 구별한다. 계정 자체의 정기 리셋을 의미하지 않는다. 2026-09-15 행군 규모 가이드는 Academy 연구, VIP, 장군 특성·승급, 군주 장비, 장군 장비, 드래곤까지 중첩 성장축을 나열한다. 이는 연구/영웅/장비가 서로 곱해지는 깊이와 복잡도를 보여준다. [공식 모드 소개](https://liveops.evony.com/knowledge/what-are-core-features-of-evony/), [공식 행군 규모 가이드](https://liveops.evony.com/knowledge/increase-march-size/).

**대기·과금·가챠.** 도시 타이머를 관리하며 성장을 누적하는 구조다. 정확한 현행 건설 슬롯 수·최대 대기시간은 미검증이다. 미국 App Store는 Rally Monthly Card US$9.99, 200 Gems US$0.99, 5,000 Gems US$19.99 등과 Loot Boxes를 표시한다. 따라서 ‘월정액 편의/가치 + 재화 + 확률형’은 확인되지만, 모든 장군을 확률 뽑기로만 얻는다는 뜻은 아니다. [공식 미국 IAP 및 Loot Boxes 표기](https://apps.apple.com/us/app/evony/id1098157959).

**3–5분 추론.** 도시 완료 처리·연구/훈련 설정·채집 출정·동맹 도움은 짧게 분할 가능하다. 대규모 실시간 전장과 동맹 약속까지 3–5분으로 해결된다는 근거는 없다. ‘접속 길이’와 ‘하루 요구 시간/접속 횟수’를 별도 지표로 봐야 한다.

**시장 근거.** Sensor Tower는 **미국, iOS/Android 통합, 2025 Q2**에서 5월 19일 주간 매출 정점 약 US$4.7M을 보고했다. 해당 글은 AI Insights이며 gross/net을 본문에서 밝히지 않는다. 분류도 ‘2D realistic games’여서 이 표를 전체 전략게임 순위로 바꾸면 안 된다. [Sensor Tower, 2025-07](https://sensortower.com/blog/2025-q2-unified-top-5-2d%20realistic%20games-revenue-us-60222863241bc16eb83eea24). Google Play 공개 페이지의 ‘#2 top grossing strategy’ 배지는 수집 화면의 지역이 명확하지 않아 국가별 랭킹 증거에서는 제외한다. [배지 노출 페이지](https://play.google.com/store/apps/details?id=com.topgamesinc.evony).

**불만·보존할 재미.** Luke N의 2024-10-03 Google Play 리뷰는 광고 기대와 타이머 중심 플레이 간 차이, 기간 이벤트 부담을 지적한다. 미국 App Store의 JPhillips1977(2022-08-26)은 강자에게 축적 자원을 잃는 경험을 호소한다. 반대로 장기 무료 플레이와 동맹 친구를 긍정한 리뷰도 보이므로 불만만 전체 여론으로 해석하지 않는다. [Google Play 리뷰](https://play.google.com/store/apps/details?id=com.topgamesinc.evony), [App Store 리뷰 표본](https://apps.apple.com/us/app/evony/id1098157959?platform=iphone&see-all=reviews).

**설계 판단:** 역사 인물·문명 정체성, 전문 역할 배치, 함께 성을 지키는 공동 성취는 보존한다. 광고 미니게임과 실제 핵심 플레이의 단절, 끝없는 승수 성장, 예고 없는 축적 손실은 차별화 대상이다.

## 4. Clash of Clans — 별도 Build & Battle 비교군

**동일한 4X로 묶지 않는다.** 개인 마을의 방어 배치·병력 조합과 비동기 약탈/공격이 중심이며, 지속 월드맵에서 동맹 영토를 확장하는 위 3종과 다르다. 클랜 협력, Clan War/League, Clan Capital 활동은 있지만 ‘같은 서버 대륙의 영토 외교’로 바꾸어 설명하지 않는다. 공식 시즌 과제는 마을 업그레이드, Laboratory 연구, 영웅/펫 성장, 공격, 지원 요청/기부를 별개 행동으로 제시한다. [공식 Season Tasks](https://ingame.support.supercell.com/clash-of-clans/en/articles/season-tasks-3.html).

**최신 타이머 정정.** **2025-03-24 Clash Anytime 업데이트에서 병력·마법·공성장비 훈련 시간과 영웅 회복 시간이 제거되었다.** 건물·연구·영웅 업그레이드 대기는 별개로 남는다. ‘군대를 생산해 놓고 몇 시간 후 복귀’라는 과거 비교는 현재 전투 루프 설명으로 부적절하다. [공식 패치](https://supercell.com/en/games/clashofclans/blog/release-notes/welcome-to-clash-anytime-update/).

**장비·확률 보상.** 영웅 장비는 능력 선택과 광석 성장을 결합한다. 현재 공식 도움말에는 확률 상자 및 Hero Journey의 장비 보상이 있으므로 ‘확률형 요소가 전혀 없다’도 틀리다. 그렇다고 영웅 자체를 뽑는 수집형 RPG라고 분류할 수는 없다. [장비 공식 소개](https://supercell.com/en/games/clashofclans/blog/news/introducing-hero-equipment/), [현행 확률 공개·Hero Journey](https://ingame.support.supercell.com/clash-of-clans/en/articles/chest-drop-chances.html).

**과금·시즌.** 무료 Silver와 유료 Gold Pass, Event Pass, 재화·꾸미기 등이 분리된 상품 구조다. 현행 Season Tasks 문서는 일일 카드가 쌓이고 당일 소멸하지 않는다고 명시한다. 2026-02 발표와 현재 도움말 사이에 연속 구매 보너스 설명 차이가 있으므로 현행 도움말을 우선한다. 시즌 보상 트랙은 개인 마을 전체 초기화 시즌이 아니다. [현행 Gold Pass/과제](https://ingame.support.supercell.com/clash-of-clans/en/articles/season-tasks-3.html), [패스 활성화·기부 공식 안내](https://support.supercell.com/supercell-store/en/articles/pass-activation-and-donation-2.html).

**3–5분 추론.** 성장 상태 확인 → 공격 한 번 → 자원 사용·다음 업그레이드 결정이라는 짧은 완결 루프에 가장 직접적인 참고 사례다. 훈련 대기 제거는 ‘원하는 때 플레이’ 가능성을 높인 공식 설계 변경이다. 다만 실제 평균 세션이 3–5분임을 증명하는 공개 데이터는 확보하지 못했다. 연속 공격과 클랜 활동은 더 길어질 수 있다.

**시장 근거.** Sensor Tower 공개 알림은 **2025-08-01 전 세계 iOS+Android 일매출 추정 US$1,948,451**을 기록한다. 13주년 이벤트 스파이크라는 특정 일자의 관측이며 평균일 매출·회사의 순매출·웹숍 포함 전체 매출이 아니다. 공개 알림의 gross/net 설명은 미기재다. [Sensor Tower, 2025-08-12 알림](https://app.sensortower.com/news-feed/clash-of-clans-sees-revenue-spike-with-13th-clashiversary-event/68914be95a575b49cbe6274a).

**불만·긍정 표본.** 장비/광석을 따라잡기 어렵다는 Reddit 논쟁이 있는 한편, 훈련 대기 제거가 플레이 습관을 개선했다는 글도 있다. 댓글에는 상반된 견해가 존재한다. 최근 Hero Journey 보완이 도입되었으므로 예전 광석 불만을 그대로 현행 전체 평가로 사용하면 안 된다. [광석 경제 토론, 2026-01](https://www.reddit.com/r/ClashOfClans/comments/1q69pao/hero_equipment_and_ore_economy_is_absolute_trash/), [대기 제거 긍정 표본, 2025-04](https://www.reddit.com/r/ClashOfClans/comments/1ju3m16/the_removal_of_training_times_has_helped_me_develop/).

**설계 판단:** 한 번의 선택·실행·결과가 마무리되는 감각, 누적 성장과 배치/조합 선택, 원하는 때 참여할 자유를 보존한다. 영주 시뮬레이터라면 공격 조작을 그대로 복제하기보다 ‘청원 판단 1개 → 작은 도시 변화 → 다음 정책 목표’의 완결성에 응용한다.

## 공통 판단과 검증 공백

| 구분 | 조사에서 확인한 것 | 확인하지 못한 것 / 해석 금지 |
|---|---|---|
| 짧은 세션 | 행동을 분할할 수 있는 기능 구조, CoC 전투 준비 대기 제거 | 게임별 실측 평균 3–5분, 하루 세션 수·총 이용시간 |
| 리텐션 | 장기 운영·기간 이벤트·동맹·성장 장치 | 4개 게임의 공개 검증 가능한 D1/D7/D30 코호트 수치. MAU·매출·운영 연수를 리텐션으로 대체 불가 |
| 매출 | 지역·기간이 명시된 일부 제3자 추정/순위 | 2026-10-06 공통 조건 전체게임 순위, 각 게임 순이익, 웹결제 포함 전체 매출 |
| 플레이어 불만 | 날짜·작성자·원문을 가진 편의 표본 | 전체 유저의 불만 비율, 이탈 원인의 인과적 확정 |
| 구현 검증 | 공식 설명·패치·스토어 기반 기능 존재 | 현행 앱 런타임, 국가/서버/계정별 가격·A/B 테스트·큐 개수 |

**모바일 영주 게임에 남길 익숙한 재미(설계 제안):** 귀환하면 달라진 영지, 즉시 읽을 수 있는 보상, 의미 있는 다음 목표, 인물 육성, 공동체 기여다. **바꿀 부분:** 클릭 수와 타이머를 늘려 접속을 요구하는 대신 적은 결정의 결과를 명확히 보여주고, 복귀 지연을 파국으로 만들지 않으며, 강화축·상점·이벤트 탭을 제한한다. 3–5분 플레이는 ‘할 일이 적다’보다 ‘이번 방문을 만족스럽게 끝낼 수 있다’로 검증해야 한다. 이는 시장에서 입증된 성공 공식이 아니라 프로토타입으로 검증할 가설이다.
