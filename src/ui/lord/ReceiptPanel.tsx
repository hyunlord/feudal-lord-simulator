import { useEffect, useState, type CSSProperties, type ReactElement } from "react";

import type { GameState } from "../../engine/engine.types";
import { lordMode } from "../../engine/townAgency";
import { BuildGlyph } from "../BuildGlyph";
import { buildThumbnail } from "../buildMenuPresentation";
import { frameArtSpaceStyle, frameLayerStyle } from "../frameBox";
import { Button } from "../kit";
import { openChronicleRecord } from "./chronicleFocus";
import { preloadReceiptArt, receiptArtStyle, receiptSlotStyle } from "./receiptArt";
import { RECEIPT_COPY as COPY } from "./receiptCopy.ko";
import { receiptView, type ReceiptView } from "./receiptModel";

// LM-R1 (TA-5, lord-mode §3.6): the "왜 여기?" button on a selected building's card (lord mode only) and the receipt it
// opens beside the card, in Astra's receipt frame: the building's picture in the frame's recess, the reasons with their
// signed values written beside the bars, the sites compared, the chance it was drawn by, the lord's decisions as ribbons
// that open their ledger records, and the money in the lower field. A building without a receipt says why instead.

/** The selection the card shows: a building or construction site id (null: a walker, a wall). */
export function LordWhyHere({ state, targetId }: { readonly state: GameState; readonly targetId: string | null }): ReactElement | null {
  const [open, setOpen] = useState(false);
  const lord = lordMode(state);
  useEffect(() => { setOpen(false); }, [targetId]);
  useEffect(() => { if (lord) preloadReceiptArt(); }, [lord]);
  if (!lord || targetId === null) return null;
  const view = receiptView(state, targetId);
  if (view === null) return null;
  return (
    <>
      <Button type="button" className="lord-why-here" data-lord-receipt={view.kind} aria-expanded={open} aria-label={COPY.openLabel(view.name)}
        onPress={() => setOpen(current => !current)} variant="secondary">{COPY.open}</Button>
      {open ? <ReceiptPanel view={view} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ReceiptPicture({ view }: { readonly view: ReceiptView }) {
  const source = view.building === null ? null : buildThumbnail(view.building);
  return (
    <div className="lord-receipt-window" style={receiptSlotStyle("window")}>
      {source !== null ? <img src={source} alt="" /> : view.building !== null ? <BuildGlyph tool={view.building} /> : null}
    </div>
  );
}

export function ReceiptPanel({ view, onClose }: { readonly view: ReceiptView; readonly onClose: () => void }): ReactElement {
  return (
    <aside className="lord-receipt" data-frame="receipt" data-receipt={view.kind} aria-label={COPY.regionLabel(view.name)}>
      <span className="lord-receipt-frame" aria-hidden="true" style={frameLayerStyle("receipt")} />
      <div className="lord-receipt-slots" style={frameArtSpaceStyle("receipt")}>
        <ReceiptPicture view={view} />
        {view.kind === "receipt" ? <p className="lord-receipt-foot" data-subsidy={view.subsidy > 0 ? "paid" : "none"} style={receiptSlotStyle("foot")}>{view.money}</p> : null}
        <Button type="button" className="lord-receipt-close" aria-label={COPY.close} onPress={() => onClose()} variant="icon">×</Button>
      </div>
      <div className="lord-receipt-body">
        <h2>{COPY.heading(view.name)}</h2>
        {view.kind === "none" ? <><h3>{COPY.noneHeading}</h3><p className="lord-receipt-none">{view.explanation}</p></> : <ReceiptBody view={view} />}
      </div>
    </aside>
  );
}

function ReceiptBody({ view }: { readonly view: Extract<ReceiptView, { kind: "receipt" }> }) {
  return (
    <>
      <p className="lord-receipt-line">{view.builtBy}</p>
      <p className="lord-receipt-line">{view.origin}</p>
      <h3>{COPY.reasonsHeading}</h3>
      <ul className="lord-receipt-reasons">
        {view.reasons.map(reason => (
          <li key={reason.name} className="lord-receipt-reason" data-sign={reason.sign} aria-label={COPY.reasonLabel(reason.label, reason.text)}>
            <span className="lord-receipt-cap" aria-hidden="true"
              style={reason.sign === "zero" ? undefined : receiptArtStyle(reason.sign === "plus" ? "reason_bar_cap_plus" : "reason_bar_cap_minus")} />
            <span className="lord-receipt-reason-name">{reason.label}</span>
            <span className="lord-receipt-bar" aria-hidden="true"><span style={{ "--receipt-share": reason.share } as CSSProperties} /></span>
            <span className="lord-receipt-value">{reason.text}</span>
          </li>
        ))}
      </ul>
      <h3>{COPY.sitesHeading}</h3>
      <ul className="lord-receipt-lines" data-runner-up={view.runnerUp === null ? "none" : String(view.runnerUp)}>
        {view.sites.map(line => <li key={line}>{line}</li>)}
      </ul>
      <h3>{COPY.chanceHeading}</h3>
      <ul className="lord-receipt-lines" data-chance={view.chanceKnown ? "known" : "none"}>
        {view.chance.map(line => <li key={line}>{line}</li>)}
      </ul>
      <h3>{COPY.decisionsHeading}</h3>
      {view.decisions.length === 0 ? <p className="lord-receipt-line">{COPY.noDecisions}</p> : <ul className="lord-receipt-decisions">
        {view.decisions.map(decision => (
          <li key={decision.id}>
            <Button type="button" className="lord-receipt-ribbon" data-record={decision.id} disabled={!decision.found} style={receiptArtStyle("related_decision_ribbon")}
              aria-label={COPY.decisionLabel(decision.date, decision.line)} onPress={() => { if (decision.tick !== null) openChronicleRecord(decision.id, decision.tick); }} variant="surface">
              <span className="lord-receipt-ribbon-date">{decision.date}</span>
              <span className="lord-receipt-ribbon-line">{decision.line}</span>
            </Button>
          </li>
        ))}
      </ul>}
    </>
  );
}
