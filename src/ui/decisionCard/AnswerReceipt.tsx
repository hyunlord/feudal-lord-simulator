import type { ReactElement } from "react";
import { Button } from "../kit";
import { wave8FrameLayerStyle } from "../wave8Art";
import type { AnswerReceiptView } from "./answerReceiptModel";
import { ANSWER_RECEIPT_COPY as COPY } from "./answerReceiptCopy.ko";

// RECEIPTS (user 2026-10-10): the heavy card turned over once the lord answers — in the same petition frame, the
// decision's title and the answer given, then every number that answer changed at once (what, and by how much from
// what to what), then what it set going (the card's own later lines for that answer). Its one act is to close it (the
// screen's only primary); time stays stopped while it is up (the decision's modal is still on the stack).

export function AnswerReceipt({ view, onClose }: { readonly view: AnswerReceiptView; readonly onClose: () => void }): ReactElement {
  return (
    <div className="story-modal-backdrop" role="presentation">
      <section className="story-modal petition-card decision-card answer-receipt" data-frame="petition" role="dialog" aria-modal="true"
        aria-label={view.title} data-answer-receipt={view.family} data-subject={view.subjectId} data-rows={String(view.rows.length)}>
        <span className="petition-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_petition")} />
        <div className="petition-body decision-card-body">
          <p className="decision-card-from answer-receipt-kicker">{COPY.kicker}</p>
          <h2>{view.title}</h2>
          <p className="answer-receipt-answer">{COPY.answered(view.answer)}</p>
          <div className="decision-card-part answer-receipt-now">
            <span className="decision-card-part-head">{COPY.heading}</span>
            {view.rows.length === 0 ? <p className="answer-receipt-none">{COPY.none}</p>
              : <ul className="answer-receipt-rows" aria-label={COPY.listLabel(view.title)}>
                {view.rows.map(row => <li key={row.key} className="answer-receipt-row" data-receipt-row={row.key}>
                  <span className="answer-receipt-what">{row.what}</span>
                  <span className="answer-receipt-change">{row.change}</span>
                </li>)}
              </ul>}
          </div>
          {view.later.length === 0 ? null : <div className="decision-card-part answer-receipt-later">
            <span className="decision-card-part-head">{COPY.laterHeading}</span>
            <ul>{view.later.map(line => <li key={line}>{line}</li>)}</ul>
          </div>}
          <Button type="button" className="answer-receipt-close" variant="primary" size="lg" onPress={() => onClose()}>{COPY.close}</Button>
        </div>
      </section>
    </div>
  );
}
