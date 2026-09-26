# 압축·목록 무결성 검사

납품 전 실행하는 검사:

1. assets.csv를 UTF-8 BOM CSV로 다시 읽어57행과 전체프롬프트·출처해시 존재를 확인.
2. 실제57 PNG의 크기·알파·SHA256과CSV를 대조.
3. 확인그림폴더의 PNG가 정확히3개인지 확인.
4. 독립시각판정의 미해결사항이 없는 최종후보만 압축.
5. SHA256SUMS.txt에 압축내 모든자료(해시목록자체제외)의 SHA256를 기록.
6. ZIP을 다시 열어CRC검사와모든내부SHA256검사를 실행.

자산 정량검사 결과는 records/final-validation.json, 시각검수 결과는 records/independent-qa.md를 참조한다. 위 절차를 통과한 ZIP만 최종 전달한다. 게임 런타임 검사는 포함하지 않는다.
