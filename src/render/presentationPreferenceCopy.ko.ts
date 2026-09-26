import type { PresentationPreference } from "./presentationPreferences";

// UI-4 / INSTALL-15 settings copy (pause menu).
export const PRESENTATION_PREFERENCE_COPY: Readonly<Record<PresentationPreference, { readonly on: string; readonly off: string }>> = {
  rainOverlay: { on: "젖은 여름 비 그리기: 켬", off: "젖은 여름 비 그리기: 끔" },
  eventPause: { on: "사건 카드가 뜨면 멈추기: 켬", off: "사건 카드가 뜨면 멈추기: 끔" },
  seasonFx: { on: "낙엽·눈 내림: 켬", off: "낙엽·눈 내림: 끔" },
};
