# 무효과 heavy 답의 포화 경계 재현

측정 엔진 `0b04cd0becc4d73059fbfcf372395c8672d1a381`에서 실행했다. 당시 제품 diff는 없고 인계 문서2개만 수정 중이었다. 실제 실행 도구/결과 바이트와 SHA, 명령, Node 버전은 `provenance.json`에 있다.

준비 seed17의 상인 관계를−100으로 설정하고, 실제 계절 함수가 만든 특허 청원을 실제 reducer로 두 번 거절했다. 각 답은 rights 무게의 heavy 답이지만 관계−100→−100이다. 처리 상태를 맞춘 대조군과 다음 한 철의 실제 stewardship 전이를 비교하면 규칙·경제 변화 차이0, 해당 답의 미래 링크0이다. 청원 처리 자체는 즉시 상태 변화이며 비교에서 별도로 제외했다. 전체 tick 전진·모든 미래·자연125년 빈도·80% 도달 불가능의 증명은 아니다.

재현: 해당 커밋 체크아웃에서 두 단계 아래 `.omo/evidence/`를 만들고 `tlink-charter-saturation.mjs`를 복사한 뒤 아래 명령을 실행한다. 상대 import 때문에 원래 실행 위치가 필요하다. 출력 JSON은 `.omo/evidence/tlink-charter-saturation.json`이다.

```sh
node --import tsx .omo/evidence/tlink-charter-saturation.mjs
```

앞선4a2125e9의 작업 트리 실험 대신, 직접 감독 원인 교정까지 포함한0b04에서 다시 확인한 증거다. 분모나 미래 직접 링크 정의를 바꾸는 근거로 사용하지 않는다.
