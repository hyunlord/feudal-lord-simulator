// F0-V sound settings (settings popover).
export const AUDIO_COPY = {
  group: "소리",
  mute: "소리",
  on: "켬",
  off: "끔",
  quieter: "소리 줄이기",
  louder: "소리 키우기",
  volume: (percent: number) => `음량 ${percent}%`,
  // AUDIO-1 mixer: the three buses.
  buses: { ui: "화면", alert: "알림", world: "마을" },
  busLevel: (bus: string, percent: number) => `${bus} 소리 ${percent}%`,
  busLabel: (bus: string) => `${bus} 소리 크기`,
} as const;
