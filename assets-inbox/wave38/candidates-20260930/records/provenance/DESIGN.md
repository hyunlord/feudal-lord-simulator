# Wave38 후보 컨트롤 디자인 계약
범위: 게임 코드 변경·설치 없음. PNG40장, 확인 그림2장, CSV와 검수표, /tmp 경량ZIP.
참조: 제공 Wave35_협상틀(따뜻한양피지, 저채도oak, 놋쇠), UI-KIT틀톤. flat P0버튼은 개선대상.
색 토큰: parchment #e8d8b1, light #f1e4c6, ink #35291c, oak #674124, darkoak #3c291c, brass #b29658, wax #843e32, disabled #99917c. 실제 생성에 따라 미세색차 가능.
버튼: rectangular128x40,icon48x48. 투명외곽, 일관된표면. 글자 중앙은 완전히 평평한 무늬없는 단색. 좁은입체 테, 장식은모서리만. 지나친환상풍 장식 금지.
상태: normal도드라짐,hover밝은테/강한위쪽광,pressed1~2px안쪽/내부그림자,disabled회색/낮은대비. 상태별캔버스와slice여백동일.
9slice:대칭 버튼 inset10,10,10,10 우선; rectangular min64x32,icon min48x48. controlsize각각index. 고정shape는9slice inset절반근처,최소=원본으로변형금지.
글자:납품PNG에는없음. 확인용14~16px 한국어, 어두운ink, normal평면중앙. X/check/chevron은글자가아닌필수glyph.
인물카드:제공카드내용/초상보존. 새primary/secondary/close는양피지내부에만. 나무테 안쪽으로최소15px 여백. footer원본버튼가림은깨끗한내부양피지복제,원본프레임손상복원기록.
검수:40ID정확,RGBA/투명모서리/평면중앙,4상태픽셀차이,9slice원본/최소/확대확인,독립시각검수,인물카드실제PNG합성,ZIPCRC/SHA.
