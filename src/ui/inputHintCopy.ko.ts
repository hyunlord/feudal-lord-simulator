import type { InputDevice } from "../input/inputDevice";

// Bottom hint line of the build menu (TOUCH-1): one set per last input device.
export const INPUT_HINT_COPY: Readonly<Record<InputDevice, string>> = {
  mouse: "클릭 설치 · Esc/우클릭 취소 · 휠 확대 · O 문제 보기",
  touch: "탭 설치 · 끌기 이동·그리기 · 두 손가락 이동·확대 · 두 손가락 탭 취소 · 길게 눌러 상세",
  gamepad: "A 확정 · B 취소 · 왼쪽 스틱 커서 · 오른쪽 스틱 이동 · 트리거 확대 · LB/RB 도구 · X 구역",
};

/** The zone brush line (the mouse keeps ZONE_BRUSH_COPY.status / eraserStatus). Brush size is on the bottom card. */
export const ZONE_BRUSH_HINT_COPY: Readonly<Record<Exclude<InputDevice, "mouse">, { readonly status: (label: string) => string; readonly eraser: string }>> = {
  touch: {
    status: label => `끌어서 ${label} 구역을 칠하세요 · 붓 크기는 아래 카드 · 두 손가락 이동·확대 · 두 손가락 탭 취소`,
    eraser: "끌어서 구역을 지우세요 · 두 손가락 이동·확대 · 두 손가락 탭 취소",
  },
  gamepad: {
    status: label => `A를 누른 채 커서를 움직여 ${label} 구역을 칠하세요 · X 다음 붓 · B 취소`,
    eraser: "A를 누른 채 커서를 움직여 구역을 지우세요 · X 다음 붓 · B 취소",
  },
};
