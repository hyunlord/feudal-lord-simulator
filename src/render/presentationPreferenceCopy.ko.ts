import type { PresentationPreference } from "./presentationPreferences";

// UI-4 / INSTALL-15 / INSTALL-23 settings copy (pause menu).
export const PRESENTATION_PREFERENCE_COPY: Readonly<Record<PresentationPreference, { readonly on: string; readonly off: string }>> = {
  rainOverlay: { on: "젖은 날 비 그리기: 켬", off: "젖은 날 비 그리기: 끔" },
  eventPause: { on: "사건 카드가 뜨면 멈추기: 켬", off: "사건 카드가 뜨면 멈추기: 끔" },
  seasonFx: { on: "낙엽·눈 내림: 켬", off: "낙엽·눈 내림: 끔" },
  developerInfo: { on: "개발자 표시(초상 선택 근거): 켬", off: "개발자 표시(초상 선택 근거): 끔" },
  // NAT-2: the QA info overlay (its key: `).
  qaOverlay: { on: "QA 정보 표시(틱·카메라·클릭한 칸·선택, 단축키 `): 켬", off: "QA 정보 표시(틱·카메라·클릭한 칸·선택, 단축키 `): 끔" },
  weatherFx: { on: "날씨 효과(비·안개·먼지·서리·구름 그림자): 켬", off: "날씨 효과(비·안개·먼지·서리·구름 그림자): 끔" },
};
