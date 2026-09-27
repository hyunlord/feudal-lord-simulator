/** UI-KIT-1 /dev/ui-kit: the gallery's own labels (a developer screen; the parts carry the game's copy elsewhere). */
export const UI_KIT_GALLERY_COPY = {
  title: "공용 부품 갤러리",
  note: "모든 부품 · 변형 · 상태 (UI-KIT-1). 상태는 코드로 그립니다: 밝게(호버), 1px 눌림, 봉랍색 초점 고리, 회색(사용 불가).",
  sections: {
    buttons: "단추", sizes: "크기", states: "상태", icon: "아이콘 단추", select: "선택 목록", toggles: "켜기·끄기", slider: "밀대",
    tabs: "탭", chips: "칩", frames: "틀", tooltip: "도움말 · 구분선",
  },
  variants: { primary: "주 동작", secondary: "보조", quiet: "조용히", danger: "위험", toggle: "켜고 끄기", tab: "탭", surface: "표면(틀 안의 칸)" },
  sizes: { sm: "작게", md: "보통", lg: "크게" },
  states: { normal: "보통", pressed: "눌림·켬", disabled: "사용 불가" },
  iconLabels: { close: "닫기", look: "위치로", help: "도움말" },
  selectLabel: "중요도",
  selectOptions: ["일상 모두", "주목할 것", "이정표·큰 결정 이상", "큰 사건만"],
  toggle: "소리", checkbox: "계절마다 결산 띄우기", on: "켬", off: "끔",
  slider: (percent: number) => `음량 ${percent}%`,
  sliderLabel: "전체 소리 크기",
  tabs: { resources: "자원", view: "보기", map: "지도" },
  chips: { ok: "충분", warn: "주의", block: "모자람", info: "정보" },
  frames: { light: "밝은 판", dark: "어두운 판", objective: "목표 카드", advisor: "청지기", modal: "대화 상자", tooltip: "도움말", record: "기록 카드" },
  frameStates: { complete: "목표 완료", warn: "목표 경고", advisorWarn: "청지기 걱정" },
  frameBody: "양피지 9-slice 틀. 글은 틀 안쪽 여백에 놓입니다.",
  tooltip: "도움말은 누르거나 초점을 줄 때도 보입니다(호버만으로 보이는 정보는 없습니다).",
} as const;
