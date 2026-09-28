# 익명 판정 계약

입력: /tmp/lineage-pilot2-blind/board.png. SHA256 7de105d26d518a95b014d0a27f77f958d67dc6c1ef77738ad6f4a5c7272b506b.

에이전트: /root/pilot2_blind_judge. fork_turns=none. 제작·교정·연령 검수에 참여하지 않은 새 에이전트. 전체 결과 또는 정답 개수를 알려주지 않음. 1회 판정. 최종 이미지와 판정 대상 판을 변경하지 않음.

## 실제 전달한 지시

You are an independent visual judge. You must ONLY inspect image /tmp/lineage-pilot2-blind/board.png using view_image detail original. Do not read any other files, filenames, metadata, repository, task history, or source images. The board contains 12 numbered portrait pairs of fictional people, possibly shown at different ages. For EACH numbered pair decide whether portraits depict 'same' person at different ages or 'different' people. Do not assume class frequencies or fixed count of same/different. Judge visual identity continuity, distinguishing facial traits while allowing natural aging; hair, markers and clothing may be visible but note iftheyinfluenceyou. Return JSON with answers:[{number:1,decision:'same'|'different',confidence:'high'|'medium'|'low',reason:'brief observed cues'}...12], and limitations. No filewriting required; no tools beyond the single supplied image viewing (mayreopenifneeded). No subagents. Your decisions will be scored later; no correct labels are supplied.

## 채점

records/blind-key.json의 relation과 response.answers의 decision을 쌍 번호로 대조. 12개 번호 중복/누락 없음. different 정답6, same 정답6, 합계12. 성공 비율을 높이기 위한 정답 이름 교환·쌍 제외·추가 시도 없음.
