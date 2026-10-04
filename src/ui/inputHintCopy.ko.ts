import type { ControllerActionId } from "../input/controllerActions";
import type { InputDevice } from "../input/inputDevice";
import type { PadGlyphId } from "./padGlyphs";

// Bottom hint line of the build menu (TOUCH-1): the mouse / keyboard and touch words. With a gamepad the line is
// drawn with the pad glyphs (INSTALL-23 ⑤, PAD_HINT_COPY below).
export const INPUT_HINT_COPY: Readonly<Record<Exclude<InputDevice, "gamepad">, string>> = {
  mouse: "클릭 설치 · Esc/우클릭 취소 · 휠 확대 · O 문제 보기",
  touch: "탭 설치 · 끌기 이동·그리기 · 두 손가락 이동·확대 · 두 손가락 탭 취소 · 길게 눌러 상세",
};

/** The zone brush line on touch (the mouse keeps ZONE_BRUSH_COPY.status / eraserStatus; the pad PAD_HINT_COPY). */
export const ZONE_BRUSH_HINT_COPY: Readonly<Record<"touch", { readonly status: (label: string) => string; readonly eraser: string }>> = {
  touch: {
    status: label => `끌어서 ${label} 구역을 칠하세요 · 붓 크기는 아래 카드 · 두 손가락 이동·확대 · 두 손가락 탭 취소`,
    eraser: "끌어서 구역을 지우세요 · 두 손가락 이동·확대 · 두 손가락 탭 취소",
  },
};

/** INSTALL-23 ⑤: a pad glyph's accessible name (the picture's alt). */
export const PAD_GLYPH_NAMES: Readonly<Record<PadGlyphId, string>> = {
  a: "A 버튼", b: "B 버튼", x: "X 버튼", y: "Y 버튼", dpad: "십자키", shoulder_l: "왼쪽 어깨 버튼", shoulder_r: "오른쪽 어깨 버튼",
  trigger_l: "왼쪽 트리거", trigger_r: "오른쪽 트리거", stick_l: "왼쪽 스틱", stick_r: "오른쪽 스틱", menu: "메뉴 버튼", view: "보기 버튼",
};

/** One piece of a pad hint: the glyphs of these controller actions, then the words (either may be absent). */
export type PadHintPart = Readonly<{ actions?: readonly ControllerActionId[]; text: string }>;

/** INSTALL-23 ⑤: the hints a gamepad player reads — the same lines as the keyboard's, with the pad's buttons as glyphs. */
export const PAD_HINT_COPY = {
  /** The build menu's bottom line. */
  build: [
    { actions: ["select"], text: "확정" }, { actions: ["cancel"], text: "취소" }, { actions: ["cursor"], text: "커서" },
    { actions: ["camera"], text: "화면 이동" }, { actions: ["zoom_out", "zoom_in"], text: "축소·확대" },
    { actions: ["tool_prev", "tool_next"], text: "도구" }, { actions: ["zone_tool"], text: "구역" }, { actions: ["problem_view"], text: "문제 보기" },
  ] as readonly PadHintPart[],
  zoneStatus: (label: string): readonly PadHintPart[] => [
    { actions: ["select"], text: `누른 채 커서를 움직여 ${label} 구역 칠하기` }, { actions: ["zone_tool"], text: "다음 붓" }, { actions: ["cancel"], text: "취소" },
  ],
  zoneEraser: [
    { actions: ["select"], text: "누른 채 커서를 움직여 구역 지우기" }, { actions: ["zone_tool"], text: "다음 붓" }, { actions: ["cancel"], text: "취소" },
  ] as readonly PadHintPart[],
  /** The status line while a building tool is armed (the keyboard's "지을 곳을 클릭하세요 — … · 취소하려면 Esc"). */
  placeBuilding: (building: string): readonly PadHintPart[] => [{ actions: ["select"], text: `지을 곳 정하기 — ${building}` }, { actions: ["cancel"], text: "취소" }],
  placeRoad: [{ actions: ["select"], text: "누른 채 커서를 움직여 길 놓기" }, { actions: ["cancel"], text: "취소" }] as readonly PadHintPart[],
  /** The pause badge (the keyboard's "일시 정지 중 · Space"). */
  paused: [{ text: "일시 정지 중" }, { actions: ["pause"], text: "" }] as readonly PadHintPart[],
} as const;
