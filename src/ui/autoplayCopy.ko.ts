export const AUTOPLAY_RESERVE_RECOVERY_LABEL = '다음: 비축 교착 해소를 위해 공사 우선';
export const AUTOPLAY_PAINT_ARABLE_LABEL = '다음: 경작지 칠하기';
export const AUTOPLAY_RELOCATE_HOUSE_LABEL = '다음: 시장이 닿지 않는 집 옮기기';
export const AUTOPLAY_REBUILD_HOUSE_LABEL = '다음: 불탄 집 다시 짓기';
export const AUTOPLAY_FAMINE_RESPONSE_LABEL = '다음: 대기근 대응 정하기';
export const AUTOPLAY_PETITION_RESPONSE_LABEL = '다음: 청원에 답하기';
/** INSTALL-3 (AL-8): the bot turns a barn's crop (the game command `set_farmstead_crop`); the crop is the good's name. */
export const AUTOPLAY_FARMSTEAD_CROP_LABEL = (crop: string) => `다음: 헛간 작물을 ${crop}로`;
/** FIX-10 (TT-4): the bot's timber order. */
export const AUTOPLAY_TIMBER_ORDER_LABEL = (amount: number) => `다음: 장날 상인에게 목재 ${amount} 주문`;
