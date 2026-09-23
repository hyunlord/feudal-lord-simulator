# A‴ 준비 상태 UI 검사

이 자료는 **합성 fixture**로 제품 `GameCanvas`·`EraConsole`·공사 상세 카드·도로 배치 미리보기를 Chrome 1600×1100에서 조작한 검사다. 새 게임 60분 플레이나 관문 판정이 아니다. A″의 목책 제안 직전 상태에서 북쪽 도로 일부를 제거해 12개 중 `palisade-000001-segment-008` 한 구간만 고립시켰다. `harness/`와 `capture.mjs`가 재현 도구이고, `capture-model.json`은 실제 클릭 및 엔진 tick 후의 판정 기록이다.

| 캡처 | 관찰 |
| --- | --- |
| [01 선포 전](01-before-proclamation-synthetic.jpg) | 고립된 북쪽 구간에 빨간 경계와 ×, `경로 없는 구간 1` 경고가 보인다. |
| [02 선포 후](02-after-proclamation-unselected-synthetic.jpg) | 고립 구간은 `대기(경로 없음)`으로 남고 다른 구간의 표시도 유지된다. |
| [03 구간 선택](03-selected-site-synthetic.jpg) | 해당 구간을 클릭하면 `도로 미연결`, `강조된 한 칸에 길`이 상세 카드에 나온다. |
| [04 길 미리보기](04-road-hover-synthetic.jpg) | 유일한 빈 연결 칸 `(3,2)`에 커서를 놓으면 `이 길로 연결됩니다 ✓`가 실제 제품 미리보기로 나온다. |
| [05 길 설치](05-repair-built-synthetic.jpg) | 그 칸에 실제 도로를 놓고 엔진을 두 tick 진행하자 해당 구간 원인이 `road_disconnected`에서 `none`으로 바뀌었다. |

모델은 `suggestedRoad=[(3,3),(3,2)]` 중 기존 도로가 없는 칸을 **(3,2) 한 칸**으로 반환했다. 브라우저에서도 해당 칸 위에 도로 유령이 올라왔고, 긍정 안내는 정확한 구간을 선택했을 때만 확인됐다. 처음에 겹치는 다른 구간의 라벨을 클릭해 안내가 보이지 않았던 것은 검사 좌표 오류였으며, 구간 9번째 라벨의 겹치지 않는 부분을 클릭해 재검증했다. 도로 설치 후 선택 상세의 `도로 미연결` 문구도 사라졌다.

시각 확인: 경고·긍정 안내·상세 원인의 한글은 캡처 원본 해상도에서 잘림 없이 읽혔다. 긍정 안내는 색 외에 `✓`와 문장을 함께 써 구분된다. 이 fixture의 왼쪽 제어판은 검사 전용이어서 실제 첫 화면의 온보딩 배치나 모바일 대비를 증명하지 않는다. 이 검사에서 제품 UI의 접근성 자동 측정은 하지 않았다.

## 최종 제품 `518c64a` 재검수

제품 HEAD `518c64a`에서 검사판을 새로 빌드하고 1600×1100 Chrome으로 동일 절차를 다시 실행했다. 첫 화면은 에셋 로딩을 기다린 후 찍었다. 기존 01~05 파일은 보존했다. 최종 5장과 판정은 다음 파일이다.

| 단계 | 최종 캡처 |
| --- | --- |
| 선포 전 경고 | [final-01](final-518c64a-01-before-proclamation-synthetic.jpg) |
| 선포 후 | [final-02](final-518c64a-02-after-proclamation-unselected-synthetic.jpg) |
| 정확한 고립 구간 선택 | [final-03](final-518c64a-03-selected-site-synthetic.jpg) |
| 연결 길 hover | [final-04](final-518c64a-04-road-hover-synthetic.jpg) |
| 길 설치 후 | [final-05](final-518c64a-05-repair-built-synthetic.jpg) |

[최종 판정 JSON](final-518c64a-capture-model.json)은 선포 전 `경로 없는 구간 1`, 선택 상세의 한 칸 연결 안내, 실제 화면의 `이 길로 연결됩니다 ✓`, 설치 전 유일한 빈칸 `(3,2)`, 실제 설치 및 두 tick 후 `road_disconnected → none`, 브라우저 예외 0개를 기록한다. hover 안내 패널은 화면상 표시 상태(`display:block`, `visibility:visible`, `opacity:1`)와 좌표도 확인했다. 기존 캡처와 같은 크기로 비교했을 때 01·02·03·05는 픽셀 변화가 없었고, 04는 마우스가 만든 동적 화면 영역에서 차이가 있었다. 두 세트의 JPEG와 모델 JSON은 합계 약 1.9MB로 3MB 이하다.
