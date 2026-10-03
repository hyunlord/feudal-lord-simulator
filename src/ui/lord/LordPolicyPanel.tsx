import { useState, type ReactElement } from "react";

import type { BuildingKind } from "../../content/buildingConfig";
import type { GameState } from "../../engine/engine.types";
import { useGameApi } from "../../state/gameStore";
import type { GameAction } from "../../state/gameStore.types";
import { Button, Select } from "../kit";
import { POLICY_COPY as COPY } from "./policyCopy.ko";
import { duesStep, policyView, SUBSIDY_KINDS, SUBSIDY_STEP, subsidyDraft } from "./policyModel";
import { BUILDING_COPY } from "../../content/buildingCatalog.ko";

// LM-R1 (TA-6, lord-mode §2): the ledger drawer's lord tab — the lord sets conditions, the town builds. Kit controls
// only: the policy's four toggle buttons, the subsidy's kind (kit Select) and amount (±10d buttons) with the engine's
// refusal shown and the set button shut while it holds, each subsidy's withdraw button, and the dues' ±5%p buttons.
// Each press is the game's own command (set_estate_policy, set_project_subsidy, set_market_dues: ledger decisions).

/** A subsidy's points stop at 60 (4 per 10d): 150d is the most that still moves a score. */
const MAX_SUBSIDY = 150;

export function LordPolicyPanel({ state }: { readonly state: GameState }): ReactElement | null {
  const { dispatch } = useGameApi();
  return <LordPolicyView state={state} dispatch={dispatch} />;
}

export function LordPolicyView({ state, dispatch }: { readonly state: GameState; readonly dispatch: (action: GameAction) => void }): ReactElement | null {
  const [kind, setKind] = useState<BuildingKind>(SUBSIDY_KINDS[0]!);
  const [amount, setAmount] = useState(SUBSIDY_STEP);
  const view = policyView(state);
  if (view === null) return null;
  const draft = subsidyDraft(state, kind, amount);
  // The lord's commands (as GameCanvas's demolishHouse): a press names the command, the command dispatches it.
  const command = (action: GameAction) => dispatch(action);
  return (
    <section className="lord-policy" aria-label={COPY.regionLabel}>
      <p className="lord-policy-intro">{COPY.intro}</p>
      <h3>{COPY.policyHeading}</h3>
      <p className="lord-policy-now" data-policy-now="true">{view.policy}</p>
      <div className="lord-policy-options">
        {view.options.map(option => (
          <Button key={option.key} type="button" className="lord-policy-option" data-policy={option.key} aria-pressed={option.chosen}
            aria-label={COPY.policyChoose(option.label)} onPress={() => { if (!option.chosen) command({ type: "set_estate_policy", policy: option.key }); }} variant="toggle">
            <span className="lord-policy-option-name">{option.label}</span>
            <span className="lord-policy-option-weights">{option.weights}</span>
          </Button>
        ))}
      </div>
      <h3>{COPY.subsidyHeading}</h3>
      <p className="lord-policy-line">{view.subsidyRule}</p>
      <p className="lord-policy-line" data-subsidy-total="true">{view.offered}</p>
      {view.subsidies.length === 0 ? null : <ul className="lord-policy-subsidies">
        {view.subsidies.map(subsidy => (
          <li key={subsidy.kind}>
            <span>{subsidy.line}</span>
            <Button type="button" className="lord-policy-withdraw" data-withdraw={subsidy.kind} aria-label={COPY.subsidyWithdrawLabel(subsidy.name)}
              onPress={() => command({ type: "set_project_subsidy", kind: subsidy.kind, amount: 0 })} variant="secondary">{COPY.subsidyWithdraw}</Button>
          </li>
        ))}
      </ul>}
      <div className="lord-policy-draft">
        <Select className="lord-policy-kind" label={COPY.subsidyKind} value={kind} onChange={setKind}
          options={SUBSIDY_KINDS.map(value => ({ value, label: BUILDING_COPY[value]?.name ?? value }))} />
        <div className="lord-policy-stepper">
          <Button type="button" className="lord-policy-step" data-step="less" aria-label={COPY.subsidyLess} disabled={amount <= 0}
            onPress={() => setAmount(current => Math.max(0, current - SUBSIDY_STEP))} variant="icon">−</Button>
          <span className="lord-policy-amount" data-amount={amount}>{draft.amountLine}</span>
          <Button type="button" className="lord-policy-step" data-step="more" aria-label={COPY.subsidyMore} disabled={amount >= MAX_SUBSIDY}
            onPress={() => setAmount(current => Math.min(MAX_SUBSIDY, current + SUBSIDY_STEP))} variant="icon">+</Button>
        </div>
        <p className="lord-policy-line">{draft.points}</p>
        {draft.blocked === null ? null
          : <p className="lord-policy-refusal" role="status" data-refused={draft.refused ? "true" : "false"}>{draft.blocked}</p>}
        <Button type="button" className="lord-policy-set" data-subsidy-set="true" disabled={draft.blocked !== null}
          onPress={() => { if (draft.blocked === null) command({ type: "set_project_subsidy", kind, amount }); }} variant="primary">
          {draft.replaces ? COPY.subsidyReplace : COPY.subsidySet}</Button>
      </div>
      {view.lastRefusal === null ? null : <p className="lord-policy-line lord-policy-last-refusal">{view.lastRefusal}</p>}
      <h3>{COPY.duesHeading}</h3>
      <div className="lord-policy-stepper">
        <Button type="button" className="lord-policy-step" data-dues="lower" aria-label={COPY.duesLower} disabled={!view.dues.canLower}
          onPress={() => command({ type: "set_market_dues", permille: duesStep(view.dues.permille, -1) })} variant="icon">−</Button>
        <span className="lord-policy-amount" data-dues-permille={view.dues.permille}>{view.dues.now}</span>
        <Button type="button" className="lord-policy-step" data-dues="raise" aria-label={COPY.duesRaise} disabled={!view.dues.canRaise}
          onPress={() => command({ type: "set_market_dues", permille: duesStep(view.dues.permille, 1) })} variant="icon">+</Button>
      </div>
      <ul className="lord-policy-dues">
        <li>{view.dues.lord}</li><li>{view.dues.merchants}</li><li>{view.dues.points}</li><li>{COPY.duesRange}</li>
      </ul>
    </section>
  );
}
