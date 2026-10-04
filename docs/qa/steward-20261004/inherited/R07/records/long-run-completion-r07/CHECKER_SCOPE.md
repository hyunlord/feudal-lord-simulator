# 장기 판 종료 검사

JSON·원격 종료코드의 경량 사후 검사다. 첫 과거N02 보정 실행에서 envelope.seed를 숫자로 가정해 실패했다. 실제 saveCodec.ts45–63은 String(input.state.seed)를 쓰므로 envelope는 문자열, state는 숫자로 각각 엄격 비교하도록 바로잡았다. 실패 기록은 별도 보존한다. 게임 결함으로 세지 않는다.

종료0·target_year·1450/600000·150연간행·초기/연간/최종 통제값·codec 실행기록·최종상태해시·unsupported파일·미종결wait를 검사한다. 전체 자원/금고/권리 보존, 재미, UI, 전기간독립재생을 입증하지 않는다. 실행기 자체 every-tick guard는 기존 프로토콜의 별도 근거다.

V2 보강: 실제 start/final 저장 본문 SHA, 필수64hex, 유일start/final 로그, 실제agency통제,scenario,연간달력,예정저장,HEAD/config를검사한다. review-v2/에서 양성3·음성11 검증. 원격종료코드의 판별 연결은 부모 scope/PID 및 공식실행기 기록으로 별도확인한다.
