# 게임 소리 출처와 라이선스 (F0-V)

- **파일:** `public/audio/`에 15개, 모두 모노 MP3다(`scripts/buildAudio.sh`가 원본을 한 번 다시 인코딩했다).
- **버스:** 소리 쪽 `src/audio/audioEngine.ts` `SOUND_BANK`에 파일마다 버스와 기본 음량이 있다.
- **라이선스 전문:** `public/licenses/audio/`에 두고, 빌드에도 싣는다.
- **받은 날:** 2026-09-26.

| 소리 | 쓰는 곳 | 원본 | 출처·라이선스 |
|---|---|---|---|
| `place_ok` | 배치 확정 | Interface Sounds `confirmation_001.ogg` | Kenney Interface Sounds — CC0 1.0 — https://kenney.nl/assets/interface-sounds |
| `place_cancel` | 도구 취소(Esc·우클릭) | Interface Sounds `back_001.ogg` | 위와 같음 |
| `place_blocked` | 배치 불가 | Interface Sounds `error_006.ogg` | 위와 같음 |
| `alert_info` | 해금 배너(정보) | Interface Sounds `pluck_001.ogg` | 위와 같음 |
| `alert_warn` | 경고 줄 · 주의 | Interface Sounds `glass_004.ogg` | 위와 같음 |
| `alert_urgent` | 경고 줄 · 즉시 | Impact Sounds `impactBell_heavy_000.ogg` | Kenney Impact Sounds — CC0 1.0 — https://kenney.nl/assets/impact-sounds |
| `hammer_1`~`hammer_3` | 공사장 망치(작업 국면, 가까운 두 곳) | Impact Sounds `impactWood_medium_000/002/004.ogg` | 위와 같음 |
| `unload_wood` | 목재 부림(배달) | Impact Sounds `impactWood_heavy_001.ogg` | 위와 같음 |
| `unload_stone` | 석재 부림(배달) | Impact Sounds `impactMining_002.ogg` | 위와 같음 |
| `stage_thud` | 공사 단계 전환 | Impact Sounds `impactSoft_heavy_002.ogg` | 위와 같음 |
| `complete` | 완공 | Interface Sounds `confirmation_004.ogg` | Kenney Interface Sounds — CC0 1.0 |
| `cart_loop` | 수레 루프(화면 안 수레꾼) | RPG Audio `creak1.ogg` ×2 + Impact Sounds `impactWood_light_001.ogg` ×4를 2.4초 고리로 합성 | Kenney RPG Audio — CC0 1.0 — https://kenney.nl/assets/rpg-audio, Kenney Impact Sounds — CC0 1.0 |
| `spring_ambience` | 봄 환경(달력 봄) | 녹음 없음. `scripts/synthAmbience.py`가 바람 소음 + 새소리 사인 스윕으로 합성(seed 1300, 12초 고리) | 이 프로젝트가 만든 소리. 제3자 권리 없음 |

- **CC0 1.0:** 저작자 표시 의무가 없다. 그래도 Kenney(www.kenney.nl) 표기를 남긴다.
- **Sonniss GDC 번들:** 쓰지 않았다.
