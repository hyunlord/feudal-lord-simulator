import type { Wave40ImageId } from "./wave40Art";

// EVENT-ART (Wave 40) the lord's moments in lord mode, one chip and card per ledger record (src/ui/lordMomentBeats.ts): the
// marriage's stages, the inheritance, the suit and its possession, the wardship. The card's line is the ledger's own sentence;
// these are its title and its advice (what follows from it in the engine's rules).
export const LORD_MOMENT_COPY: Readonly<Record<Wave40ImageId, Readonly<{ title: string; advice: string }>>> = {
  moment_marriage_negotiation: { title: "혼담을 넣었다", advice: "이웃 영주가 조건을 따져 본다. 조건을 고쳐 되물어 오면 한 철 안에 답해야 한다." },
  moment_marriage_sealing: { title: "혼인 계약을 봉인했다", advice: "계약의 약속은 기한 안에 지켜야 한다. 어기면 증인들이 기억한다." },
  moment_bride_arrival: { title: "신부가 왔다", advice: "신부는 이제 영주 집안 사람이다. 이웃 영지의 상속은 그녀를 통해 온다." },
  moment_first_child: { title: "첫아이가 태어났다", advice: "영주 집안의 대가 한 대 더 이어진다." },
  moment_brother_in_law_born: { title: "처남이 태어났다", advice: "이웃 영주에게 아들이 생겼다. 그가 살아 있으면 영지는 그 아들에게 간다." },
  moment_old_lord_sickbed: { title: "이웃 영주가 병들었다", advice: "그가 죽으면 이웃 영지의 상속이 정해진다." },
  moment_attempted_will_change: { title: "유언을 고치려 한다", advice: "그대로 두면 한 철 뒤 새 유언이 서고, 조카가 영지를 차지한다." },
  moment_inheritance_fealty: { title: "소작인들이 충성을 서약했다", advice: "이웃 영지가 이제 영주의 것이다. 상속 뒤로 미룬 빚이 있으면 해마다 갚는다." },
  moment_lawsuit_filed: { title: "소송이 제기되었다", advice: "소송은 증거, 후원, 심리를 거쳐 판결로 간다. 단계마다 비용이 든다." },
  moment_documentary_evidence: { title: "증거를 대조한다", advice: "증서, 장원 기록, 증인이 청구를 무겁게 한다. 같은 증거는 한 번만 낸다." },
  moment_possession_refused: { title: "점유자가 버텼다", advice: "판결은 났지만 점유는 따로다. 버티는 힘은 시도할 때마다 줄어든다." },
  moment_possession_taken: { title: "점유를 넘겨받았다", advice: "판결대로 땅이 넘어왔다. 이제 권원과 점유가 함께 있다." },
  moment_child_lord_guardian: { title: "어린 영주의 후견", advice: "영주가 스물한 살이 될 때까지 후견인이 영지를 돌본다." },
  moment_end_of_wardship: { title: "후견이 끝났다", advice: "영주가 성년이 되어 장부와 열쇠를 넘겨받았다." },
};

/** Astra lordplay2 ②: a house's enforcement against the lord (wave40RecordSide `against`) — what he lost, or kept. */
const AGAINST_LORD: Readonly<Partial<Record<Wave40ImageId, Readonly<{ title: string; advice: string }>>>> = {
  moment_possession_taken: { title: "이웃이 점유를 가져갔다", advice: "판결대로 땅이 그 가문에게 넘어갔다. 이제 권원과 점유가 모두 그쪽에 있다." },
  moment_possession_refused: { title: "영주가 버텼다", advice: "판결은 그 가문 쪽으로 났지만 점유는 아직 영주에게 있다. 버티는 힘은 시도할 때마다 줄어든다. 약속·소송 장부에서 사람을 들여 버티거나 합의할 수 있다." },
};

/** A moment's title and advice by whose it is (the lord's own, or a house's against him). */
export const lordMomentWords = (art: Wave40ImageId, side: "lord" | "against"): Readonly<{ title: string; advice: string }> =>
  (side === "against" ? AGAINST_LORD[art] : undefined) ?? LORD_MOMENT_COPY[art];
