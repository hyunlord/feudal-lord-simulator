import type { InputDevice } from "../input/inputDevice";

// Bottom hint line of the build menu (TOUCH-1): one set per last input device.
export const INPUT_HINT_COPY: Readonly<Record<InputDevice, string>> = {
  mouse: "클릭 설치 · Esc/우클릭 취소 · 휠 확대 · O 문제 보기",
  touch: "탭 설치 · 끌기 이동·그리기 · 두 손가락 이동·확대 · 두 손가락 탭 취소 · 길게 눌러 상세",
  gamepad: "A 확정 · B 취소 · 왼쪽 스틱 커서 · 오른쪽 스틱 이동 · 트리거 확대 · LB/RB 도구 · X 구역",
};
