# Wave43 봄 과수4종 — candidate / 미설치

assets/의 orchard_apple_spring.png, orchard_pear_spring.png, orchard_plum_spring.png, orchard_cherry_spring.png 각256×256 RGBA 1장. 사과·배 흰꽃, 자두·벚 절제된 연분홍꽃. 총4장, 내장 imagegen 개별편집4회.

사과c·배e·자두f의 여름기준은 승인된 Wave41 납품본이다(krill 설치본으로 대체하지 않음). 벚나무 원본은 없어 별도plum_j의 여름/겨울을 종 중립적 형상 대용으로 사용했다. 새벚꽃 후보의 ID는 orchard_cherry_spring이며 자두j가벚종의여름/겨울원본이라는주장은하지않는다.

여름기준 canvas와전체alpha를정확히복사했다. 원시생성RGB는동일전체canvas256²로1회축소한뒤원본녹색수관마스크에만적용하고 노출목재RGB를보존했다. 벚대용의보라열매영역도꽃표면으로교체. 알파0픽셀은RGB0. 변형의생성윤곽을원본윤곽으로숨겼다고주장하지않고 이표면합성방식을generation기록에명시했다. 겨울이미지는기존참조이므로 여름알파와동일하다는뜻이아니다.

manifest.json: 원본pivot(사과128,246/배123,246/자두141,246/벚128,242), worlddisplayWidth43, 상대참조경로,proxy주석. 최종게임코드/설치변경없음.

검수: proofs/seasons-1.0.png와 seasons-0.6.png 동일좌표 겨울→봄→여름(자산캔버스기준오프라인), alpha-dark-light.png. 수관윤곽·줄기·접지 유지, 흰꽃/분홍꽃 구분, 과도한분홍/외곽테두리없음. records/QA.json의4종alpha불일치0, 보존목재마스크RGB불일치0, hiddenRGB비영0. PASS_OFFLINE은런타임검수가아님.

records/sources.json과generations.json에원본경로·참조해시·전체프롬프트·도구명·원시경로·원시해시·후처리·최종해시를보존했다. 모델/seed는도구미제공이므로null. raw/는경량납품ZIP에서제외가능하나원시보존용이다.
