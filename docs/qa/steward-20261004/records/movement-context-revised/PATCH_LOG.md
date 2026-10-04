# 이동 문맥 편집 보류3 교정

- family_extinct: 현재 persons.people의 도시 가문 기록 및 대기 후계 후보라는 검사 범위를 명시했다. 지도 밖 혈족이나 세계의 모든 후계 가능성이 사라졌다고 주장하지 않는다.
- decline_elapsed: '정해진 기한'을 '쇠퇴가 이어진 끝에'로 바꾸었다. houseChangeTicks를 세계 속 통지나 약속으로 표현하지 않는다.
- resettled.split: '집집마다'를 '이주민 가구에'로 바꾸었다. 일부 가구에만 돌아갈 수도 있고 모두에게 돌아갈 수도 있으므로 어느 쪽도 단정하지 않는다.

정확한 before/after는 CHANGES.json이다. 조건·필드·capture 계약·스키마·fixture·사실줄 한계는 보존했다. 원본 proposal에3headline만 원래대로 돌리면 전체JSON이 같아야 한다는 검사를 추가했다. 원본 manifest 전체 및 핵심 파일별 SHA도 재검증한다.

기존104 선택·75 schema음성·26추가필드·15envelope·4이름계약을 다시 실행한다. 정본·엔진·원본·독립검수 폴더는 쓰지 않는다. 검수 원본은 movement-context-review/REVIEW.md이며 수정본 독립 재검수는 아직이다. 실제 capture/runtime/UI를 검증했다고 주장하지 않는다.
