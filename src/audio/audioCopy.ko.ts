// F0-V sound settings (settings popover).
export const AUDIO_COPY = {
  group: "소리",
  mute: "소리",
  on: "켬",
  off: "끔",
  quieter: "소리 줄이기",
  louder: "소리 키우기",
  volume: (percent: number) => `음량 ${percent}%`,
} as const;
